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

## How It Thinks

The system prompt is engineered to produce focused, correct, no-nonsense output. Core directives:

- **Plan before acting.** Read files, trace dependencies, understand architecture, present a plan, wait for confirmation. No guessing.
- **YAGNI first.** Before writing code: does this need to exist? Does it already exist? Does the stdlib do it? Can it be one line? Only then write the minimum that works.
- **Root cause, not symptom.** Reproduce, minimize, hypothesize, instrument, fix, write a regression test. Never guess-and-patch.
- **Red-green-refactor.** Write a failing test, make it pass with minimal code, then refactor.
- **ASD-STE100 tone.** Short, direct sentences. Active voice only. No hedging, no filler, no corporate phrasing. Flat and factual.
- **Faithful reporting.** If tests fail, say so. If you didn't verify, say that. Never manufacture a green result.
- **Measure twice, cut once.** Local reversible actions are free. Destructive, hard-to-reverse, or shared-state actions require confirmation every time.
- **Security-aware.** Completes normal engineering and authorized security work freely. Refuses only requests that concretely seek harm.

## Features

- **Multi-provider.** `/provider` wizard configures any OpenAI-compatible endpoint — OpenAI, Ollama, Gemini, DeepSeek, OpenRouter, custom. Profiles persist and load on restart.
- **Tool arsenal.** Bash, file read/write/edit, glob, grep, web search, web fetch, MCP tools, LSP integration, notebook editing, task management, subagents.
- **Slash commands.** `/commit`, `/compact`, `/review`, `/plan`, `/diff`, `/doctor`, `/provider`, `/model`, `/theme`, `/skills`, `/mcp`, `/wiki`, and more.
- **Bundled skills.** `/debug` (session diagnostics), `/simplify` (code review for reuse/quality), `/batch` (parallel worktree agents), `/loop` (scheduled prompts), `/pdf` (document generation), `/update-config` (settings/hooks), `/keybindings-help`.
- **Custom skills.** Drop a `SKILL.md` into `.nyxclaude/skills/` or `~/.nyxclaude/skills/` — the harness loads them automatically.
- **Context management.** Automatic compaction near context limits. `/compact` for manual control. Context visualization via `/ctx_viz`.
- **Permission system.** Granular per-tool permissions, YOLO mode, plan mode, sandbox toggle. Configurable via `/permissions`.
- **Session persistence.** Resume conversations with `--resume`. Session restore across restarts.
- **Output styles.** Switch between default, explanatory, and learning modes via `/output-style`.
- **MCP support.** Connect external tool servers. Per-server instructions injected into the system prompt.
- **Hooks.** Shell commands triggered on tool events. Configure in `settings.json`.
- **Themes.** Customizable TUI colors via `/theme`.

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
  tools/        bash, file edit/read, grep, task, web, mcp, lsp
  services/     api client, mcp, lsp, compact
  skills/       bundled + loaded skills
  screens/      REPL (main TUI)
  constants/    system prompt, brand, output styles
scripts/    build, verification
dist/       build output (gitignored)
```

## Status

Personal harness. Not published to npm.
