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
git clone --recurse-submodules git@github.com:<ORG_OR_USER>/hq.git /opt/hq
cd /opt/hq
git submodule sync --recursive
git submodule update --init --recursive
```

## 5) Build OpenClaw from submodule

```bash
cd /opt/hq/openclaw
pnpm install
pnpm ui:build
pnpm build
pnpm openclaw onboard --install-daemon
```

## 6) Install HQ

```bash
cd /opt/hq
npm install
```

Create `/opt/hq/.dev.vars` with production values (never commit secrets):

```env
DATABASE_URL=postgresql://...
BETTER_AUTH_SECRET=...
BETTER_AUTH_URL=https://hq.example.com
ADMIN_EMAILS=you@example.com
AGENT_API_TOKEN=...
ALLOWED_ORIGINS=https://hq.example.com
OPENCLAW_HOOKS_URL=http://127.0.0.1:18789
OPENCLAW_HOOKS_TOKEN=...
LOCAL_PG_ADMIN_URL=postgresql://postgres:password@localhost:5432/postgres
LEAD_AGENT_ID=jessica
```

Run DB schema sync:

```bash
cd /opt/hq
set -a
source /opt/hq/.dev.vars
set +a
npm run db:push
```

## 7) Configure HQ plugin in OpenClaw

```bash
cd /opt/hq/openclaw
pnpm openclaw plugins install -l /opt/hq/plugins/hq-missions
pnpm openclaw config set hooks.enabled true
pnpm openclaw config set hooks.token "<OPENCLAW_HOOKS_TOKEN>"
pnpm openclaw config set hooks.defaultSessionKey "hook:hq"
pnpm openclaw config set hooks.allowRequestSessionKey false
pnpm openclaw config set plugins.entries.hq-missions.config.hqApiUrl "http://127.0.0.1:5174/api/trpc"
pnpm openclaw config set plugins.entries.hq-missions.config.hqApiToken "<AGENT_API_TOKEN>"
pnpm openclaw gateway restart
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
ExecStart=/usr/bin/npm run dev -- --host 127.0.0.1 --port 5174
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Enable:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now hq
sudo systemctl status hq
```

## 9) Reverse proxy (Nginx)

Point your domain to port `5174` on loopback:

```nginx
server {
  listen 80;
  server_name hq.example.com;

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

Then add TLS (Certbot).

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
pnpm openclaw gateway restart
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
pnpm openclaw gateway restart
```

## 11) Post-deploy checks

```bash
curl -sS http://127.0.0.1:18789/healthz
curl -sS http://127.0.0.1:5174/api/health
sudo systemctl status hq
```

Expected:

- OpenClaw health endpoint returns OK JSON.
- HQ `/api/health` returns `{ "ok": true }`.
- `hq` systemd service is active.

## 12) Security reminders

- Rotate any secrets that were ever committed in `.env` / `.dev.vars`.
- Keep `hooks.token` separate from gateway auth token.
- Keep OpenClaw bound to loopback unless you intentionally expose it.
