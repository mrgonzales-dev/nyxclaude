# Phase 4 — Memoize the Hot Path

Stop recomputing the same things every turn. Per-turn overhead drops from O(n) to O(1).

## 4.1 Memoize full system prompt

**File:** `src/constants/prompts.ts:521-539`

**Problem:** `getSystemPrompt()` caches only dynamic sections via `resolveSystemPromptSections()`. Static sections (`getSimpleIntroSection`, `getSimpleSystemSection`, `getSimpleDoingTasksSection`, etc.) are re-created and re-joined on every user query.

**Changes:**
- Memoize the full `getSystemPrompt()` result
- Cache key: `tools`, `model`, `outputStyleConfig`, `mcpClients` (serialized)
- Invalidate when any key changes

**Risk:** Low. Same inputs produce same output. Must ensure cache key captures all dependencies.

## 4.2 Cache tool pool

**File:** `src/screens/REPL.tsx:2583-2602`

**Problem:** `computeTools()` calls `assembleToolPool()` and `mergeAndFilterTools()` on every `getToolUseContext()` even though permission context + MCP tools rarely change.

**Changes:**
- Cache `assembleToolPool(permissionContext, mcpTools)` result
- Cache key: serialized permission context + MCP tool IDs
- Recompute only when key changes

**Risk:** Low. Must ensure cache invalidation on permission changes (e.g., user grants/denies a tool).

## 4.3 Build system prompt once per query loop

**File:** `src/query.ts:900-902`

**Problem:** `fullSystemPrompt` is rebuilt each loop iteration with `asSystemPrompt` and `appendSystemContext`, even though `systemPrompt`/`systemContext` rarely change.

**Changes:**
- Build the base system prompt once outside the loop
- Only re-append the arc suffix when it changes
- Track arc suffix separately, rebuild only that part

**Risk:** Low. Arc suffix is the only part that changes mid-loop.

## 4.4 Skill prefetch only on user turns

**File:** `src/query.ts:729-734`

**Problem:** `startSkillDiscoveryPrefetch` is launched on every loop iteration, including continuation passes (non-user turns).

**Changes:**
- Only start `startSkillDiscoveryPrefetch` when `state.transition === undefined` (user-initiated turn)
- Skip on continuation/tool-result passes

**Risk:** Low. Skills don't change mid-loop.

## 4.5 Cache MCP instructions delta

**File:** `src/utils/attachments.ts:897` + `src/utils/mcpInstructionsDelta.ts:63-70`

**Problem:** `getMcpInstructionsDelta` re-scans the entire `messages` array every turn to rebuild the announced-MCP set. O(n^2) as transcripts grow.

**Changes:**
- Cache the `announced` set in `toolUseContext` or `AppState`
- Update on connect/disconnect events only
- Replace per-turn full-scan with cached lookup

**Risk:** Low-medium. Must ensure cache updates correctly on all MCP connect/disconnect paths. Test with servers connecting/disconnecting mid-session.

## Verification

- Benchmark per-turn overhead before/after (use existing `profileReport` if available)
- Long session test (100+ turns): verify overhead doesn't grow with transcript length
- MCP connect/disconnect mid-session: verify delta updates correctly
