# Blazing Fast Harness — Implementation Plan

Seven phases to make the nyxclaude harness faster and more token-efficient.
Each phase is independently shippable. Ordered by impact and dependency.

## Phases

| Phase | File | Goal | Tokens saved/turn | Time saved | Risk |
|-------|------|------|-------------------|------------|------|
| 0 | `phase-0-model-fuzzy-search.md` | Complete /model fuzzy search (backspace, escape-clear, tests) | — | UX fix | Low |
| 1 | `phase-1-stop-the-bleeding.md` | Fix reliability issues that halt work | 10-60KB (headless) | Stops false halts | Low |
| 2 | `phase-2-slash-per-turn-tokens.md` | Cut recurring per-turn token waste | 1,500-3,000 | — | Low |
| 3 | `phase-3-time-to-first-token.md` | Speed up startup to first streamed char | — | 200-600ms | Medium |
| 4 | `phase-4-memoize-hot-path.md` | Stop recomputing the same things every turn | — | 2-5ms/turn + O(1) | Low |
| 5 | `phase-5-fix-token-counter.md` | Replace O(n) token counting with O(1) | — | Removes API round-trips | Low |
| 6 | `phase-6-compaction-intelligence.md` | Smarter compaction = fewer compactions | 50k-200k per compaction | O(n log n) avoided | Medium |
| 7 | `phase-7-background-cleanup.md` | Stop waking up when there's nothing to do | — | CPU idle | Low |

## Cumulative impact

- ~2,000-3,500 fewer tokens per turn
- 200-600ms faster first token
- O(1) per-turn overhead instead of O(n)
- No false stops on normal edit iteration
- No wasted background work in idle sessions

## Audit source

Findings sourced from `audit-findings.md` — four parallel subagent audits covering:
- Query loop & compaction
- Tool implementations & result formatting
- System prompt & startup speed
- MCP & subagent overhead

## Workflow

Each phase follows AGENTS.md workflow:
1. Plan (read files, trace deps, present approach)
2. Quinn review (subagent_explore checks plan)
3. Implement (follow existing conventions, minimal changes)
4. Test (build, typecheck, tests, smoke test)
5. Quinn double-check (subagent reviews actual changes)
6. Commit (concise message, no bot attribution)
