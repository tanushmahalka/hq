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
./bin/seo keywords list --site "sc-domain:example.com" --from "2026-03-01" --to "2026-03-07" --json
./bin/seo domain rating --domain "example.com" --json
./bin/seo domain rating --file "./domains.txt" --json
./bin/seo domain spam-score --domain "example.com" --json
./bin/seo domain spam-score sync-db --dry-run
./bin/seo geo brand-visibility --domain "example.com" --json
./bin/seo geo competitor-gap --domain "example.com" --vs "competitor-a.com" --vs "competitor-b.com"
./bin/seo geo prompt-audit --prompt "Best CRM for seed-stage startups" --domain "example.com" --brand "Example CRM" --json
./bin/seo geo source-gap --domain "example.com" --keyword "crm software" --keyword "sales ai"
./bin/seo geo topic-sizing --domain "example.com" --keyword "crm software" --keyword "sales ai" --json
./bin/seo geo citation-report --domain "example.com"
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

## Search Console Keywords

Use the Search Console API to fetch all available query rows for a property and date range. Pagination is handled internally.

```bash
./bin/seo keywords list \
  --site "sc-domain:example.com" \
  --from "2026-03-01" \
  --to "2026-03-07" \
  --json
```

Notes:

- `--site` must match the Search Console property identifier, such as `sc-domain:example.com` or `https://example.com/`.
- The CLI automatically pages through Search Console `searchAnalytics.query` results.
- If a refresh token is stored, the CLI refreshes expired Google access tokens automatically.

## Audit Endpoint

- Core audit: `on_page/instant_pages`

Use `--json` to print the full machine-friendly payload.

## Domain Rating

Use DataForSEO Backlinks `bulk_ranks/live` to fetch the current rank score for a domain.

```bash
./bin/seo domain rating --domain "example.com"
./bin/seo domain rating --domain "example.com" --domain "example.org"
./bin/seo domain rating --file "./domains.txt"
./bin/seo domain rating --domain "example.com" --scale 100 --json
```

Notes:

- The CLI normalizes domains to the format DataForSEO expects, without `https://` or leading `www.`.
- `--scale 1000` is the default and matches DataForSEO's default `rank_scale=one_thousand`.
- `--file` accepts newline-delimited text, a JSON array, or a JSON object like `{"domains":["example.com"]}`.
- Use `--file -` to read domains from stdin.
- The CLI batches rating lookups into chunks of 1000 targets per API call.

## Domain Spam Score

Use DataForSEO Backlinks `bulk_spam_score/live` to fetch spam scores for one or many domains.

```bash
./bin/seo domain spam-score --domain "example.com"
./bin/seo domain spam-score --file "./domains.txt" --json
```

Notes:

- `spam-score` supports the same `--file` formats as `rating`.
- The CLI batches spam score lookups into chunks of 1000 targets per API call.

### Sync Back to Postgres

Use the `sync-db` subcommand to read backlink source rows from Postgres in batches, resolve source domains, fetch spam scores from DataForSEO, and write `backlink_spam_score` back to `competitor_backlink_sources`.

```bash
./bin/seo domain spam-score sync-db --dry-run
./bin/seo domain spam-score sync-db --batch-size 5000
./bin/seo domain spam-score sync-db --from-id 250000 --limit 10000
```

Notes:

- `sync-db` uses `DATABASE_URL` by default, or `--database-url <url>`.
- It reads only the required columns: `id` and `source_url`.
- By default it updates only rows where `backlink_spam_score` is still `NULL`, which makes reruns naturally resumable.
- The DataForSEO requests are still batched at up to 1000 domains per API call under the hood.

## GEO Workflows

The `geo` group adds opinionated Generative Engine Optimization workflows on top of DataForSEO AI Optimization endpoints:

- `seo geo brand-visibility`
- `seo geo competitor-gap`
- `seo geo prompt-audit`
- `seo geo source-gap`
- `seo geo topic-sizing`
- `seo geo citation-report`

Notes:

- Mention-based workflows default to `--location-code 2840 --language-code en`.
- If you do not pass `--platform`, the CLI defaults to `google` and `chat_gpt` for US English, otherwise `google` only.
- DataForSEO `chat_gpt` mentions currently support only US English.
- `prompt-audit` defaults to `chatgpt`, `claude`, `gemini`, and `perplexity`, and uses `--json` for the full normalized payload.
