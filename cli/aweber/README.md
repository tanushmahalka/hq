# AWeber CLI

JSON-first AWeber tooling for AI agents.

## Commands

```bash
./bin/aweber auth set --client-id "$AWEBER_CLIENT_ID" --client-type public
./bin/aweber auth show --json
./bin/aweber auth login --json
./bin/aweber auth exchange-code --code "returned-code" --json
./bin/aweber context set --account-id 123456 --list-id 789012 --json
./bin/aweber accounts list --json
./bin/aweber lists find --query name=Newsletter --json
./bin/aweber subscribers add --email "user@example.com" --field name="Jane Doe" --json
./bin/aweber subscribers find --query email=user@example.com --json
./bin/aweber broadcasts create --form subject="Hello" --form body_html="<p>Hi</p>" --form body_text="Hi" --json
./bin/aweber broadcasts schedule --broadcast-id 555 --scheduled-for "2026-03-20T14:30:00Z" --json
./bin/aweber campaigns stats --campaign-id 123 --json
./bin/aweber analytics broadcast-links --account-uuid "18b02362-8eaf-477c-9917-d447bbe618d5" --broadcast-uuid "78746ae5-b9bb-4faa-ac91-e8971fa878ae" --filter clicks --json
./bin/aweber api --method GET --path /accounts --json
```

## Config

Provider config is stored at `~/.config/aweber-cli/config.json` by default.

Environment variables override file config:

- `AWEBER_CONFIG_PATH`
- `AWEBER_CLIENT_ID`
- `AWEBER_CLIENT_SECRET`
- `AWEBER_REDIRECT_URI`
- `AWEBER_CLIENT_TYPE`
- `AWEBER_SCOPES`
- `AWEBER_ACCESS_TOKEN`
- `AWEBER_REFRESH_TOKEN`
- `AWEBER_ACCOUNT_ID`
- `AWEBER_LIST_ID`

## OAuth Flow

The default flow is a manual agent-friendly OAuth handoff:

1. Run `aweber auth login`.
2. Open the printed authorize URL.
3. Approve the app in AWeber.
4. Paste back either the returned code or the final callback URL.
5. Run `aweber auth exchange-code`.

Examples:

```bash
./bin/aweber auth set \
  --client-id "$AWEBER_CLIENT_ID" \
  --client-type public

./bin/aweber auth login
./bin/aweber auth exchange-code --code "returned-code"
```

For confidential clients with a real redirect URL:

```bash
./bin/aweber auth set \
  --client-id "$AWEBER_CLIENT_ID" \
  --client-secret "$AWEBER_CLIENT_SECRET" \
  --client-type confidential \
  --redirect-uri "https://auth.example.com/aweber/callback"

./bin/aweber auth login
./bin/aweber auth exchange-code --callback-url "https://auth.example.com/aweber/callback?code=...&state=..."
```

Notes:

- Public clients use PKCE automatically.
- Confidential clients use client secret auth and do not use PKCE.
- The CLI stores pending `state` and the PKCE verifier so pasted callbacks can be validated.
- Expired access tokens are refreshed automatically during API calls when a refresh token is available.

## Body Input

Commands accept payloads in a few ways:

- `--field key=value` for JSON bodies
- `--form key=value` for form-encoded bodies
- `--data '{...}'` or `--data-file ./payload.json` for raw JSON bodies
- `--query key=value` for extra query parameters, including advanced search filters

This keeps the explicit resource commands concise while still exposing the full AWeber API surface.

## Context Defaults

Save the account and list you use most often:

```bash
./bin/aweber context set --account-id 123456 --list-id 789012
```

Resolution order is:

1. Explicit CLI flags
2. Environment variables
3. Saved config defaults

## Webhooks

This CLI does not create or manage webhook subscriptions because AWeber’s public REST spec documents webhooks separately from the endpoint surface wrapped here.

Recommended usage:

- Create webhook subscriptions through your AWeber integration settings or the documented webhook setup flow.
- Point the webhook to an HTTPS endpoint you control.
- Validate and log incoming payloads server-side.
- Use this CLI for read/write API operations and token management around that webhook-driven workflow.

## References

- [AWeber API](https://api.aweber.com/)
- [AWeber OpenAPI spec](https://api.aweber.com/swagger.yaml)
- [AWeber OAuth 2 docs](https://api.aweber.com/docs/oauth2)
- [AWeber Webhooks docs](https://api.aweber.com/docs/webhooks)
