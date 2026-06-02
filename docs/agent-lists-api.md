# Agent Lists API

> Generated from the tRPC Zod schemas. Do not edit by hand — run `npm run docs:agent-list-api`.
> The same definitions are served live at `custom.agentList.apiSchema`, which always reflects the deployed code.

Agent lists are flexible, agent-created tables. See `docs/agent-lists.md` for the data model and `json_schema` conventions.

## Connection

- **Base URL**: `/api/trpc`
- **Auth**: `Authorization: Bearer <AGENT_API_TOKEN>` header
- **Transport**: tRPC v11 with the superjson transformer.
  - **Query**: `GET /api/trpc/<method>?input=<urlencoded JSON>` where the JSON is `{"json": <args>}`.
  - **Mutation**: `POST /api/trpc/<method>` with header `Content-Type: application/json` and body `{"json": <args>}`.
  - The result is at `result.data.json` in the response body.

Example mutation:

```bash
curl -X POST https://<host>/api/trpc/custom.agentList.addRow \
  -H "Authorization: Bearer $AGENT_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"json":{"listId":1,"data":{"founder_name":"Jane Doe","company":"Acme AI"}}}'
```

## Row shape

A row's `data` keys come from its parent list's `json_schema.properties`. Fetch a list with `custom.agentList.get` to learn its columns before adding rows, and keep every row aligned with that schema.

## Operations

### `custom.agentList.list`

**query** — List all lists (optionally filter by agentId). Returns list metadata without rows.

Input schema:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "agentId": {
      "type": "string"
    }
  },
  "additionalProperties": false
}
```

### `custom.agentList.get`

**query** — Get one list including its rows, ordered by sortOrder.

Input schema:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "id": {
      "type": "integer",
      "exclusiveMinimum": 0,
      "maximum": 9007199254740991
    }
  },
  "required": [
    "id"
  ],
  "additionalProperties": false
}
```

### `custom.agentList.create`

**mutation** — Create a new list. Define columns in jsonSchema.properties.

Input schema:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "title": {
      "type": "string",
      "minLength": 1
    },
    "description": {
      "type": "string"
    },
    "jsonSchema": {
      "type": "object",
      "propertyNames": {
        "type": "string"
      },
      "additionalProperties": {}
    },
    "agentId": {
      "type": "string"
    },
    "organizationId": {
      "type": "string"
    }
  },
  "required": [
    "title",
    "jsonSchema"
  ],
  "additionalProperties": false
}
```

### `custom.agentList.update`

**mutation** — Update a list's title, description, or jsonSchema.

Input schema:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "id": {
      "type": "integer",
      "exclusiveMinimum": 0,
      "maximum": 9007199254740991
    },
    "title": {
      "type": "string",
      "minLength": 1
    },
    "description": {
      "anyOf": [
        {
          "type": "string"
        },
        {
          "type": "null"
        }
      ]
    },
    "jsonSchema": {
      "type": "object",
      "propertyNames": {
        "type": "string"
      },
      "additionalProperties": {}
    }
  },
  "required": [
    "id"
  ],
  "additionalProperties": false
}
```

### `custom.agentList.delete`

**mutation** — Delete a list and all of its rows (cascade).

Input schema:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "id": {
      "type": "integer",
      "exclusiveMinimum": 0,
      "maximum": 9007199254740991
    }
  },
  "required": [
    "id"
  ],
  "additionalProperties": false
}
```

### `custom.agentList.addRow`

**mutation** — Add a single row to a list. Keep data aligned with the list's jsonSchema.

Input schema:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "listId": {
      "type": "integer",
      "exclusiveMinimum": 0,
      "maximum": 9007199254740991
    },
    "data": {
      "type": "object",
      "propertyNames": {
        "type": "string"
      },
      "additionalProperties": {}
    },
    "sortOrder": {
      "type": "integer",
      "minimum": -9007199254740991,
      "maximum": 9007199254740991
    }
  },
  "required": [
    "listId",
    "data"
  ],
  "additionalProperties": false
}
```

### `custom.agentList.addRows`

**mutation** — Add many rows to a list in one call.

Input schema:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "listId": {
      "type": "integer",
      "exclusiveMinimum": 0,
      "maximum": 9007199254740991
    },
    "rows": {
      "minItems": 1,
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "data": {
            "type": "object",
            "propertyNames": {
              "type": "string"
            },
            "additionalProperties": {}
          },
          "sortOrder": {
            "type": "integer",
            "minimum": -9007199254740991,
            "maximum": 9007199254740991
          }
        },
        "required": [
          "data"
        ],
        "additionalProperties": false
      }
    }
  },
  "required": [
    "listId",
    "rows"
  ],
  "additionalProperties": false
}
```

### `custom.agentList.updateRow`

**mutation** — Update a single row's data and/or sortOrder.

Input schema:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "id": {
      "type": "integer",
      "exclusiveMinimum": 0,
      "maximum": 9007199254740991
    },
    "data": {
      "type": "object",
      "propertyNames": {
        "type": "string"
      },
      "additionalProperties": {}
    },
    "sortOrder": {
      "type": "integer",
      "minimum": -9007199254740991,
      "maximum": 9007199254740991
    }
  },
  "required": [
    "id"
  ],
  "additionalProperties": false
}
```

### `custom.agentList.deleteRow`

**mutation** — Delete a single row.

Input schema:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "id": {
      "type": "integer",
      "exclusiveMinimum": 0,
      "maximum": 9007199254740991
    }
  },
  "required": [
    "id"
  ],
  "additionalProperties": false
}
```
