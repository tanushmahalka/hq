import { CliError } from "../../core/errors.ts";
import type { GoogleOAuthTokenSet, ResolvedGoogleOAuthProviderConfig } from "../../types/config.ts";

const GOOGLE_DEVICE_CODE_URL = "https://oauth2.googleapis.com/device/code";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";

interface GoogleDeviceCodeResponse {
  device_code: string;
  user_code: string;
  expires_in: number;
  interval?: number;
  verification_url?: string;
  verification_uri?: string;
  verification_uri_complete?: string;
}

interface GoogleDeviceTokenResponse {
  access_token: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
  token_type: string;
}

interface GoogleOAuthErrorResponse {
  error: string;
  error_description?: string;
}

export interface GoogleDeviceAuthorizationRequest {
  scopes?: string[];
}

export interface GoogleDeviceAuthorizationResponse {
  deviceCode: string;
  userCode: string;
  verificationUrl: string;
  verificationUrlComplete?: string;
  expiresIn: number;
  interval: number;
}

export interface GoogleDevicePollOptions {
  deviceCode: string;
  intervalSeconds: number;
  timeoutSeconds: number;
}

export class GoogleAuthorizationPendingError extends Error {
  constructor() {
    super("authorization_pending");
    this.name = "GoogleAuthorizationPendingError";
  }
}

export class GoogleSlowDownError extends Error {
  constructor() {
    super("slow_down");
    this.name = "GoogleSlowDownError";
  }
}

export class GoogleDeviceAuthClient {
  constructor(
    private readonly config: ResolvedGoogleOAuthProviderConfig,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async startDeviceAuthorization(
    request: GoogleDeviceAuthorizationRequest = {},
  ): Promise<GoogleDeviceAuthorizationResponse> {
    const scopes = request.scopes ?? this.config.scopes;
    const response = await this.fetchImpl(GOOGLE_DEVICE_CODE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: this.config.clientId,
        scope: scopes.join(" "),
      }),
    });

    const payload = await parseGoogleResponse<GoogleDeviceCodeResponse>(response);

    return {
      deviceCode: payload.device_code,
      userCode: payload.user_code,
      verificationUrl: payload.verification_url ?? payload.verification_uri ?? "https://www.google.com/device",
      verificationUrlComplete: payload.verification_uri_complete,
      expiresIn: payload.expires_in,
      interval: payload.interval ?? 5,
    };
  }

  async pollForTokens(options: GoogleDevicePollOptions): Promise<GoogleOAuthTokenSet> {
    const startedAt = Date.now();
    let pollIntervalMs = options.intervalSeconds * 1000;

    while (Date.now() - startedAt < options.timeoutSeconds * 1000) {
      try {
        return await this.requestTokens(options.deviceCode);
      } catch (error) {
        if (error instanceof GoogleAuthorizationPendingError) {
          await sleep(pollIntervalMs);
          continue;
        }

        if (error instanceof GoogleSlowDownError) {
          pollIntervalMs += 5000;
          await sleep(pollIntervalMs);
          continue;
        }

        throw error;
      }
    }

    throw new CliError("Google device authorization timed out before the user completed sign-in.", 2);
  }

  private async requestTokens(deviceCode: string): Promise<GoogleOAuthTokenSet> {
    const body = new URLSearchParams({
      client_id: this.config.clientId,
      device_code: deviceCode,
      grant_type: "urn:ietf:params:oauth:grant-type:device_code",
    });

    if (this.config.clientSecret) {
      body.set("client_secret", this.config.clientSecret);
    }

    const response = await this.fetchImpl(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });

    if (!response.ok) {
      const errorPayload = (await safeParseError(response)) ?? {
        error: `http_${response.status}`,
        error_description: response.statusText,
      };
      throw mapGoogleTokenError(errorPayload);
    }

    const payload = (await response.json()) as GoogleDeviceTokenResponse;

    return {
      accessToken: payload.access_token,
      refreshToken: payload.refresh_token,
      tokenType: payload.token_type,
      scope: payload.scope?.split(" ").filter(Boolean) ?? this.config.scopes,
      expiryDate: payload.expires_in ? new Date(Date.now() + payload.expires_in * 1000).toISOString() : undefined,
    };
  }
}

async function parseGoogleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const errorPayload = (await safeParseError(response)) ?? {
      error: `http_${response.status}`,
      error_description: response.statusText,
    };
    throw new CliError(`Google OAuth request failed: ${formatGoogleError(errorPayload)}`, 2);
  }

  return (await response.json()) as T;
}

async function safeParseError(response: Response): Promise<GoogleOAuthErrorResponse | null> {
  try {
    return (await response.json()) as GoogleOAuthErrorResponse;
  } catch {
    return null;
  }
}

function mapGoogleTokenError(error: GoogleOAuthErrorResponse): Error {
  if (error.error === "authorization_pending") {
    return new GoogleAuthorizationPendingError();
  }

  if (error.error === "slow_down") {
    return new GoogleSlowDownError();
  }

  if (error.error === "access_denied") {
    return new CliError("Google OAuth access was denied by the user.", 2);
  }

  if (error.error === "expired_token") {
    return new CliError("Google device code expired before sign-in completed. Start the auth flow again.", 2);
  }

  return new CliError(`Google OAuth token request failed: ${formatGoogleError(error)}`, 2);
}

function formatGoogleError(error: GoogleOAuthErrorResponse): string {
  return error.error_description ? `${error.error} (${error.error_description})` : error.error;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
