# Agent Lists

Agent lists are flexible, agent-created tables for structured research or working sets. Use them when an agent needs to create a list whose columns are not known ahead of time, such as "Founders which have raised in 2024".

> **API**: To read and write lists/rows over HTTP, see [`agent-lists-api.md`](./agent-lists-api.md) (generated from the code via `npm run docs:agent-list-api`). The same schema is served live at the `custom.agentList.apiSchema` endpoint.

## Tables

### `agent_lists`

Stores the list definition.

- `title`: Human-readable list name.
- `description`: Optional context for why the list exists.
- `json_schema`: JSON Schema-style object that defines the row shape and frontend columns.
- `agent_id`: Optional id of the agent that created the list.
- `organization_id`: Optional organization scope.

### `agent_list_rows`

Stores individual rows in a list.

- `list_id`: Parent list.
- `data`: JSON object containing the row values.
- `sort_order`: Stable ordering value for frontend display.

When a list is deleted, its rows are deleted automatically.

## Recommended `json_schema`

Use an object schema where each property is a column. The frontend can use each property's `title` as the column label and the property key to read values from row `data`.

```json
{
  "type": "object",
  "properties": {
    "founder_name": {
      "type": "string",
      "title": "Founder"
    },
    "company": {
      "type": "string",
      "title": "Company"
    },
    "raised_amount": {
      "type": "string",
      "title": "Raised"
    },
    "funding_year": {
      "type": "number",
      "title": "Year"
    },
    "source_url": {
      "type": "string",
      "title": "Source URL",
      "format": "uri"
    }
  },
  "required": ["founder_name", "company"]
}
```

## Example row data

```json
{
  "founder_name": "Jane Doe",
  "company": "Acme AI",
  "raised_amount": "$8M seed",
  "funding_year": 2024,
  "source_url": "https://example.com/funding-announcement"
}
```

## Agent Guidelines

- Create one `agent_lists` record for each distinct table-like output.
- Put column definitions in `json_schema.properties`.
- Use stable snake_case keys for properties and row data.
- Keep every row's `data` aligned with the parent list's `json_schema`.
- Include source fields, such as `source_url` or `source_notes`, when claims should be auditable.
- Use `sort_order` when row order matters.
