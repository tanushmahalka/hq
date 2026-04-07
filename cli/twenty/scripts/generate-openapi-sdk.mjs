#!/usr/bin/env node

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const projectDir = path.resolve(import.meta.dirname, "..");
const outputDir = path.join(projectDir, "src", "generated");
const specPath = process.env.TWENTY_OPENAPI_SPEC_PATH ?? "/Users/tanushmahalka/Downloads/core.json";

function toIdentifier(value) {
  return value.replace(/[^a-zA-Z0-9_$]/g, "_");
}

function sanitizeDescription(value) {
  return typeof value === "string" ? value.replace(/\r/g, "").trim() : undefined;
}

function unwrapRef(target, ref) {
  if (!ref || typeof ref !== "string" || !ref.startsWith("#/")) {
    throw new Error(`Unsupported $ref: ${String(ref)}`);
  }

  const parts = ref.slice(2).split("/");
  let current = target;
  for (const part of parts) {
    current = current?.[part];
  }

  if (!current) {
    throw new Error(`Failed to resolve $ref ${ref}`);
  }

  return current;
}

function resolveMaybeRef(root, value) {
  if (value && typeof value === "object" && "$ref" in value) {
    return unwrapRef(root, value.$ref);
  }

  return value;
}

function json(value) {
  return JSON.stringify(value, null, 2);
}

const raw = await readFile(specPath, "utf8");
const document = JSON.parse(raw);

const operations = [];
for (const [rawPath, pathItem] of Object.entries(document.paths ?? {})) {
  const resolvedPathItem = resolveMaybeRef(document, pathItem);
  const pathLevelParameters = (resolvedPathItem.parameters ?? []).map((param) => resolveMaybeRef(document, param));

  for (const [rawMethod, operation] of Object.entries(resolvedPathItem)) {
    if (rawMethod === "parameters") {
      continue;
    }

    const resolvedOperation = resolveMaybeRef(document, operation);
    const operationId = resolvedOperation.operationId;
    if (!operationId) {
      continue;
    }

    const parameters = [...pathLevelParameters, ...(resolvedOperation.parameters ?? []).map((param) => resolveMaybeRef(document, param))]
      .map((parameter) => {
        const schema = resolveMaybeRef(document, parameter.schema ?? {});
        return {
          name: parameter.name,
          in: parameter.in,
          required: Boolean(parameter.required),
          description: sanitizeDescription(parameter.description),
          schemaType: schema.type ?? (schema.enum ? "string" : undefined),
          enumValues: schema.enum ?? undefined,
          defaultValue: schema.default ?? undefined,
          minimum: schema.minimum ?? undefined,
          maximum: schema.maximum ?? undefined,
          format: schema.format ?? undefined,
        };
      });

    const requestBody = resolvedOperation.requestBody
      ? (() => {
          const resolvedBody = resolveMaybeRef(document, resolvedOperation.requestBody);
          const contentEntries = Object.entries(resolvedBody.content ?? {});
          const primary = contentEntries[0];
          const primarySchema = primary ? resolveMaybeRef(document, primary[1]?.schema ?? {}) : undefined;
          const schemaRef = primary?.[1]?.schema?.$ref;

          return {
            required: Boolean(resolvedBody.required),
            description: sanitizeDescription(resolvedBody.description),
            contentTypes: contentEntries.map(([contentType]) => contentType),
            schemaName: typeof schemaRef === "string" ? schemaRef.split("/").at(-1) : undefined,
            schemaType: primarySchema?.type ?? undefined,
            requiredProperties: primarySchema?.required ?? [],
            properties: primarySchema?.properties ? Object.keys(primarySchema.properties) : [],
          };
        })()
      : undefined;

    const responses = Object.entries(resolvedOperation.responses ?? {}).map(([statusCode, response]) => {
      const resolvedResponse = resolveMaybeRef(document, response);
      const contentEntries = Object.entries(resolvedResponse.content ?? {});
      const primary = contentEntries[0];
      const primarySchema = primary ? resolveMaybeRef(document, primary[1]?.schema ?? {}) : undefined;
      const schemaRef = primary?.[1]?.schema?.$ref;

      return {
        statusCode,
        description: sanitizeDescription(resolvedResponse.description),
        contentTypes: contentEntries.map(([contentType]) => contentType),
        schemaName: typeof schemaRef === "string" ? schemaRef.split("/").at(-1) : undefined,
        schemaType: primarySchema?.type ?? undefined,
      };
    });

    operations.push({
      operationId,
      method: rawMethod.toUpperCase(),
      path: rawPath,
      tags: resolvedOperation.tags ?? [],
      summary: sanitizeDescription(resolvedOperation.summary),
      description: sanitizeDescription(resolvedOperation.description),
      parameters,
      requestBody,
      responses,
    });
  }
}

operations.sort((left, right) => left.operationId.localeCompare(right.operationId));

const schemas = Object.entries(document.components?.schemas ?? {})
  .map(([name, schema]) => {
    const resolvedSchema = resolveMaybeRef(document, schema);
    return {
      name,
      type: resolvedSchema.type ?? "object",
      description: sanitizeDescription(resolvedSchema.description),
      requiredProperties: resolvedSchema.required ?? [],
      properties: resolvedSchema.properties ? Object.keys(resolvedSchema.properties) : [],
    };
  })
  .sort((left, right) => left.name.localeCompare(right.name));

const operationsById = Object.fromEntries(operations.map((operation) => [operation.operationId, operation]));
const operationsByTag = {};
for (const operation of operations) {
  for (const tag of operation.tags) {
    operationsByTag[tag] ??= [];
    operationsByTag[tag].push(operation.operationId);
  }
}
for (const value of Object.values(operationsByTag)) {
  value.sort();
}

const meta = {
  openapi: document.openapi,
  title: document.info?.title ?? "Twenty API",
  version: document.info?.version ?? "unknown",
  servers: (document.servers ?? []).map((server) => server.url),
  securitySchemes: Object.keys(document.components?.securitySchemes ?? {}),
  sourceSpecPath: specPath,
};

await mkdir(outputDir, { recursive: true });

const filePreamble = `/* eslint-disable */\n// Generated by cli/twenty/scripts/generate-openapi-sdk.mjs\n// Source: ${specPath}\n\n`;

await writeFile(
  path.join(outputDir, "operations.ts"),
  `${filePreamble}export interface GeneratedParameter {\n  name: string;\n  in: "path" | "query" | "header" | "cookie";\n  required: boolean;\n  description?: string;\n  schemaType?: string;\n  enumValues?: unknown[];\n  defaultValue?: unknown;\n  minimum?: number;\n  maximum?: number;\n  format?: string;\n}\n\nexport interface GeneratedRequestBody {\n  required: boolean;\n  description?: string;\n  contentTypes: string[];\n  schemaName?: string;\n  schemaType?: string;\n  requiredProperties: string[];\n  properties: string[];\n}\n\nexport interface GeneratedResponse {\n  statusCode: string;\n  description?: string;\n  contentTypes: string[];\n  schemaName?: string;\n  schemaType?: string;\n}\n\nexport interface GeneratedOperation {\n  operationId: string;\n  method: string;\n  path: string;\n  tags: string[];\n  summary?: string;\n  description?: string;\n  parameters: GeneratedParameter[];\n  requestBody?: GeneratedRequestBody;\n  responses: GeneratedResponse[];\n}\n\nexport const generatedOperations = ${json(operations)} as const satisfies readonly GeneratedOperation[];\n\nexport const generatedOperationsById = ${json(operationsById)} as const satisfies Record<string, GeneratedOperation>;\n\nexport const generatedOperationsByTag = ${json(operationsByTag)} as const satisfies Record<string, readonly string[]>;\n\nexport type GeneratedOperationId = keyof typeof generatedOperationsById;\n`,
  "utf8",
);

await writeFile(
  path.join(outputDir, "schemas.ts"),
  `${filePreamble}export interface GeneratedSchema {\n  name: string;\n  type: string;\n  description?: string;\n  requiredProperties: string[];\n  properties: string[];\n}\n\nexport const generatedSchemas = ${json(schemas)} as const satisfies readonly GeneratedSchema[];\n\nexport const generatedSchemaNames = ${json(schemas.map((schema) => schema.name))} as const;\n\nexport type GeneratedSchemaName = typeof generatedSchemaNames[number];\n`,
  "utf8",
);

await writeFile(
  path.join(outputDir, "meta.ts"),
  `${filePreamble}export const generatedOpenApiMeta = ${json(meta)} as const;\n`,
  "utf8",
);

await writeFile(
  path.join(outputDir, "index.ts"),
  `${filePreamble}export * from "./meta.ts";\nexport * from "./operations.ts";\nexport * from "./schemas.ts";\n`,
  "utf8",
);

process.stdout.write(`Generated Twenty SDK metadata from ${specPath}\n`);
