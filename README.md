<div align="center">

```
███╗   ██╗██╗   ██╗██╗  ██╗
████╗  ██║╚██╗ ██╔╝╚██╗██╔╝
██╔██╗ ██║ ╚████╔╝  ╚███╔╝
██║╚██╗██║  ╚██╔╝   ██╔██╗
██║ ╚████║   ██║   ██╔╝ ██╗
╚═╝  ╚═══╝   ╚═╝   ╚═╝  ╚═╝
```

### nyxclaude

An opinionated terminal AI coding agent harness.

Bring any OpenAI-compatible LLM endpoint — local or cloud. No provider is hardcoded.

Based on [openclaude](https://github.com/anthropics/claude-code).

</div>

---

## Quick Start

```bash
bun install
bun run build
node bin/nyxclaude
```

On first run, type `/provider` to configure your endpoint. The wizard walks you through preset selection, API key, base URL, and model. Profiles save to `~/.nyxclaude.json` and load automatically on restart.

## Requirements

- Node.js `>=22.0.0`
- Bun `1.3.x`+ (build and tests only)
- An OpenAI-compatible LLM endpoint

## Scripts

| Script | Purpose |
|---|---|
| `bun run build` | Bundle `dist/cli.mjs` + `dist/sdk.mjs` |
| `bun run dev` | Build and launch from source |
| `bun run smoke` | Build + `--version` check |
| `bun run typecheck` | `tsc --noEmit` |
| `bun test` | Unit suite |
| `bun run check` | smoke + deadcode + full tests |

## Layout

```
bin/        CLI launcher
src/        core runtime (TypeScript + React/Ink)
  entrypoints/  cli.tsx, sdk/
  commands/     slash commands
  tools/        bash, file edit/read, grep, task
  services/     api client, mcp, lsp, compact
  skills/       bundled + loaded skills
  screens/      REPL (main TUI)
scripts/    build, verification
dist/       build output (gitignored)
```

## Status

Personal harness. Not published to npm.
