import test from "node:test";
import assert from "node:assert/strict";

import { GoogleDeviceAuthClient } from "../src/providers/google/device-auth.ts";

test("startDeviceAuthorization returns verification details from Google", async () => {
  const client = new GoogleDeviceAuthClient(
    {
      clientId: "google-client-id",
      applicationType: "limited-input-device",
      scopes: ["scope:a"],
    },
    async (input, init) => {
      assert.equal(String(input), "https://oauth2.googleapis.com/device/code");
      assert.equal(init?.method, "POST");
      const body = String(init?.body);
      assert.match(body, /client_id=google-client-id/);
      assert.match(body, /scope=scope%3Aa/);

      return new Response(
        JSON.stringify({
          device_code: "device-code",
          user_code: "user-code",
          verification_url: "https://www.google.com/device",
          verification_uri_complete: "https://www.google.com/device?user_code=user-code",
          expires_in: 1800,
          interval: 5,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    },
  );

  const response = await client.startDeviceAuthorization();

  assert.equal(response.deviceCode, "device-code");
  assert.equal(response.userCode, "user-code");
  assert.equal(response.verificationUrl, "https://www.google.com/device");
  assert.equal(response.verificationUrlComplete, "https://www.google.com/device?user_code=user-code");
  assert.equal(response.interval, 5);
});

test("pollForTokens retries pending auth and returns token set", async () => {
  let callCount = 0;
  const client = new GoogleDeviceAuthClient(
    {
      clientId: "google-client-id",
      clientSecret: "google-client-secret",
      applicationType: "limited-input-device",
      scopes: ["scope:a"],
    },
    async (input, init) => {
      assert.equal(String(input), "https://oauth2.googleapis.com/token");
      assert.equal(init?.method, "POST");
      callCount += 1;

      if (callCount === 1) {
        return new Response(
          JSON.stringify({
            error: "authorization_pending",
          }),
          { status: 428, headers: { "Content-Type": "application/json" } },
        );
      }

      return new Response(
        JSON.stringify({
          access_token: "access-token",
          refresh_token: "refresh-token",
          token_type: "Bearer",
          scope: "scope:a scope:b",
          expires_in: 3600,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    },
  );

  const tokens = await client.pollForTokens({
    deviceCode: "device-code",
    intervalSeconds: 1,
    timeoutSeconds: 5,
  });

  assert.equal(callCount, 2);
  assert.equal(tokens.accessToken, "access-token");
  assert.equal(tokens.refreshToken, "refresh-token");
  assert.equal(tokens.tokenType, "Bearer");
  assert.deepEqual(tokens.scope, ["scope:a", "scope:b"]);
  assert.ok(tokens.expiryDate);
});
