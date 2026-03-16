# Google OAuth Reference

For a CLI running on EC2, the best default is Google device authorization. That avoids localhost callbacks and lets a non-technical user approve access from their own browser.

## Device Flow On EC2

```bash
./bin/seo providers set google \
  --client-id "$GOOGLE_OAUTH_CLIENT_ID" \
  --application-type limited-input-device \
  --scope "https://www.googleapis.com/auth/webmasters.readonly"

./bin/seo providers auth google
```

The CLI will print:

```text
Verification URL: https://www.google.com/device
User Code: XXXX-XXXX
Waiting for the user to approve access...
```

Once the user approves access, the CLI stores the Google tokens in the normal config file.

## Redirect Flow

Use redirect-based OAuth only when you control the callback destination:

```bash
./bin/seo providers set google \
  --client-id "$GOOGLE_OAUTH_CLIENT_ID" \
  --client-secret "$GOOGLE_OAUTH_CLIENT_SECRET" \
  --redirect-uri "https://app.example.com/oauth/google/callback" \
  --application-type web

./bin/seo providers login-url google --prompt consent --pkce --json
```

## Choosing The Google OAuth App Type

- Use `limited-input-device` for an EC2-hosted CLI that asks the user to visit Google’s verification page and enter a code.
- Use `web` when your backend owns a fixed HTTPS redirect URI.
- Use `desktop` when the OAuth callback is handled locally on the same machine as the running app.
