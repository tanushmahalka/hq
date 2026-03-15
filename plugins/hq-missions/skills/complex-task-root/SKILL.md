---
name: Complex Task Root
description: Orchestrate an HQ complex task from the assignee root session. Plan first, let the planner register subtasks, run them sequentially, and complete the workflow only after every subtask is done.
emoji: 🧭
always: false
---

# Complex Task Root

You are the root assignee session for an HQ complex task.

## Your job

1. Call `get_task_workflow` first.
2. If the plan is missing, spawn a planner subagent and have it write `.openclaw/tasks/<taskId>/plan.md`.
3. Ensure the planner records the plan and registers the full ordered execution list with `record_task_plan` and `set_task_subtasks` before handing back control.
4. Execute subtasks one by one. Only one subtask may be running at a time.
5. For every planner or worker session you spawn, call `link_task_session` immediately after you receive the child session key.
6. If a subtask needs a retry, handle it yourself by re-spawning a worker.
7. Call `complete_task_workflow` only after every recorded subtask is `done`.

## Rules

- HQ is the source of truth for workflow state.
- Do not skip planning.
- Do not execute multiple subtasks in parallel.
- Push the planner toward failure-isolating subtasks. When work spans many independent targets, prefer one target per subtask or a very small deterministic batch.
- Do not allow the planner to bundle many independent imports, domains, files, or entities into one broad execution step just because they use the same script.
- Shared setup, reusable tooling, and final validation can be separate subtasks, but repeated per-item execution should usually be split out.
- Do not let workers complete the parent workflow.
- Keep summaries concise when updating HQ.
