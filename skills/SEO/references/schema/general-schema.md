# General Schema

Use these agent orchestration tables.

## 1) `tasks`

Agent workflow queue.

```sql
tasks (
  id UUID PRIMARY KEY,
  site_id UUID NOT NULL REFERENCES sites(id),
  task_type TEXT NOT NULL,               -- audit | content_brief | publish | internal_linking | outreach | review_response | technical_fix
  priority INTEGER NOT NULL,
  status TEXT NOT NULL,                  -- queued | running | blocked | awaiting_approval | done | failed
  related_page_id UUID REFERENCES pages(id),
  related_campaign_id UUID REFERENCES outreach_campaigns(id),
  assigned_agent TEXT,                   -- orchestrator | technical | content | offpage | qa
  requires_human_approval BOOLEAN NOT NULL DEFAULT false,
  payload JSONB,
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL
)
```

## 2) `approvals`

For high-risk actions.

```sql
approvals (
  id UUID PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES tasks(id),
  requested_by_agent TEXT NOT NULL,
  status TEXT NOT NULL,                  -- pending | approved | rejected
  approver TEXT,
  decision_note TEXT,
  requested_at TIMESTAMP NOT NULL,
  decided_at TIMESTAMP
)
```

## 3) `experiments`

For CTR, title, snippet, page update, or outreach experiments.

```sql
experiments (
  id UUID PRIMARY KEY,
  site_id UUID NOT NULL REFERENCES sites(id),
  page_id UUID REFERENCES pages(id),
  experiment_type TEXT NOT NULL,         -- title_test | meta_test | content_refresh | internal_links | outreach_angle
  hypothesis TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE,
  status TEXT NOT NULL,                  -- planned | running | completed | invalidated
  primary_metric TEXT NOT NULL,          -- ctr | clicks | conversions | referring_domains
  result_summary TEXT
)
```

## 4) `alerts`

For anomaly detection.

```sql
alerts (
  id UUID PRIMARY KEY,
  site_id UUID NOT NULL REFERENCES sites(id),
  alert_type TEXT NOT NULL,              -- traffic_drop | indexing_issue | lost_links | review_spike_negative | cwv_regression
  severity TEXT NOT NULL,                -- low | medium | high | critical
  entity_type TEXT NOT NULL,             -- site | page | campaign | profile
  entity_id UUID,
  message TEXT NOT NULL,
  triggered_at TIMESTAMP NOT NULL,
  resolved_at TIMESTAMP
)
```

## Minimum necessary indexes

```sql
CREATE INDEX idx_tasks_status_priority ON tasks(status, priority);
CREATE INDEX idx_alerts_site_triggered ON alerts(site_id, triggered_at);
```

## What not to add

Do **not** add:

* agent chat history
