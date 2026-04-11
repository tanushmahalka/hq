---
name: prospect-cli
description: Use the local Prospect CLI in this repo for prospect search, account lookup, enrichment, Apollo provider access, API usage checks, and command-level smoke tests. Trigger this skill when the task is to use or extend `cli/prospect`, run prospecting/enrichment workflows through the CLI, inspect Apollo-backed behavior, or verify live Prospect output without writing ad hoc scripts.
---

# Prospect CLI

Use this skill when the task should go through the local `prospect` CLI in this repo.

Prefer the CLI over direct fetch calls when:
- The workflow already maps to `cli/prospect`
- Another agent needs stable CLI output instead of provider-specific ad hoc code
- The task is to use or extend the Prospect CLI itself
- The task involves Apollo-backed prospect search, enrichment, or usage checks

## Where it lives

- CLI package: `cli/prospect`
- Entrypoint: `cli/prospect/bin/prospect`
- Main router: `cli/prospect/src/cli.ts`
- Normalized commands: `cli/prospect/src/commands/find.ts`, `cli/prospect/src/commands/enrich.ts`
- Apollo commands: `cli/prospect/src/commands/apollo.ts`
- Provider code: `cli/prospect/src/providers`
- Tests: `cli/prospect/tests`

Run commands from the repo root unless there is a reason not to:

```bash
npm run prospect -- help
```

The safest explicit path is:

```bash
./cli/prospect/bin/prospect help
```

If the CLI is installed globally, `prospect ...` is fine.

## Working rules

- Prefer environment variables for live auth unless the user explicitly wants credentials persisted.
- Prefer `--json` for agent workflows.
- Prefer normalized commands first, Apollo-specific commands second, and raw `apollo api` last.
- Keep usage output narrow. Prefer `prospect apollo usage --match <fragment> --json` over the full usage payload.
- If you modify the CLI, run `node --experimental-strip-types cli/prospect/tests/commands.test.ts` before finishing.

## Auth

Use env vars for ephemeral auth:

```bash
APOLLO_API_KEY="..." \
./cli/prospect/bin/prospect find person --email jane@acme.com --json
```

Persist auth only if the user wants it:

```bash
./cli/prospect/bin/prospect auth set apollo --api-key "$APOLLO_API_KEY"
./cli/prospect/bin/prospect auth show
```

Supported env/config inputs:
- `APOLLO_API_KEY`
- `APOLLO_BASE_URL`
- `PROSPECT_TIMEOUT_MS`
- `PROSPECT_CONFIG_PATH`

## Commands to reach for first

### Normalized commands

Use these for the stable, agent-friendly surface:

```bash
./cli/prospect/bin/prospect find person --email jane@acme.com --json
./cli/prospect/bin/prospect find account --domain acme.com --json
./cli/prospect/bin/prospect find number --email jane@acme.com --json --debug
./cli/prospect/bin/prospect enrich person --email jane@acme.com --json
./cli/prospect/bin/prospect enrich account --domain acme.com --json
```

Input rules:
- `find person`: `--email`, `--linkedin-url`, or `--name` with `--domain` or `--company`
- `find account`: `--domain` or `--name`
- `find number`: same identity rules as `find person`
- `enrich person`: `--email`, `--linkedin-url`, or `--name` with `--domain`
- `enrich account`: `--domain` or `--name`

Shared flags:
- `--provider apollo`
- `--json`
- `--raw`
- `--debug`
- `--timeout-ms`

### Apollo-specific commands

Use these when the task is explicitly Apollo-shaped or when the normalized layer is too narrow:

```bash
./cli/prospect/bin/prospect apollo find person --email jane@acme.com --json
./cli/prospect/bin/prospect apollo find account --domain acme.com --json
./cli/prospect/bin/prospect apollo find number --email jane@acme.com --json
./cli/prospect/bin/prospect apollo enrich person --email jane@acme.com --json
./cli/prospect/bin/prospect apollo enrich account --domain acme.com --json
```

Use `apollo api` only when a command does not exist yet:

```bash
./cli/prospect/bin/prospect apollo api --method POST --path /api/v1/mixed_people/search --field email=jane@acme.com
```

### Apollo usage

Use this to inspect rate limits or remaining endpoint budget:

```bash
./cli/prospect/bin/prospect apollo usage --match mixed_people --json
./cli/prospect/bin/prospect apollo usage --match people --json
./cli/prospect/bin/prospect apollo usage --match organizations --json
```

Guidance:
- Prefer `--match mixed_people` for prospect search flows
- Prefer `--match people` for enrichment or person-match flows
- Prefer `--match organizations` for account lookup and organization enrichment
- Avoid the unfiltered usage command in agent workflows unless the user explicitly wants the full Apollo surface

## Behavior notes

- Human output is for operators. Agents should usually use `--json`.
- `find number` is sync-first. Apollo may return a partial result with `pending_async_enrichment` instead of an immediate phone value.
- When debugging provider behavior, compare normalized `find`/`enrich` output with `prospect apollo ... --json`.
- For usage checks, filter early so the agent only reads the relevant endpoint family.

## Extending the CLI

When changing behavior:
- Keep top-level routing in `cli/prospect/src/cli.ts`
- Keep config/env resolution in `cli/prospect/src/core/config.ts`
- Keep Apollo transport and errors in `cli/prospect/src/providers/apollo`
- Keep normalized command behavior in `cli/prospect/src/commands/find.ts` and `cli/prospect/src/commands/enrich.ts`
- Keep provider-specific command UX in `cli/prospect/src/commands/apollo.ts`

When adding new provider support:
- Preserve the provider abstraction in `cli/prospect/src/providers/index.ts`
- Do not leak provider-specific shapes into normalized command parsing
- Preserve `--json` output stability for agents

## Validation checklist

Before finishing work on `cli/prospect`:

```bash
node --experimental-strip-types cli/prospect/tests/commands.test.ts
./cli/prospect/bin/prospect help
./cli/prospect/bin/prospect apollo usage --match mixed_people
```

If live credentials are available, also run one real smoke test:

```bash
APOLLO_API_KEY="..." \
./cli/prospect/bin/prospect find person --email jane@acme.com --json
```
