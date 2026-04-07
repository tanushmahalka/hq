# Twenty CLI

JSON-first Twenty CRM tooling for AI agents.

## Commands

```bash
./bin/twenty auth set --base-url "https://crmkfd.voxxi.ai/rest/" --token "$TWENTY_TOKEN"
./bin/twenty auth show
./bin/twenty context set --depth 1 --limit 25
./bin/twenty schema operations
./bin/twenty schema resource people
./bin/twenty people list --query limit=10
./bin/twenty people get --id "person-uuid"
./bin/twenty people create --field firstName=Jane --field lastName=Doe
./bin/twenty people update --id "person-uuid" --field firstName=Janet
./bin/twenty people delete --id "person-uuid" --yes
./bin/twenty opportunities list --query filter='name[like]:"%Deal%"'
./bin/twenty api call --method GET --path /people --query limit=10
./bin/twenty api op --operation-id findManyPeople --query limit=10
```

## Config

Config is stored at `~/.config/twenty-cli/config.json` by default.

Environment variables override file config:

- `TWENTY_CONFIG_PATH`
- `TWENTY_BASE_URL`
- `TWENTY_TOKEN`
- `TWENTY_TIMEOUT_MS`
- `TWENTY_DEPTH`
- `TWENTY_LIMIT`

## Generation

Generated SDK metadata is committed under `src/generated`.

Regenerate it from the Twenty OpenAPI spec with:

```bash
TWENTY_OPENAPI_SPEC_PATH=/Users/tanushmahalka/Downloads/core.json npm run generate --prefix ./cli/twenty
```

## Notes

- Output is JSON by default.
- Use `--human` for human-readable output.
- Destructive commands require `--yes`.
- Use `--data-file -` to read JSON request bodies from stdin.
