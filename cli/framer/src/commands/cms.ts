import { getBooleanFlag, getOptionalIntegerFlag, getStringFlag, parseArgs } from "../core/args.ts";
import { CliError } from "../core/errors.ts";
import { withFramer, type SharedDependencies, SHARED_FLAG_SCHEMA } from "../core/framer.ts";
import { printJson, printLine } from "../core/output.ts";
import {
  formatFieldValue,
  parseJsonValue,
  readInlineOrFileValue,
  resolveCollection,
  resolveCollectionItem,
  resolveField,
  serializeCollection,
  serializeCollectionItem,
  serializeField,
  type FieldLike,
} from "../core/resolvers.ts";

const CMS_SCHEMA = {
  ...SHARED_FLAG_SCHEMA,
  "--collection": "string",
  "--content-type": "string",
  "--draft": "boolean",
  "--field": "string",
  "--item": "string",
  "--limit": "string",
  "--published": "boolean",
  "--value": "string",
  "--value-file": "string",
} as const;

export async function runCmsCommand(
  argv: string[],
  dependencies: SharedDependencies & {
    printJsonImpl?: typeof printJson;
    printLineImpl?: typeof printLine;
  } = {},
): Promise<void> {
  const [action, ...rest] = argv;
  const parsed = parseArgs(rest, CMS_SCHEMA);
  const printJsonImpl = dependencies.printJsonImpl ?? printJson;
  const printLineImpl = dependencies.printLineImpl ?? printLine;

  if (action === "help" || getBooleanFlag(parsed, "--help")) {
    printHelp(printLineImpl);
    return;
  }

  if (action !== "collections" && action !== "items" && action !== "update") {
    printHelp(printLineImpl);
    return;
  }

  await withFramer(
    parsed,
    async (framer) => {
      if (action === "collections") {
        const collections = await framer.getCollections();
        const payload = collections.map((collection) => serializeCollection(collection));

        if (getBooleanFlag(parsed, "--json")) {
          printJsonImpl(payload);
          return;
        }

        printLineImpl(`Found ${collections.length} collection(s)`);
        printLineImpl("");
        for (const collection of collections) {
          printLineImpl(`${collection.name}\t${collection.id}\t${collection.managedBy}`);
        }
        return;
      }

      const collectionRef = getStringFlag(parsed, "--collection");
      if (!collectionRef) {
        throw new CliError(`CMS commands require --collection <name-or-id>.`, 2);
      }

      const collection = await resolveCollection(framer, collectionRef);

      if (action === "items") {
        const limit = getOptionalIntegerFlag(parsed, "--limit");
        const items = await collection.getItems();
        const visibleItems = limit === undefined ? items : items.slice(0, limit);
        const payload = {
          collection: serializeCollection(collection),
          fields: (await collection.getFields()).map(serializeField),
          items: visibleItems.map(serializeCollectionItem),
        };

        if (getBooleanFlag(parsed, "--json")) {
          printJsonImpl(payload);
          return;
        }

        printLineImpl(`Collection: ${collection.name}`);
        printLineImpl(`Items: ${visibleItems.length}`);
        printLineImpl("");
        for (const item of visibleItems) {
          printLineImpl(`${item.slug}\t${item.id}\t${item.draft ? "draft" : "published"}`);
        }
        return;
      }

      if (action === "update") {
        const itemRef = getStringFlag(parsed, "--item");
        const fieldRef = getStringFlag(parsed, "--field");
        if (!itemRef || !fieldRef) {
          throw new CliError(`cms update requires --item <slug-or-id> and --field <field-name-or-id>.`, 2);
        }

        const item = await resolveCollectionItem(collection, itemRef);
        const field = await resolveField(collection, fieldRef);
        const draftFlag = getBooleanFlag(parsed, "--draft");
        const publishedFlag = getBooleanFlag(parsed, "--published");
        if (draftFlag && publishedFlag) {
          throw new CliError(`Pass either --draft or --published, not both.`, 2);
        }

        const rawValue = await readInlineOrFileValue({
          value: getStringFlag(parsed, "--value"),
          valueFile: getStringFlag(parsed, "--value-file"),
        });

        const fieldData = {
          [field.id]: coerceFieldData(field, rawValue, getStringFlag(parsed, "--content-type")),
        };

        const attributes: Record<string, unknown> = {
          fieldData,
        };

        if (draftFlag) {
          attributes.draft = true;
        } else if (publishedFlag) {
          attributes.draft = false;
        }

        const updated = await item.setAttributes(attributes);

        const payload = {
          collection: serializeCollection(collection),
          field: serializeField(field),
          item: serializeCollectionItem(updated ?? item),
        };

        if (getBooleanFlag(parsed, "--json")) {
          printJsonImpl(payload);
          return;
        }

        printLineImpl(`Updated ${collection.name}/${item.slug}`);
        printLineImpl(`Field: ${field.name}`);
        printLineImpl(`Value: ${formatFieldValue((fieldData[field.id] as { value?: unknown }).value)}`);
        return;
      }

      printHelp(printLineImpl);
    },
    dependencies,
  );
}

function coerceFieldData(field: FieldLike, rawValue: string, contentType?: string): Record<string, unknown> {
  switch (field.type) {
    case "boolean":
      return { type: field.type, value: coerceBoolean(rawValue) };
    case "number":
      return { type: field.type, value: coerceNumber(rawValue) };
    case "date":
      return { type: field.type, value: rawValue === "null" ? null : rawValue };
    case "enum":
    case "string":
    case "link":
      return { type: field.type, value: rawValue === "null" ? null : rawValue };
    case "formattedText":
      return {
        type: field.type,
        value: rawValue,
        ...(contentType ? { contentType } : {}),
      };
    case "color":
      return { type: field.type, value: rawValue === "null" ? null : rawValue };
    case "file":
    case "image":
    case "collectionReference":
      return { type: field.type, value: rawValue === "null" ? null : rawValue };
    case "multiCollectionReference": {
      const value = parseJsonValue(rawValue, `${field.name} value`);
      if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string")) {
        throw new CliError(`Field "${field.name}" expects a JSON array of string IDs.`, 2);
      }
      return { type: field.type, value };
    }
    case "array": {
      const value = parseJsonValue(rawValue, `${field.name} value`);
      if (!Array.isArray(value)) {
        throw new CliError(`Field "${field.name}" expects a JSON array payload.`, 2);
      }
      return { type: field.type, value };
    }
    default:
      throw new CliError(`Field type "${field.type}" is not supported by this CLI yet.`, 2);
  }
}

function coerceBoolean(value: string): boolean {
  if (value === "true") return true;
  if (value === "false") return false;
  throw new CliError(`Expected a boolean value of true or false.`, 2);
}

function coerceNumber(value: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new CliError(`Expected a numeric value.`, 2);
  }
  return parsed;
}

export function printHelp(printLineImpl: typeof printLine = printLine): void {
  printLineImpl("Framer CMS commands");
  printLineImpl("");
  printLineImpl("Usage:");
  printLineImpl("  framer cms collections [--json]");
  printLineImpl("  framer cms items --collection <name-or-id> [--limit <n>] [--json]");
  printLineImpl("  framer cms update --collection <name-or-id> --item <slug-or-id> --field <name-or-id> --value <value> [--draft|--published] [--json]");
}
