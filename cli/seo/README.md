# SEO CLI

JSON-first SEO tooling for AI agents.

## Commands

```bash
./bin/seo providers set dataforseo --login "$DATAFORSEO_LOGIN" --password "$DATAFORSEO_PASSWORD"
./bin/seo providers show dataforseo --json
./bin/seo providers set google --client-id "$GOOGLE_OAUTH_CLIENT_ID" --client-secret "$GOOGLE_OAUTH_CLIENT_SECRET" --redirect-uri "https://auth.example.com/oauth/google/callback"
./bin/seo providers auth google --json
./bin/seo providers exchange-code google --callback-url "https://auth.example.com/oauth/google/callback?code=..." --json
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

For an EC2-hosted CLI using a Google `Web application` client, the simplest setup is a manual handoff flow:

1. Run `seo providers auth google` to generate the login URL.
2. Give that URL to the user.
3. After Google redirects them, have them paste the final callback URL back to the agent.
4. Run `seo providers exchange-code google --callback-url "..."`

```bash
./bin/seo providers set google \
  --client-id "$GOOGLE_OAUTH_CLIENT_ID" \
  --client-secret "$GOOGLE_OAUTH_CLIENT_SECRET" \
  --redirect-uri "https://auth.example.com/oauth/google/callback" \
  --application-type web \
  --scope "https://www.googleapis.com/auth/webmasters.readonly"

./bin/seo providers auth google --prompt consent
./bin/seo providers exchange-code google --callback-url "https://auth.example.com/oauth/google/callback?code=...&state=..."
```

Notes:

- `--application-type web` is the right fit when you own an HTTPS callback URL.
- `seo providers auth google` stores the pending `state` and optional PKCE verifier in config so `exchange-code` can validate the pasted callback.
- `prompt=consent` is a good default if you want Google to issue a refresh token.

## Audit Endpoint

- Core audit: `on_page/instant_pages`

Use `--json` to print the full machine-friendly payload.
