# nyxclaude

A terminal AI coding agent harness. Forked from [openclaude](https://github.com/Gitlawb/openclaude) (which itself derives from Anthropic's Claude Code CLI), rebranded and hardwired to a local OpenAI-compatible LLM endpoint.

nyxclaude talks to a single backend — an omniroute proxy at `http://localhost:20128/v1` running `wbridge/glm-5.2` — and strips out the multi-provider routing, telemetry, auto-update, and Anthropic-specific auth from upstream. What remains is a React/Ink TUI coding agent with bash, file tools, grep, skills, slash commands, and streaming output.

## Status

Personal/local harness. Not published to npm. Working tree state as of this README:

- **Build:** green (`bun run smoke`)
- **Typecheck:** broken — 145 pre-existing `tsc` errors inherited from upstream drift
- **Tests:** red — 416 failing tests out of ~14.6k, clustered in areas touched by the rebrand
- **CI:** none configured
- **License:** none yet (`package.json` declares `SEE LICENSE FILE`)

See `AGENTS.md` for the local agent workflow rules.

## Requirements

- Node.js `>=22.0.0` (runtime)
- Bun `1.3.x`+ (source builds and tests only)
- A running omniroute proxy at `localhost:20128` exposing an OpenAI-compatible `/v1` endpoint

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

## Configuration

The LLM endpoint, model, and API key are hardcoded at the top of `src/entrypoints/cli.tsx` and baked into the build. To change backends, edit those env assignments and rebuild:

```ts
process.env.OPENAI_BASE_URL = 'http://localhost:20128/v1'
process.env.OPENAI_MODEL    = 'wbridge/glm-5.2'
process.env.OPENAI_API_KEY  = '...'
```

Settings files (all gitignored):

- `.nyxclaude/settings.local.json` — project-local settings
- `~/.nyxclaude/settings.json` — user settings
- `.nyxclaude/skills/` — project skills
- `~/.nyxclaude/skills/` — user skills

## What's Different From Upstream

- **Single backend.** Hardcoded to one OpenAI-compatible endpoint; provider routing, `/provider`, model picker discovery, and OAuth flows are stubbed or hidden.
- **No telemetry, no auto-updater.** `DISABLE_TELEMETRY=1` and `DISABLE_AUTOUPDATER=1` set at startup.
- **MCP disabled by default.** Server connections are off; the MCP entrypoint still exists for standalone use.
- **Chrome integration removed.** `claudeInChrome` skills and hooks are stubbed to no-ops.
- **Simplified system prompt.** `CLAUDE_CODE_SIMPLE=1` selects a minimal prompt suited to small-context models.
- **fff (Fast File Finder) integration.** In-process content and path search via a native FFI library, with ripgrep fallback.
- **Branding.** Product name, wordmark, and startup banner all read `nyxclaude`.

## Scripts

| Script | Purpose |
|---|---|
| `bun run build` | Bundle `dist/cli.mjs` + `dist/sdk.mjs` |
| `bun run dev` | Build and launch from source |
| `bun run smoke` | Build + `--version` check |
| `bun run typecheck` | `tsc --noEmit` (currently 145 errors) |
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
openclaude/     upstream snapshot (gitignored, reference only)
```

## Origin

Forked from `@gitlawb/openclaude` v0.26.0. The upstream snapshot is kept in `openclaude/` (gitignored) for diff reference during the rebrand. ~633 files differ from that snapshot.

## Disclaimer

This is an independent fork. It is not affiliated with, endorsed by, or supported by Anthropic or the openclaude maintainers. "Claude Code" is an Anthropic product; this project does not use Anthropic's API.
