# Phase 2 — Slash Per-Turn Token Waste

Cut the recurring token cost that compounds every single turn. ~1,500-3,000 tokens saved per API call.

## 2.1 Trim system prompt

**File:** `src/constants/prompts.ts:157-419`

**Problem:** System prompt has ~2,000-2,500 tokens of overlapping instructions:
- `getSimpleToneAndStyleSection` and `getOutputEfficiencySection` both lecture on conciseness
- `getSimpleDoingTasksSection` repeats plan-first guidance already in `getActionsSection` and tool instructions

**Changes:**
- Merge `getOutputEfficiencySection` into `getSimpleToneAndStyleSection`
- Cut redundant plan-first bullets from `getSimpleDoingTasksSection`
- Target: ~1,000 tokens removed per API call

**Risk:** Low. Removing redundant instructions doesn't change behavior.

## 2.2 Slim tool schemas and prompts

**Files:** Multiple tool files

| File | Change | Tokens saved |
|------|--------|-------------|
| `src/tools/BashTool/prompt.ts:158` | Sandbox JSON -> one-line summary, examples -> 4-5 bullets | ~400-800 |
| `src/tools/BashTool/BashTool.tsx:234` | Multi-line example schema -> one sentence | ~120 |
| `src/tools/AskUserQuestionTool/AskUserQuestionTool.tsx:20-32` | Field descriptions -> one-line each | ~150-250 |
| `src/tools/WebSearchTool/prompt.ts:5-33` | Delete redundant example + CRITICAL reminder | ~150 |
| `src/tools/WebSearchTool/WebSearchTool.ts:914-937` | Drop `REMINDER: You MUST include sources` from results | ~30-50/result |
| `src/tools/GrepTool/prompt.ts:6-17` | Trim usage guide to one capability sentence | ~120 |
| `src/tools/GrepTool/GrepTool.ts:59-64` | Collapse enum descriptions to one-line | ~40 |
| `src/tools/WebFetchTool/WebFetchTool.ts:268-276` | Redirect response -> one concise line | ~40-60/redirect |

**Risk:** Low. Tool behavior unchanged, only descriptions trimmed.

## 2.3 Cap MCP tool descriptions

**File:** `src/services/mcp/client.ts:1777-1850`

**Problem:** `fetchToolsForClient` returns every connected MCP tool with unbounded `description()`. Only `prompt()` is capped at `MAX_MCP_DESCRIPTION_LENGTH` (2048).

**Changes:**
- Cap `description()` to `MAX_MCP_DESCRIPTION_LENGTH` too
- Only include `alwaysLoad === true` tools unless explicitly requested by the model

**Risk:** Low. Tools still available when requested, just not all loaded by default.

## 2.4 Subagent MCP isolation

**File:** `src/tools/AgentTool/runAgent.ts:344-345`

**Problem:** Subagents inherit parent's full `mcpClients` and `mcpResources`, dragging all server instructions and resource lists into fresh subagent context.

**Changes:**
- For non-fork fresh agents: pass `mcpClients: []`, `mcpResources: {}`
- Only inherit MCP state when `isForkPath` or agent explicitly needs it

**Risk:** Low-medium. Subagents that need MCP access must be identified. Check if any subagent profiles rely on inherited MCP tools.

## 2.5 Post-compaction delta caching

**File:** `src/services/compact/compact.ts:597-615`

**Problem:** After every full compaction, re-emits all deferred-tools, agent-listing, and MCP-instruction delta attachments even when unchanged.

**Changes:**
- Cache last emitted attachment set
- Only yield changed deltas after compaction

**Risk:** Low. Deltas are additive; skipping unchanged ones is safe.

## 2.6 Memoize compaction prompt

**File:** `src/services/compact/prompt.ts:19-272`

**Problem:** Compaction prompt is ~3,000-token static wall of XML examples, rebuilt fresh every compaction call (`src/services/compact/compact.ts:470`).

**Changes:**
- Memoize `getCompactPrompt(undefined)` result
- Trim verbose `<example>` blocks

**Risk:** Low. Static content cached is identical.

## Verification

- `bun test` — all existing tests pass
- Token count comparison: measure system prompt + tool schemas before/after
- Manual: run a 10-turn session, verify total token usage dropped
