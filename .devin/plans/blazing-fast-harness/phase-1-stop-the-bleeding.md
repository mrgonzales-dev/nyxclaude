# Phase 1 — Stop the Bleeding

Fix reliability issues that halt work mid-task. These are actively costing work right now.

## 1.1 Fix path-counter false trips

**File:** `src/query/toolFailureLoopGuard.ts` (+ `src/query/toolFailureLoopGuard.test.ts`)

**Problem:** The path counter (lines 173-192) trips on ANY 3 failures at the same path, regardless of error type. A normal edit-string-mismatch retry loop on a large file produces `FileWriteError` 3 times on the same path and halts the query — treated identically to a genuinely inaccessible path.

**Root cause:** The path counter conflates path-intrinsic failures (`NotFound`, `PermissionError` — path is genuinely inaccessible) with tool-input failures (`FileWriteError` from string mismatch, `InputValidationError` — path is fine, input is wrong). The signature/category counters already catch persistent retry loops, so the path counter doesn't need to.

**Changes:**
1. In the path-counting loop (~line 173), add a guard: only increment `pathCounts` when `failure.errorCategory` is `NotFound` or `PermissionError`.
2. Add a path advisory at `threshold - 1` (parity with signature advisory at lines 159-170):
   - Extend `ToolFailureLoopGuardAdvisory` type to include optional `path` field
   - Add `createPathAdvisoryMessage()` function
   - In the path loop, when `pathCount === threshold - 1`, push an advisory
3. Update `createTripMessage` path branch to remain unchanged (already correct)

**Tests to add:**
- 3x `Edit` + `FileWriteError` on same path does NOT trip path counter (may still trip via persistent signature if no success intervenes)
- 3x `Read` + `NotFound` on same path DOES trip
- 3x `Write` + `PermissionError` on same path DOES trip
- 2x `NotFound` on a path emits advisory, 3rd trips
- Existing path-trip tests for `NotFound`/`PermissionError` still pass

**Risk:** Low. Narrows one trip condition. Signature/category counters unchanged and still catch retry loops.

## 1.2 Fix headless MCP tool flooding

**File:** `src/cli/print.ts:903`

**Problem:** Headless `--print` mode sends ALL MCP tool descriptions (up to 2048 chars each x dozens of servers) to the model every turn. The REPL at `src/tools.ts:124` already filters `mcpTools` out, but print mode merges them directly into `filteredTools`.

**Changes:**
- Replace direct `appState.mcp.tools` merge with `assembleToolPool(appState.toolPermissionContext, appState.mcp.tools)`, matching REPL behavior
- Or filter to `alwaysLoad` tools only

**Risk:** Low. Matches existing REPL behavior.

## 1.3 Fix PTL compaction retry waste

**File:** `src/services/compact/compact.ts:480-521`

**Problem:** The `prompt_too_long` retry loop re-sends the entire remaining conversation to the summary model after each PTL failure. This can burn one or more full-context API calls (50k-200k+ tokens each) before succeeding.

**Changes:**
- Before the first summary attempt, truncate oldest round groups proactively
- On PTL retry, truncate additional oldest rounds rather than re-sending everything
- Keep a minimum number of recent rounds to preserve working context

**Risk:** Medium. Must ensure truncation doesn't drop critical recent context. Test with long sessions.

## Verification

After all three changes:
- `bun test src/query/toolFailureLoopGuard.test.ts` — all existing + new tests pass
- `cd backend && go build -o ../backend-bin .` — backend still builds (if applicable)
- Manual smoke test: run agent against a large file, verify edit-mismatch loops don't halt
- Headless mode: `--print` with MCP servers configured, verify tool descriptions aren't flooded
