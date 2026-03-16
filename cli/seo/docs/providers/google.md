# Google OAuth Reference

For a CLI running on EC2 with a Google `Web application` client, the simplest setup is a manual copy-paste flow.

## Store Client Settings

```bash
./bin/seo providers set google \
  --client-id "$GOOGLE_OAUTH_CLIENT_ID" \
  --client-secret "$GOOGLE_OAUTH_CLIENT_SECRET" \
  --redirect-uri "https://auth.example.com/oauth/google/callback" \
  --application-type web \
  --scope "https://www.googleapis.com/auth/webmasters.readonly"
```

## Start Auth

```bash
./bin/seo providers auth google
```

The CLI returns a Google login URL and stores the pending `state` locally. Hand that URL to the user.

## Finish Auth

After Google redirects the user to your callback URL, have them paste the full final URL back to the agent:

```bash
./bin/seo providers exchange-code google \
  --callback-url "https://auth.example.com/oauth/google/callback?code=...&state=..."
```

## Example Flow

```text
1. Agent runs `seo providers auth google`
2. Agent sends `loginUrl` to the user
3. User signs in with Google
4. Google redirects user to `https://auth.example.com/oauth/google/callback?...`
5. User copies that final URL and sends it back
6. Agent runs `seo providers exchange-code google --callback-url "..."`
```

## Choosing The Google OAuth App Type

- Use `web` when your callback is a public HTTPS URL.
- Use `desktop` only when the app and browser are on the same machine and you are handling the callback locally.
