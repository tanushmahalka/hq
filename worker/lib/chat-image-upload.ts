import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import type { Env } from "../trpc/context.ts";

type S3ChatUploadConfig = {
  bucket: string;
  region: string;
  endpoint?: string;
  publicBaseUrl: string;
  accessKeyId: string;
  secretAccessKey: string;
};

export type ChatImageUploadResult = {
  url: string;
  key: string;
  contentType: string;
  size: number;
};

export class ChatImageUploadError extends Error {
  status: number;

  constructor(message: string, status = 500) {
    super(message);
    this.name = "ChatImageUploadError";
    this.status = status;
  }
}

const MIME_EXTENSION_MAP: Record<string, string> = {
  "image/apng": ".apng",
  "image/avif": ".avif",
  "image/gif": ".gif",
  "image/heic": ".heic",
  "image/heif": ".heif",
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/svg+xml": ".svg",
  "image/webp": ".webp",
};

function getConfig(env: Env): S3ChatUploadConfig {
  const missing = [
    ["S3_BUCKET", env.S3_BUCKET],
    ["S3_REGION", env.S3_REGION],
    ["S3_PUBLIC_BASE_URL", env.S3_PUBLIC_BASE_URL],
    ["S3_ACCESS_KEY_ID", env.S3_ACCESS_KEY_ID],
    ["S3_SECRET_ACCESS_KEY", env.S3_SECRET_ACCESS_KEY],
  ]
    .filter(([, value]) => !value)
    .map(([key]) => key);

  if (missing.length > 0) {
    throw new ChatImageUploadError(
      `Missing S3 upload configuration: ${missing.join(", ")}`,
      500,
    );
  }

  return {
    bucket: env.S3_BUCKET!,
    region: env.S3_REGION!,
    endpoint: env.S3_ENDPOINT_URL,
    publicBaseUrl: env.S3_PUBLIC_BASE_URL!,
    accessKeyId: env.S3_ACCESS_KEY_ID!,
    secretAccessKey: env.S3_SECRET_ACCESS_KEY!,
  };
}

function getExtension(contentType: string): string {
  return MIME_EXTENSION_MAP[contentType] ?? "";
}

function buildObjectKey(contentType: string): string {
  const date = new Date().toISOString().slice(0, 10);
  return `chat-images/${date}/${crypto.randomUUID()}${getExtension(contentType)}`;
}

function buildPublicUrl(baseUrl: string, key: string): string {
  const normalizedBase = baseUrl.replace(/\/+$/, "");
  const encodedKey = key
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return `${normalizedBase}/${encodedKey}`;
}

export async function uploadChatImageToS3(
  env: Env,
  file: File,
): Promise<ChatImageUploadResult> {
  if (!file.type.startsWith("image/")) {
    throw new ChatImageUploadError("Only image uploads are supported.", 400);
  }

  if (file.size <= 0) {
    throw new ChatImageUploadError("Image upload is empty.", 400);
  }

  const config = getConfig(env);
  const key = buildObjectKey(file.type);
  const body = Buffer.from(await file.arrayBuffer());
  const client = new S3Client({
    region: config.region,
    endpoint: config.endpoint,
    forcePathStyle: Boolean(config.endpoint),
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });

  try {
    await client.send(
      new PutObjectCommand({
        Bucket: config.bucket,
        Key: key,
        Body: body,
        ContentType: file.type,
        ACL: "public-read",
      }),
    );
  } catch (error) {
    throw new ChatImageUploadError(
      error instanceof Error ? error.message : "Failed to upload image.",
      502,
    );
  }

  return {
    url: buildPublicUrl(config.publicBaseUrl, key),
    key,
    contentType: file.type,
    size: body.byteLength,
  };
}
