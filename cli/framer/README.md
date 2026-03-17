# Framer CLI

Framer tooling for AI agents.

This CLI wraps Framer's public Server API so agents can inspect projects and make targeted updates to existing pages, CMS items, and code files without browser automation.

## Requirements

- Node.js 22+ or Bun
- A Framer project URL or project ID
- A Framer API key for that project

You can pass credentials as flags or environment variables:

- `FRAMER_PROJECT_URL`
- `FRAMER_API_KEY`

## Commands

```bash
./bin/framer project info --json
./bin/framer project publish-info
./bin/framer pages list
./bin/framer nodes list --page /pricing --type TextNode --json
./bin/framer nodes get --node abc123
./bin/framer text get --page /pricing --name hero-title
./bin/framer text set --page /pricing --name hero-title --value "Plans that scale with your team"
./bin/framer cms collections
./bin/framer cms items --collection Posts --json
./bin/framer cms update --collection Posts --item launch-post --field Title --value "Spring Launch"
./bin/framer code files
./bin/framer code get --file components/Hero.tsx
./bin/framer code set --file components/Hero.tsx --content-file ./Hero.tsx
```

## Targeting Strategy

For agent reliability:

- Prefer `--node <id>` when you already know the Framer node ID.
- Otherwise use `--page <path> --name <layer-name>` for text updates.
- For CMS, use exact collection names and item slugs.
- For code files, prefer the full Framer file path.

If a target is ambiguous, the CLI exits with a clear error and candidate IDs.

## Notes

- The first version focuses on discovery plus safe mutations.
- CMS updates support string, formatted text, boolean, number, date, enum, link, color, reference, and array field types.
- File and image CMS fields currently expect an existing asset ID or `null`; uploads are not wrapped yet.

## References

- [Framer Server API Introduction](https://www.framer.com/developers/server-api-introduction)
- [Framer Server API Quick Start](https://www.framer.com/developers/server-api-quick-start)
- [Framer Server API Reference](https://www.framer.com/developers/server-api-reference)
- [Framer Nodes Guide](https://www.framer.com/developers/nodes)
- [Framer CMS Guide](https://www.framer.com/developers/cms)
