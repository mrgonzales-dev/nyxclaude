# Audit Findings — Raw Source

Four parallel subagent audits of the nyxclaude harness. Findings ranked by impact.

## Audit 1: Query loop & compaction

1. `src/services/compact/prompt.ts:19-272` — Compaction prompt is ~3,000-token static wall of XML examples, rebuilt fresh every call (`compact.ts:470`). **Impact:** ~3k extra input tokens per auto-compact. **Fix:** memoize `getCompactPrompt(undefined)` and trim verbose `<example>` blocks.

2. `src/services/compact/compact.ts:597-615` — After every full compaction, re-emits full deferred-tools, agent-listing, and MCP-instruction delta attachments even when unchanged. **Impact:** hundreds to thousands of tokens re-injected. **Fix:** cache last emitted attachment set, yield only changed deltas.

3. `src/services/compact/compact.ts:480-521` — PTL retry loop re-sends entire remaining conversation to summary model after each `prompt_too_long` failure. **Impact:** 50k-200k+ tokens per retry. **Fix:** truncate oldest round groups before first summary attempt.

4. `src/services/compact/autoCompact.ts:481-525` — `partitionContext` + `pruneByRelevance` run before `trySessionMemoryCompaction`; if session-memory succeeds, that work is wasted. **Impact:** extra O(n log n) pass. **Fix:** try session-memory compaction first.

5. `src/utils/incrementalTokenCounter.ts:30-43` + `72-118` — `getCount()` JSON.stringifies and SHA-256 hashes entire message array on every token-count call (>=2x/turn). **Impact:** O(n) stringification per hot-path call. **Fix:** incrementally updated content hash.

6. `src/services/compact/microCompact.ts:257-275` + `460-514` — `microcompactMessages` re-scans all messages every turn. **Impact:** repeated O(n) passes and array allocations. **Fix:** cache result, invalidate on new compactable tool results.

7. `src/query.ts:900-902` — `fullSystemPrompt` rebuilt each loop iteration. **Impact:** repeated work. **Fix:** build once outside the loop.

8. `src/query.ts:729-734` — `startSkillDiscoveryPrefetch` launched on every loop iteration including continuation passes. **Impact:** wasted background work. **Fix:** only start when `state.transition === undefined`.

## Audit 2: Tool implementations & result formatting

1. `src/tools/BashTool/prompt.ts:158` — `getSimplePrompt()` returns wall of text: tool-preference list, full sandbox JSON, git/PR instructions. **Impact:** ~400-800 prompt tokens per Bash load. **Fix:** one-line sandbox summary, 4-5 bullets.

2. `src/tools/BashTool/BashTool.tsx:234` — `description` parameter schema contains 200-token multi-line example set. **Impact:** ~120 tokens in every tool schema exposure. **Fix:** one concise sentence.

3. `src/tools/AskUserQuestionTool/AskUserQuestionTool.tsx:20-32` — Input schema field descriptions include long examples and style guidelines. **Impact:** ~150-250 tokens per use. **Fix:** one-line descriptions.

4. `src/tools/WebSearchTool/prompt.ts:5-33` — Prompt repeats mandatory-sources rule plus full formatting example. **Impact:** ~150 tokens each load. **Fix:** delete example and redundant CRITICAL reminder.

5. `src/tools/WebSearchTool/WebSearchTool.ts:914-937` — Result formatter adds `REMINDER: You MUST include sources...` on every call. **Impact:** ~30-50 tokens per result. **Fix:** compact markdown links only.

6. `src/tools/GrepTool/prompt.ts:6-17` — Full usage guide with regex examples. **Impact:** ~120 tokens per load. **Fix:** one capability sentence.

7. `src/tools/GrepTool/GrepTool.ts:59-64` — `output_mode` field description explains every enum value in detail. **Impact:** ~40 tokens. **Fix:** one-line enum description.

8. `src/tools/FileReadTool/FileReadTool.ts:744-803` / `413` — `text` results return full file content with `maxResultSizeChars: Infinity`. **Impact:** thousands of tokens on large reads. **Fix:** finite cap, direct model to use offset/limit.

9. `src/tools/FileReadTool/FileReadTool.ts:845` — `validateContentTokens` calls `countTokensWithAPI` for large reads. **Impact:** blocking API round-trip. **Fix:** local fast tokenizer, API fallback only near limit.

10. `src/tools/WebFetchTool/WebFetchTool.ts:268-276` — Redirect response returns verbose multi-line instruction. **Impact:** ~40-60 tokens per redirect. **Fix:** one concise line.

## Audit 3: System prompt & startup

1. `src/constants/prompts.ts:157-419` — System-prompt static sections bloated and overlapping (~1,500-2,500 tokens). Tone/style and output-efficiency both lecture on conciseness; doing-tasks repeats plan-first guidance. **Impact:** ~2,000-2,500 tokens per API call. **Fix:** merge redundant sections.

2. `src/constants/prompts.ts:521-539` / `src/screens/REPL.tsx:2979` — System prompt reassembled every turn. Static sections re-created and re-joined on every query. **Impact:** ~2-5ms per turn. **Fix:** memoize full `getSystemPrompt()` keyed by tools, model, outputStyleConfig, mcpClients.

3. `src/screens/REPL.tsx:2975-2979` — First response blocked by context construction (AGENTS.md walk, repo map, git status) on user input, not startup. **Impact:** 100-500ms to first token. **Fix:** prefetch in parallel during init().

4. `src/main.tsx:847-884` — Startup preAction path is serial. **Impact:** 50-200ms to first REPL frame. **Fix:** parallelize init() with ensure calls, defer non-critical work.

5. `src/screens/REPL.tsx:2583-2602` — Tool pool rebuilt per query. **Impact:** ~1-3ms per turn. **Fix:** cache `assembleToolPool()` keyed on serialized key.

## Audit 4: MCP & subagent overhead

1. `src/cli/print.ts:903` — Headless turn concatenates all `appState.mcp.tools` into `filteredTools`; REPL ignores `mcpTools` but `--print` sends them all. **Impact:** 10-60KB of unused MCP tool descriptions per turn in headless mode. **Fix:** use `assembleToolPool()` matching REPL.

2. `src/services/mcp/client.ts:1777-1850` — `fetchToolsForClient` returns every connected MCP tool with unbounded `description()`. **Impact:** huge static context bloat. **Fix:** cap description(), only include `alwaysLoad === true` unless requested.

3. `src/services/mcp/client.ts:2553` + `src/main.tsx:2281` — `prefetchAllMcpResources` eagerly connects every MCP server at startup, but REPL discards `mcpTools`. **Impact:** wasted seconds. **Fix:** skip for interactive sessions.

4. `src/tools/AgentTool/runAgent.ts:344-345` — Subagents inherit parent's full `mcpClients` and `mcpResources`. **Impact:** subagent context bloat. **Fix:** pass `mcpClients: []` for non-fork agents.

5. `src/utils/attachments.ts:897` + `src/utils/mcpInstructionsDelta.ts:63-70` — `getMcpInstructionsDelta` re-scans entire messages array every turn. **Impact:** O(n^2) as transcripts grow. **Fix:** cache announced set, update on connect/disconnect.

6. `src/main.tsx:427` — `prefetchOfficialMcpUrls()` fires at startup, no TTL. **Impact:** unnecessary cold-start network, stale allowlist. **Fix:** lazy-load from `isOfficialMcpUrl()`, add 24h TTL.

7. `src/hooks/useInboxPoller.ts:988` — Polls teammate mailbox every 1s even when only leader present. **Impact:** unnecessary 1Hz wakeups. **Fix:** raise idle interval or use file-watcher/notify.
