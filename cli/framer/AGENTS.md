# Framer CLI

## Goal

Build a Framer CLI that AI agents can trust for high-signal inspection and narrowly scoped edits to existing Framer projects.

## Product Direction

- Optimize for safe automation over broad surface area.
- Prefer stable identifiers, clear error messages, and JSON output for agent workflows.
- Start with discovery, text edits, CMS edits, and code-file edits.
- Keep commands composable so they can later back an HQ plugin or agent tool wrapper.

## Design Principles

- Every command should work in both human-readable and `--json` mode.
- Mutations should require explicit targets and fail loudly on ambiguity.
- Read commands should help agents discover the next safe mutation.
- Keep Framer SDK quirks inside adapters and helpers.

## Initial Shape

- `src/commands/`: user-facing command groups.
- `src/core/`: argument parsing, connection handling, output, and resolution helpers.
- `tests/`: focused command coverage with fake Framer clients.
