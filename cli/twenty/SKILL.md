---
name: twenty-cli
description: Use the local Twenty CRM CLI in this repo for authenticated CRM reads and writes, schema discovery, raw operation access, and command-level smoke tests. Trigger this skill when the task is to use or extend `cli/twenty`, inspect Twenty OpenAPI-derived operations, automate CRM workflows through the CLI, or verify live Twenty behavior without calling the API ad hoc.
---

# Twenty CLI

Use this skill when the task should go through the local `twenty` CLI in this repo.

Prefer the CLI over ad hoc scripts or direct fetch calls when:
- The workflow already maps to `cli/twenty`
- Another agent or script needs stable JSON output
- The task involves Twenty resource operations, schema lookup, or operation discovery
- The task is to extend or test the CLI itself

## Where it lives

- CLI package: `cli/twenty`
- Entrypoint: `cli/twenty/bin/twenty`
- Main router: `cli/twenty/src/cli.ts`
- Generated OpenAPI metadata: `cli/twenty/src/generated`
- Resource command layer: `cli/twenty/src/commands/resources.ts`
- Raw API commands: `cli/twenty/src/commands/api.ts`
- Tests: `cli/twenty/tests`

Run commands from `cli/twenty` unless there is a reason not to:

```bash
cd cli/twenty
./bin/twenty help
```

From the repo root, `./cli/twenty/bin/twenty` is the safest explicit path.

## Working rules

- Prefer environment variables for live auth unless the user explicitly wants credentials persisted.
- Default output is JSON. Use `--human` only when a person asked for readable output.
- Treat destructive commands as opt-in. Use `--yes` only when the task clearly calls for mutation.
- Prefer curated resource commands first, then `api op`, then `api call`.
- If you modify the CLI, run `npm test --prefix ./cli/twenty` before finishing.

## Auth

Use env vars for ephemeral auth:

```bash
TWENTY_BASE_URL="https://crmkfd.voxxi.ai/rest/" \
TWENTY_TOKEN="..." \
./bin/twenty people list --query limit=1
```

Persist auth only if the user wants it:

```bash
./bin/twenty auth set --base-url "https://crmkfd.voxxi.ai/rest/" --token "$TWENTY_TOKEN"
./bin/twenty auth show
```

Supported env/config inputs:
- `TWENTY_BASE_URL`
- `TWENTY_TOKEN`
- `TWENTY_TIMEOUT_MS`
- `TWENTY_DEPTH`
- `TWENTY_LIMIT`
- `TWENTY_CONFIG_PATH`

## Commands to reach for first

### Curated resources

Use these for common CRM work:

```bash
./bin/twenty people list --query limit=10
./bin/twenty people get --id "<uuid>"
./bin/twenty people create --field firstName=Jane --field lastName=Doe
./bin/twenty opportunities list --query 'filter=name[like]:"%Deal%"'
./bin/twenty tasks update --id "<uuid>" --field title="Follow up"
./bin/twenty notes delete --id "<uuid>" --yes
```

Current curated groups:
- `people`
- `companies`
- `opportunities`
- `tasks`
- `notes`
- `workspace-members`

Shared patterns:
- `list`
- `get --id`
- `create`
- `update --id`
- `delete --id --yes`
- `restore --id --yes`
- `group-by`
- `duplicates`
- `merge --yes`

### Schema discovery

Use schema commands before guessing an operation or resource shape:

```bash
./bin/twenty schema operations
./bin/twenty schema resource people
```

Use these when an agent needs:
- a valid `operationId`
- request/response hints from generated metadata
- the curated actions available for a resource

### Raw operation access

Prefer `api op` when the operation exists in the generated registry:

```bash
./bin/twenty api op --operation-id findManyPeople --query limit=10
./bin/twenty api op --operation-id UpdateOnePerson --path-param id="<uuid>" --field city="Mumbai"
```

Use `api call` when you have a path and method already:

```bash
./bin/twenty api call --method GET --path /people --query limit=10
./bin/twenty api call --method POST --path /notes --data-file ./payload.json
```

Input rules:
- Use `--field key=value` for simple JSON bodies
- Use `--data` or `--data-file` for full JSON payloads
- Use `--data-file -` to read JSON from stdin
- Use `--query key=value` for query params
- Use `--path-param key=value` with `api op` for templated paths

## Extending the CLI

When adding or changing behavior:
- Keep command routing in `cli/twenty/src/cli.ts`
- Keep config/env resolution in `cli/twenty/src/core/config.ts`
- Keep HTTP concerns in `cli/twenty/src/providers/twenty/client.ts`
- Keep curated resource behavior in `cli/twenty/src/commands/resources.ts`
- Regenerate metadata with `node ./cli/twenty/scripts/generate-openapi-sdk.mjs` if the OpenAPI spec changed
- Do not hand-edit files under `cli/twenty/src/generated`

For new curated resource support:
- Add the resource in `cli/twenty/src/commands/definitions.ts`
- Reuse generated `operationId`s instead of hard-coding paths
- Preserve JSON-first output and explicit `--yes` safety for destructive actions

## Validation checklist

Before finishing work on `cli/twenty`:

```bash
npm test --prefix ./cli/twenty
./cli/twenty/bin/twenty help
./cli/twenty/bin/twenty schema resource people
```

If credentials are available, do one real smoke test with env vars and report the actual result:

```bash
TWENTY_BASE_URL="https://crmkfd.voxxi.ai/rest/" \
TWENTY_TOKEN="..." \
./cli/twenty/bin/twenty people list --query limit=1
```

For a new command, also run its help or a representative real invocation.
