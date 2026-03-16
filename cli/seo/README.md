# SEO CLI

JSON-first SEO tooling for AI agents.

## Commands

```bash
./bin/seo providers set dataforseo --login "$DATAFORSEO_LOGIN" --password "$DATAFORSEO_PASSWORD"
./bin/seo providers show dataforseo --json
./bin/seo providers set google --client-id "$GOOGLE_OAUTH_CLIENT_ID" --application-type limited-input-device
./bin/seo providers auth google
./bin/seo page audit --page "https://example.com" --json
./bin/seo page audit --page "https://example.com" --page "https://example.com/pricing"
```

## Config

Provider config is stored at `~/.config/seo-cli/config.json` by default.

Environment variables override file config:

- `DATAFORSEO_LOGIN`
- `DATAFORSEO_PASSWORD`
- `DATAFORSEO_BASE_URL`
- `GOOGLE_OAUTH_CLIENT_ID`
- `GOOGLE_OAUTH_CLIENT_SECRET`
- `GOOGLE_OAUTH_REDIRECT_URI`
- `GOOGLE_OAUTH_APPLICATION_TYPE`
- `GOOGLE_OAUTH_SCOPES`
- `SEO_CLI_CONFIG_PATH`

## Google OAuth

For an EC2-hosted CLI, prefer Google device flow. Store the client ID with `seo providers set google`, then run `seo providers auth google` and hand the verification URL and user code to the user.

```bash
./bin/seo providers set google \
  --client-id "$GOOGLE_OAUTH_CLIENT_ID" \
  --application-type limited-input-device \
  --scope "https://www.googleapis.com/auth/webmasters.readonly"

./bin/seo providers auth google
```

Use the older redirect flow only when you control an HTTPS callback URL:

- `--application-type web` is the right fit when you own a backend callback endpoint.
- `--application-type desktop` is the right fit for a native installed-app flow on the same machine as the browser.
- `seo providers login-url google` still supports that redirect-based flow and requires `--redirect-uri`.

## Audit Endpoint

- Core audit: `on_page/instant_pages`

Use `--json` to print the full machine-friendly payload.
