---
name: seo-cli
description: Use the local SEO CLI in this repo for provider setup, page audits, keyword exports, GEO workflows, domain metrics, and keyword relevance classification. Trigger this skill when the task is to run or extend `cli/seo`, inspect its command contracts, or automate SEO workflows through the CLI instead of calling providers directly.
---

# SEO CLI

Use this skill when the task should go through the local `seo` CLI in this repo.

Prefer the CLI over ad hoc scripts when:
- The workflow already exists under `cli/seo/`
- The output needs to be script-friendly
- We want stable command contracts for agents
- We are adding or testing a new SEO automation path

## Where it lives

- CLI package: `cli/seo`
- Entrypoint: `cli/seo/bin/seo`
- Main router: `cli/seo/src/cli.ts`
- Provider config helpers: `cli/seo/src/core/config.ts`
- Tests: `cli/seo/tests`

Run commands from `cli/seo` unless there is a reason not to:

```bash
cd cli/seo
./bin/seo --help
```

If the repo root has the workspace package bins installed, `seo` may also work directly, but `./bin/seo` is the safest path inside this repo.

## Working rules

- Prefer machine-friendly output when another agent or script will consume the result.
- Use `--json` when a command exposes stable JSON output.
- For streaming record output, prefer JSONL-style commands over tables.
- When testing credentials live, prefer environment variables over saving secrets to config unless the user explicitly wants persistence.
- If you modify the CLI, run `npm test` in `cli/seo` before finishing.

## Provider setup

The CLI supports stored config plus env var overrides.

### DataForSEO

Persistent config:

```bash
./bin/seo providers set dataforseo --login "$DATAFORSEO_LOGIN" --password "$DATAFORSEO_PASSWORD"
```

Ephemeral config:

```bash
DATAFORSEO_LOGIN=... DATAFORSEO_PASSWORD=... ./bin/seo domain rating --domain example.com --json
```

### Google OAuth

Store credentials:

```bash
./bin/seo providers set google --client-id "$GOOGLE_OAUTH_CLIENT_ID" --client-secret "$GOOGLE_OAUTH_CLIENT_SECRET" --redirect-uri "$GOOGLE_OAUTH_REDIRECT_URI"
```

Inspect config:

```bash
./bin/seo providers show google --json
```

### OpenRouter

Use this for keyword relevance classification.

Persistent config:

```bash
./bin/seo providers set openrouter --api-key "$OPENROUTER_API_KEY"
```

Ephemeral config:

```bash
OPENROUTER_API_KEY=... ./bin/seo keywords classify-relevance --query "enterprise seo software" --brand "..."
```

## Commands to reach for first

### Page audit

```bash
./bin/seo page audit --page https://example.com --json
```

Use when an agent needs page-level SEO facts in one call.

### Search Console keyword export

```bash
./bin/seo keywords list --site sc-domain:example.com --from 2026-03-01 --to 2026-03-07 --json
```

Use when pulling query data from Google Search Console.

### Keyword relevance classification

Single query:

```bash
OPENROUTER_API_KEY=... ./bin/seo keywords classify-relevance \
  --query "enterprise seo software" \
  --brand "We sell B2B SEO software for in-house growth teams."
```

Current contract:
- Default model is `google/gemini-3.1-flash-lite-preview`
- Single-query output is JSON with `rationale` and `isRelevant`
- The model is prompted to return strict JSON with exactly those fields

Batch JSONL:

```bash
cat queries.jsonl | OPENROUTER_API_KEY=... ./bin/seo keywords classify-relevance \
  --jsonl - \
  --brand "We sell B2B SEO software for in-house growth teams."
```

Accepted JSONL inputs per line:
- A JSON string, for example `"enterprise seo software"`
- An object with `query`
- An object with `keyword`
- An object with `term`

Batch output contract:
- One JSON object per line
- Original fields are preserved
- A top-level `rationale: string` field is added
- A top-level `isRelevant: boolean` field is added

Example:

```json
{"query":"enterprise seo software","rationale":"Strong commercial fit for the product.","isRelevant":true}
{"query":"free meme generator","rationale":"The query is unrelated to the product and buyer.","isRelevant":false}
```

Use `--concurrency <n>` for batch runs. Keep it modest unless the user explicitly wants aggressive throughput.

### Domain metrics

```bash
./bin/seo domain rating --domain example.com --json
./bin/seo domain spam-score --domain example.com --json
```

Use these for backlink-quality and authority lookups.

### GEO workflows

Start with help:

```bash
./bin/seo geo --help
```

Current subcommands include:
- `brand-visibility`
- `competitor-gap`
- `prompt-audit`
- `source-gap`
- `topic-sizing`
- `citation-report`

## Extending the CLI

When adding a new command:
- Keep the UX consistent with existing commands in `cli/seo/src/cli.ts`
- Use `parseArgs` from `cli/seo/src/core/args.ts`
- Use `CliError` for user-facing failures
- Keep output stable and script-friendly
- Add command tests under `cli/seo/tests`

For provider-backed features:
- Put provider-specific HTTP logic under `cli/seo/src/providers`
- Keep command files thin
- Add config/env resolution in `cli/seo/src/core/config.ts` only when needed

## Validation checklist

Before finishing work on the CLI:

```bash
cd cli/seo
npm test
./bin/seo --help
```

For a new command, also run:

```bash
./bin/seo <group> <action> --help
```

If the feature is live and credentialed, do one real smoke test with env vars and report the actual output.
