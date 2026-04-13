# Prospect CLI

Find and enrich prospecting data across providers.

## Install

```bash
npm install -g ./cli/prospect
```

## Usage

```bash
prospect help
prospect auth set apollo --api-key YOUR_APOLLO_API_KEY
prospect find person --email jane@acme.com --json
prospect find account --domain acme.com --json
prospect find number --email jane@acme.com --json --debug
prospect enrich person --email jane@acme.com --json
# Apollo-specific enrichment controls map directly to the documented People Enrichment endpoint.
prospect apollo enrich person --id 587cf802f65125cad923a266 --reveal-personal-emails --json
# Let the CLI create a temporary webhook receiver and Cloudflare tunnel, then wait for Apollo's async callback.
prospect apollo enrich person --email jane@acme.com --reveal-phone-number --wait --json
# Prefer listing/searching people first to collect Apollo IDs, then bulk enrich by id.
prospect apollo enrich people --detail 'id=64a7ff0cc4dfae00013df1a5' --detail 'id=64a7ff0cc4dfae00013df1a6' --json
prospect apollo api --method GET --path /api/v1/auth/health
```
