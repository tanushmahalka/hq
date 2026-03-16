# SEO CLI

JSON-first SEO tooling for AI agents.

## Commands

```bash
./bin/seo providers set dataforseo --login "$DATAFORSEO_LOGIN" --password "$DATAFORSEO_PASSWORD"
./bin/seo providers show dataforseo --json
./bin/seo page audit --page "https://example.com" --json
./bin/seo page audit --page "https://example.com" --page "https://example.com/pricing"
```

## Config

Provider config is stored at `~/.config/seo-cli/config.json` by default.

Environment variables override file config:

- `DATAFORSEO_LOGIN`
- `DATAFORSEO_PASSWORD`
- `DATAFORSEO_BASE_URL`
- `SEO_CLI_CONFIG_PATH`

## Audit Endpoint

- Core audit: `on_page/instant_pages`

Use `--json` to print the full machine-friendly payload.
