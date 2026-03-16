# SEO CLI

## Goal

Build a sexy default CLI for AI agents to execute SEO tasks with a fast, predictable, script-friendly DX.

## Product Direction

- Start with one provider: DataForSEO.
- Start with one clear task: `seo page audit --page "https://example.com"`.
- Wrap more providers over time behind stable command contracts.
- Optimize for first principles: clarity, composability, useful defaults, and machine-friendly output.

## Design Principles

- Commands should be obvious, short, and consistent.
- Output should work for both humans and agents.
- Provider-specific complexity should stay behind internal adapters.
- Every new task should feel native to the same CLI.

## Initial Shape

- `src/commands/`: user-facing commands and subcommands.
- `src/providers/`: provider adapters such as DataForSEO.
- `src/core/`: shared execution, config, and output logic.
- `src/types/`: shared contracts between commands and providers.
- `tests/`: command and provider coverage.
