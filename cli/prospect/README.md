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
# Prefer listing/searching people first to collect Apollo IDs, then bulk enrich by id.
prospect apollo enrich people --data-file payload.json --json
prospect apollo api --method GET --path /api/v1/auth/health
```
