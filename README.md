# nyxclaude

A terminal AI coding agent harness. Uses `/provider` to configure any OpenAI-compatible LLM endpoint — local or cloud. No provider is hardcoded. On first run with no provider configured, the CLI shows "No provider · Run /provider" and blocks message submission until one is added.

## Status

Personal/local harness. Not published to npm.

- **Build:** green (`bun run smoke`)
- **Typecheck:** run `bun run typecheck`
- **Tests:** run `bun test`
- **CI:** none configured
- **License:** see `package.json`

See `AGENTS.md` for the local agent workflow rules.

## Requirements

- Node.js `>=22.0.0` (runtime)
- Bun `1.3.x`+ (source builds and tests only)
- An OpenAI-compatible LLM endpoint (local or cloud) — configured via `/provider`

## Quick Start

```bash
bun install
bun run build
node dist/cli.mjs
```

Or via the launcher (relaunches Node with an 8 GB heap and `--expose-gc` for long sessions):

```bash
node bin/nyxclaude
```

During development:

```bash
bun run dev          # build + launch from source
bun run smoke        # build + --version check
```

On first run, the startup screen shows `Provider  No provider`. Type `/provider` to add a provider — the wizard walks you through choosing a preset (OpenAI, Ollama, Gemini, DeepSeek, OpenRouter, custom, etc.), entering an API key, base URL, and model. The profile saves to `.nyxclaude-profile.json` (gitignored) and loads automatically on restart.

## Configuration

Provider config (endpoint, model, API key) is managed by `/provider` and stored in `.nyxclaude-profile.json` — not hardcoded in source. The profile loads at startup via `applyStartupEnvFromProfile()`.

Operational env vars (telemetry, auto-updater, etc.) live in `.nyxclaude/settings.local.json` under the `env` key:

```json
{
  "env": {
    "DISABLE_TELEMETRY": "1",
    "DISABLE_AUTOUPDATER": "1",
    "CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC": "1",
    "CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS": "true"
  }
}
```

Settings files (all gitignored):

- `.nyxclaude/settings.local.json` — project-local settings + operational env vars
- `.nyxclaude-profile.json` — saved provider profile (created by `/provider`)
- `~/.nyxclaude/settings.json` — user settings
- `.nyxclaude/skills/` — project skills
- `~/.nyxclaude/skills/` — user skills

## Scripts

| Script | Purpose |
|---|---|
| `bun run build` | Bundle `dist/cli.mjs` + `dist/sdk.mjs` |
| `bun run dev` | Build and launch from source |
| `bun run smoke` | Build + `--version` check |
| `bun run typecheck` | `tsc --noEmit` |
| `bun test` | Unit suite (Bun runner) |
| `bun run deadcode` | `knip` unused files/deps scan |
| `bun run check` | smoke + deadcode + full tests |
| `bun run doctor:runtime` | Runtime environment diagnostics |

## Repository Layout

```
bin/            CLI launcher (heap relaunch wrapper)
src/            core CLI/runtime (TypeScript + React/Ink)
  entrypoints/  cli.tsx, init.ts, mcp.ts, sdk/
  commands/     slash commands
  tools/        bash, file edit/read, grep, task tools
  services/     api client, openai shim, mcp, lsp, compact
  skills/       bundled + loaded skills
  screens/      REPL.tsx (main TUI)
scripts/        build, externals, verification, doctor
vendor/         node-domexception shim
dist/           build output (gitignored)
```
