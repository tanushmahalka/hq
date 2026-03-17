import { readFile } from "node:fs/promises";

import type { FramerClient } from "./framer.ts";
import { CliError } from "./errors.ts";

export interface BasicNodeLike {
  id: string;
  name?: string | null;
  path?: string | null;
  collectionId?: string | null;
  originalId?: string | null;
  getChildren?: () => Promise<unknown[]>;
  getParent?: () => Promise<unknown | null>;
  getNodesWithType?: (type: string) => Promise<unknown[]>;
}

export interface TextNodeLike extends BasicNodeLike {
  getText: () => Promise<string>;
  setText: (value: string) => Promise<void>;
}

export interface WebPageLike extends BasicNodeLike {
  path: string | null;
  getNodesWithType: (type: string) => Promise<unknown[]>;
}

export interface CollectionLike {
  id: string;
  name: string;
  managedBy?: string;
  readonly?: boolean;
  getFields: () => Promise<FieldLike[]>;
  getItems: () => Promise<CollectionItemLike[]>;
}

export interface FieldLike {
  id: string;
  name: string;
  type: string;
}

export interface CollectionItemLike {
  id: string;
  slug: string;
  draft?: boolean;
  fieldData?: Record<string, unknown>;
  setAttributes: (attributes: Record<string, unknown>) => Promise<CollectionItemLike | null>;
}

export interface CodeFileLike {
  id: string;
  name: string;
  path: string;
  content: string;
  exports: readonly unknown[];
  versionId: string;
  setFileContent: (content: string) => Promise<CodeFileLike>;
}

export interface ValueOptions {
  value?: string;
  valueFile?: string;
}

export function isTextNodeLike(value: unknown): value is TextNodeLike {
  return hasFunction(value, "getText") && hasFunction(value, "setText");
}

export function isWebPageLike(value: unknown): value is WebPageLike {
  return hasStringOrNull(value, "path") && hasFunction(value, "getNodesWithType");
}

export async function listPages(framer: Pick<FramerClient, "getNodesWithType">): Promise<WebPageLike[]> {
  const pages = (await framer.getNodesWithType("WebPageNode")) as unknown[];
  return pages.filter(isWebPageLike).sort((left, right) => (left.path ?? "").localeCompare(right.path ?? ""));
}

export async function resolvePage(framer: Pick<FramerClient, "getNodesWithType">, pagePath: string): Promise<WebPageLike> {
  const pages = await listPages(framer);
  const exact = pages.find((page) => page.path === pagePath);
  if (exact) return exact;

  const normalized = pagePath.toLowerCase();
  const caseInsensitive = pages.find((page) => page.path?.toLowerCase() === normalized);
  if (caseInsensitive) return caseInsensitive;

  const candidates = pages.filter((page) => page.path?.toLowerCase().includes(normalized));
  if (candidates.length === 1) return candidates[0]!;

  if (candidates.length > 1) {
    throw new CliError(
      `Page path "${pagePath}" is ambiguous. Candidates: ${candidates.map((page) => page.path ?? page.id).join(", ")}`,
      2,
    );
  }

  throw new CliError(`Could not find a page with path "${pagePath}".`, 2);
}

export async function listTextNodesForPage(
  framer: Pick<FramerClient, "getNodesWithType">,
  pagePath: string,
): Promise<TextNodeLike[]> {
  const page = await resolvePage(framer, pagePath);
  const nodes = await page.getNodesWithType("TextNode");
  return nodes.filter(isTextNodeLike);
}

export async function resolveTextNodeTarget(
  framer: Pick<FramerClient, "getNode" | "getNodesWithType">,
  options: { nodeId?: string; pagePath?: string; name?: string },
): Promise<TextNodeLike> {
  if (options.nodeId) {
    const node = await framer.getNode(options.nodeId);
    if (!node) {
      throw new CliError(`Could not find node "${options.nodeId}".`, 2);
    }

    if (!isTextNodeLike(node)) {
      throw new CliError(`Node "${options.nodeId}" is not a text node.`, 2);
    }

    return node;
  }

  if (!options.pagePath || !options.name) {
    throw new CliError(`Text commands require either --node or the pair --page and --name.`, 2);
  }

  const textNodes = await listTextNodesForPage(framer, options.pagePath);
  const resolved = resolveNamedMatch(textNodes, options.name, (node) => node.name ?? "", "text node");

  return resolved;
}

export async function resolveCollection(
  framer: Pick<FramerClient, "getCollections">,
  reference: string,
): Promise<CollectionLike> {
  const collections = ((await framer.getCollections()) as unknown[]).filter(isCollectionLike);
  return resolveNamedMatch(collections, reference, (collection) => `${collection.id}\n${collection.name}`, "collection");
}

export async function resolveCollectionItem(
  collection: CollectionLike,
  reference: string,
): Promise<CollectionItemLike> {
  const items = (await collection.getItems()).filter(isCollectionItemLike);
  return resolveNamedMatch(items, reference, (item) => `${item.id}\n${item.slug}`, "collection item");
}

export async function resolveField(
  collection: CollectionLike,
  reference: string,
): Promise<FieldLike> {
  const fields = (await collection.getFields()).filter(isFieldLike);
  return resolveNamedMatch(fields, reference, (field) => `${field.id}\n${field.name}`, "field");
}

export async function resolveCodeFile(
  framer: Pick<FramerClient, "getCodeFiles">,
  reference: string,
): Promise<CodeFileLike> {
  const files = ((await framer.getCodeFiles()) as unknown[]).filter(isCodeFileLike);
  return resolveNamedMatch(files, reference, (file) => `${file.id}\n${file.path}\n${file.name}`, "code file");
}

export function inferNodeType(node: unknown): string {
  if (isTextNodeLike(node)) return "TextNode";
  if (isWebPageLike(node)) return "WebPageNode";
  if (hasString(node, "componentIdentifier")) return "ComponentNode";
  if (hasString(node, "svg")) return "SVGNode";
  return "Node";
}

export function serializeNode(node: unknown): Record<string, unknown> {
  const basicNode = node as BasicNodeLike;

  return {
    id: basicNode.id,
    type: inferNodeType(node),
    name: basicNode.name ?? null,
    path: basicNode.path ?? null,
    collectionId: basicNode.collectionId ?? null,
    originalId: basicNode.originalId ?? null,
  };
}

export function serializeCollection(collection: CollectionLike): Record<string, unknown> {
  return {
    id: collection.id,
    name: collection.name,
    managedBy: collection.managedBy ?? null,
    readonly: collection.readonly ?? null,
  };
}

export function serializeField(field: FieldLike): Record<string, unknown> {
  return {
    id: field.id,
    name: field.name,
    type: field.type,
  };
}

export function serializeCollectionItem(item: CollectionItemLike): Record<string, unknown> {
  return {
    id: item.id,
    slug: item.slug,
    draft: item.draft ?? false,
    fieldData: item.fieldData ?? {},
  };
}

export function serializeCodeFile(file: CodeFileLike): Record<string, unknown> {
  return {
    id: file.id,
    name: file.name,
    path: file.path,
    versionId: file.versionId,
    exportCount: file.exports.length,
  };
}

export function formatFieldValue(value: unknown): string {
  if (value === null) return "null";
  if (value === undefined) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return JSON.stringify(value);
}

export async function readInlineOrFileValue(options: ValueOptions): Promise<string> {
  if (options.value !== undefined && options.valueFile !== undefined) {
    throw new CliError(`Pass either an inline value or a file path, not both.`, 2);
  }

  if (options.valueFile !== undefined) {
    return readFile(options.valueFile, "utf8");
  }

  if (options.value !== undefined) {
    return options.value;
  }

  throw new CliError(`A value is required.`, 2);
}

export function parseJsonValue(value: string, description: string): unknown {
  try {
    return JSON.parse(value);
  } catch (error) {
    throw new CliError(`Could not parse ${description} as JSON: ${(error as Error).message}`, 2);
  }
}

function isCollectionLike(value: unknown): value is CollectionLike {
  return hasString(value, "id") && hasString(value, "name") && hasFunction(value, "getFields") && hasFunction(value, "getItems");
}

function isCollectionItemLike(value: unknown): value is CollectionItemLike {
  return hasString(value, "id") && hasString(value, "slug") && hasFunction(value, "setAttributes");
}

function isFieldLike(value: unknown): value is FieldLike {
  return hasString(value, "id") && hasString(value, "name") && hasString(value, "type");
}

function isCodeFileLike(value: unknown): value is CodeFileLike {
  return (
    hasString(value, "id") &&
    hasString(value, "name") &&
    hasString(value, "path") &&
    hasString(value, "content") &&
    hasFunction(value, "setFileContent") &&
    Array.isArray((value as { exports?: unknown[] }).exports)
  );
}

function resolveNamedMatch<T>(
  values: T[],
  reference: string,
  selector: (value: T) => string,
  label: string,
): T {
  const exactMatches = values.filter((value) => selector(value).split("\n").includes(reference));
  if (exactMatches.length === 1) return exactMatches[0]!;

  const normalizedReference = reference.toLowerCase();
  const caseInsensitiveMatches = values.filter((value) =>
    selector(value)
      .split("\n")
      .some((candidate) => candidate.toLowerCase() === normalizedReference),
  );
  if (caseInsensitiveMatches.length === 1) return caseInsensitiveMatches[0]!;

  const fuzzyMatches = values.filter((value) =>
    selector(value)
      .split("\n")
      .some((candidate) => candidate.toLowerCase().includes(normalizedReference)),
  );
  if (fuzzyMatches.length === 1) return fuzzyMatches[0]!;

  const candidates = [...exactMatches, ...caseInsensitiveMatches, ...fuzzyMatches];

  if (candidates.length > 1) {
    const uniqueCandidates = Array.from(new Set(candidates.map((value) => selector(value).split("\n")[0]!)));
    throw new CliError(`Ambiguous ${label} "${reference}". Candidates: ${uniqueCandidates.join(", ")}`, 2);
  }

  throw new CliError(`Could not find ${label} "${reference}".`, 2);
}

function hasFunction<T extends string>(value: unknown, key: T): value is Record<T, (...args: never[]) => unknown> {
  return typeof value === "object" && value !== null && typeof (value as Record<T, unknown>)[key] === "function";
}

function hasString<T extends string>(value: unknown, key: T): value is Record<T, string> {
  return typeof value === "object" && value !== null && typeof (value as Record<T, unknown>)[key] === "string";
}

function hasStringOrNull<T extends string>(value: unknown, key: T): value is Record<T, string | null> {
  return (
    typeof value === "object" &&
    value !== null &&
    (typeof (value as Record<T, unknown>)[key] === "string" || (value as Record<T, unknown>)[key] === null)
  );
}
