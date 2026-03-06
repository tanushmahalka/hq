# EC2 Runbook (HQ + OpenClaw)

This runbook is for provisioning a new Ubuntu EC2 instance for this private repo (`hq`) and its private `openclaw` submodule.

## 0) Why `corepack enable` and pnpm version pinning

- `corepack enable` sets up package-manager shims (`pnpm`, `yarn`) from Node.
- `corepack prepare pnpm@10.23.0 --activate` installs and activates an exact pnpm version.
- Use `10.23.0` because `openclaw/package.json` pins `"packageManager": "pnpm@10.23.0"`.
- `10.30.3` will usually work, but pinned version is safer/reproducible.

## 1) Base packages and Node

```bash
sudo apt update
sudo apt install -y git curl build-essential nginx
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
node -v
npm -v
```

Optional (if you want Bun for HQ):

```bash
curl -fsSL https://bun.sh/install | bash
source ~/.bashrc
bun --version
```

## 2) Enable Corepack + pnpm (fixing permission errors)

If `corepack enable` fails with `EACCES` on `/usr/bin/pnpm`, run:

```bash
sudo corepack enable
sudo corepack prepare pnpm@10.23.0 --activate
pnpm --version
```

If still blocked by a stale symlink:

```bash
which pnpm || true
ls -l /usr/bin/pnpm || true
sudo rm -f /usr/bin/pnpm
sudo corepack enable
sudo corepack prepare pnpm@10.23.0 --activate
pnpm --version
```

## 3) GitHub SSH auth for private repo + submodule

```bash
mkdir -p ~/.ssh && chmod 700 ~/.ssh
ssh-keyscan github.com >> ~/.ssh/known_hosts
git config --global url."git@github.com:".insteadOf "https://github.com/"
```

Add your SSH key (or deploy key) in GitHub first, then validate:

```bash
ssh -T git@github.com
```

## 4) Clone repo with submodules

```bash
sudo mkdir -p /opt && sudo chown "$USER:$USER" /opt
git clone --recurse-submodules git@github.com:tanushmahalka/hq.git /opt/hq
cd /opt/hq
git submodule sync --recursive
git submodule update --init --recursive
```

## 5) Build OpenClaw + install daemon (preferred: OpenClaw-managed user service)

```bash
cd /opt/hq/openclaw
pnpm install
pnpm ui:build
pnpm build
pnpm openclaw onboard --install-daemon
systemctl --user is-enabled openclaw-gateway.service
systemctl --user status openclaw-gateway.service --no-pager
```

If `onboard --install-daemon` fails around `systemctl --user` (for example `is-enabled unavailable`), check if service is still usable:

```bash
cd /opt/hq/openclaw
pnpm openclaw gateway status
pnpm openclaw gateway start
```

If still not working, use fallback mode below.

## 5A) Fallback daemon mode (manual system service)

```bash
cd /opt/hq/openclaw
pnpm openclaw onboard --no-install-daemon

sudo tee /etc/systemd/system/openclaw-gateway.service >/dev/null <<'EOF'
[Unit]
Description=OpenClaw Gateway
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/opt/hq/openclaw
Environment=HOME=/home/ubuntu
ExecStart=/usr/bin/node /opt/hq/openclaw/dist/index.js gateway --port 18789 --bind loopback
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable --now openclaw-gateway
sudo systemctl status openclaw-gateway --no-pager
```

## 6) Install HQ (use pnpm or bun; no npm)

```bash
cd /opt/hq
```

If using `pnpm`:

```bash
pnpm install
```

If using `bun`:

```bash
bun install
```

Create `/opt/hq/.dev.vars` with production values (never commit secrets):

```env
DATABASE_URL=postgresql://...
BETTER_AUTH_SECRET=...
BETTER_AUTH_URL=https://hq.example.com
SUPER_ADMIN_EMAILS=dev1@example.com,dev2@example.com
BOOTSTRAP_ORG_NAME=Acme Inc
BOOTSTRAP_ORG_SLUG=acme-inc
BOOTSTRAP_ADMIN_NAME=Jane Admin
BOOTSTRAP_ADMIN_EMAIL=owner@acme.com
BOOTSTRAP_ADMIN_PASSWORD=change-me
AGENT_API_TOKEN=...
ALLOWED_ORIGINS=https://hq.example.com
OPENCLAW_HOOKS_URL=http://127.0.0.1:18789
OPENCLAW_HOOKS_TOKEN=...
VITE_GATEWAY_URL=wss://hq.example.com/gateway
VITE_GATEWAY_TOKEN=<gateway.auth.token from ~/.openclaw/openclaw.json>
LOCAL_PG_ADMIN_URL=postgresql://postgres:password@localhost:5432/postgres
LEAD_AGENT_ID=jessica
```

Run migration with your chosen package manager:

```bash
cd /opt/hq
set -a
source /opt/hq/.dev.vars
set +a
pnpm run db:push
# OR
bun run db:push
```

Bootstrap the single HQ organization and first admin user:

```bash
cd /opt/hq
set -a
source /opt/hq/.dev.vars
set +a
pnpm run bootstrap:hq
# OR
node --experimental-strip-types ./scripts/bootstrap-hq.ts
```

After bootstrap:

- Public signup is no longer part of the HQ flow.
- Only invited emails can create new user accounts.
- The seeded bootstrap user is the customer's org admin, not a platform super-admin.
- Platform/developer debug access comes from global `SUPER_ADMIN_EMAILS` or `pnpm run grant:super-admin`.
- The seeded org admin should invite teammates from the `Team` page in HQ.

Grant or create a platform super-admin:

```bash
cd /opt/hq
set -a
source /opt/hq/.dev.vars
set +a
SUPER_ADMIN_EMAIL=dev@example.com SUPER_ADMIN_NAME="Dev Admin" SUPER_ADMIN_PASSWORD="change-me" pnpm run grant:super-admin
```

If the user already exists, only `SUPER_ADMIN_EMAIL` is required and the script will promote that user to global super-admin.

## 7) Configure HQ plugin in OpenClaw

```bash
cd /opt/hq/openclaw
pnpm openclaw plugins install -l /opt/hq/plugins/hq-missions
pnpm openclaw config set hooks.enabled true
pnpm openclaw config set hooks.token "<OPENCLAW_HOOKS_TOKEN>"
pnpm openclaw config set hooks.defaultSessionKey "hook:hq"
pnpm openclaw config set hooks.allowRequestSessionKey false
pnpm openclaw config set gateway.controlUi.allowedOrigins '["https://hq.example.com"]' --strict-json
pnpm openclaw config set plugins.entries.hq-missions.config.hqApiUrl "http://127.0.0.1:5174/api/trpc"
pnpm openclaw config set plugins.entries.hq-missions.config.hqApiToken "<AGENT_API_TOKEN>"
pnpm openclaw gateway restart || sudo systemctl restart openclaw-gateway
```

## 8) Run HQ as systemd service

Create `/etc/systemd/system/hq.service`:

```ini
[Unit]
Description=HQ Service
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/opt/hq
EnvironmentFile=/opt/hq/.dev.vars
ExecStart=/usr/bin/pnpm dev -- --host 127.0.0.1 --port 5174
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

If `pnpm` is not at `/usr/bin/pnpm`, replace `ExecStart` with:

```bash
which pnpm
```

Enable:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now hq
sudo systemctl status hq
```

If `systemctl` warns that the unit file changed on disk, run `sudo systemctl daemon-reload`
before restarting `hq`.

## 9) Reverse proxy (Nginx)

Proxy HQ to `127.0.0.1:5174` and OpenClaw Gateway WebSocket traffic to
`127.0.0.1:18789`:

```nginx
server {
  listen 80;
  server_name hq.example.com;

  location /gateway {
    proxy_pass http://127.0.0.1:18789;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }

  location / {
    proxy_pass http://127.0.0.1:5174;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

Enable the site:

```bash
sudo ln -sf /etc/nginx/sites-available/hq /etc/nginx/sites-enabled/hq
sudo nginx -t
sudo systemctl reload nginx
```

Then add TLS (Certbot):

```bash
sudo apt update
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d hq.example.com
```

Choose the HTTP -> HTTPS redirect when prompted.

## 9A) Local testing before DNS is ready

From your laptop:

```bash
ssh -N -L 5174:127.0.0.1:5174 -L 18789:127.0.0.1:18789 ubuntu@<EC2_PUBLIC_IP> -i <KEY>.pem
```

Open:

- `http://localhost:5174` (HQ)
- `http://localhost:18789` (OpenClaw)

For temporary tunnel testing, use these in `/opt/hq/.dev.vars`:

```env
BETTER_AUTH_URL=http://127.0.0.1:5174
ALLOWED_ORIGINS=http://127.0.0.1:5174,http://localhost:5174
VITE_GATEWAY_URL=ws://localhost:18789
```

After DNS + TLS is ready, switch them back to your public domain.

## 10) OpenClaw update process (new release)

### Preferred: keep repo-pinned submodule version

```bash
cd /opt/hq
git pull
git submodule sync --recursive
git submodule update --init --recursive

cd /opt/hq/openclaw
pnpm install
pnpm ui:build
pnpm build
pnpm openclaw doctor
pnpm openclaw gateway restart || sudo systemctl restart openclaw-gateway
```

### Optional: move submodule to latest upstream main

```bash
cd /opt/hq
git submodule update --remote --merge openclaw

cd /opt/hq/openclaw
pnpm install
pnpm ui:build
pnpm build
pnpm openclaw doctor
pnpm openclaw gateway restart || sudo systemctl restart openclaw-gateway
```

## 11) Post-deploy checks

```bash
curl -sS http://127.0.0.1:18789/healthz
curl -sS http://127.0.0.1:5174/api/health
curl -I http://hq.example.com
curl -I https://hq.example.com
curl -sS https://hq.example.com/api/health
sudo systemctl status hq
systemctl --user status openclaw-gateway.service --no-pager || sudo systemctl status openclaw-gateway --no-pager
```

Expected:

- OpenClaw health endpoint returns OK JSON.
- HQ `/api/health` returns `{ "ok": true }`.
- Public domain returns HTTP/HTTPS responses and `/api/health` works over HTTPS.
- `hq` systemd service is active.

## 12) Security reminders

- Rotate any secrets that were ever committed in `.env` / `.dev.vars`.
- Keep `hooks.token` separate from gateway auth token.
- Keep OpenClaw bound to loopback unless you intentionally expose it.

## 13) Learnings / Common fixes

- `corepack enable` permission issue (`EACCES /usr/bin/pnpm`):
  - Use `sudo corepack enable` and `sudo corepack prepare pnpm@10.23.0 --activate`.
- `git submodule` clone noise (`channel ... open failed`):
  - Retry with `--jobs 1` and `GIT_SSH_COMMAND='ssh -o ControlMaster=no -o ControlPath=none'`.
- `pnpm openclaw gateway install` may fail with `systemctl is-enabled unavailable` even when service exists:
  - Check `pnpm openclaw gateway status`; if running, continue.
- `hq.service` crash with `Could not resolve "@better-auth/drizzle-adapter"`:
  - Run `pnpm install` on latest repo (dependency is now in `package.json`).
- HQ websocket `NOT_PAIRED / DEVICE_IDENTITY_REQUIRED`:
  - Set `VITE_GATEWAY_URL=ws://localhost:18789`
  - Set `VITE_GATEWAY_TOKEN` to gateway token from `~/.openclaw/openclaw.json`
  - Restart `hq` service.
- Public HQ domain loads but gateway connect fails with `origin not allowed`:
  - Add `https://hq.example.com` to `gateway.controlUi.allowedOrigins`.
  - Restart the OpenClaw gateway.
- Public HQ domain requires gateway websocket proxying:
  - Nginx must proxy `/gateway` to `http://127.0.0.1:18789` with websocket headers.
- Public HQ domain requires HTTPS:
  - The browser-side gateway/device identity flow expects a secure context for remote access.
  - Use Certbot and set `VITE_GATEWAY_URL=wss://hq.example.com/gateway`.
- HQ service was updated but systemd still uses old unit:
  - Run `sudo systemctl daemon-reload` before `sudo systemctl restart hq`.
- Tunnel error `connect failed: Connection refused`:
  - Usually `hq` service is down on `127.0.0.1:5174`; check `sudo systemctl status hq`.
