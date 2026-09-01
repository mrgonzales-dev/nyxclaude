# Phase 3 — Time to First Token

Speed up startup to first streamed character. 200-600ms faster first token.

## 3.1 Parallelize startup

**File:** `src/main.tsx:847-884`

**Problem:** Startup `preAction` path is serial:
1. `await Promise.all([ensureMdmSettingsLoaded(), ensureKeychainPrefetchCompleted()])`
2. `await init()`
3. `initSinks` dynamic import
4. migrations
5. remote settings

**Changes:**
- Start `init()` in parallel with the ensure calls (they're independent)
- Defer `initSinks` / `runMigrations` / `loadRemoteManagedSettings` until after first render
- Only block first render on the minimum required setup

**Risk:** Medium. Must verify `init()` doesn't depend on `ensureMdmSettingsLoaded` or `ensureKeychainPrefetchCompleted` results. Trace dependencies carefully.

## 3.2 Prefetch context at startup

**File:** `src/screens/REPL.tsx:2975-2979`

**Problem:** `getSystemPrompt()`, `getUserContext()` (AGENTS.md directory walk), and `getSystemContext()` (repo map + git status) are first called on the user's first input, not at startup. 100-500ms to first token.

**Changes:**
- Fire `Promise.all([getSystemPrompt(...), getUserContext(), getSystemContext()])` during `init()` or `preAction` hook
- Store results, reuse on first user input
- Invalidate/rebuild if project folder changes

**Risk:** Medium. Context may change between prefetch and first use (e.g., user switches project). Need invalidation logic.

## 3.3 Skip MCP prefetch for interactive sessions

**File:** `src/main.tsx:2281`

**Problem:** `prefetchAllMcpResources` eagerly connects/fetches every configured MCP server at startup. But REPL at `src/tools.ts:124` discards `mcpTools` for the interactive tool pool anyway.

**Changes:**
- Guard `prefetchAllMcpResources` with `isNonInteractiveSession` check (already exists for other purposes)
- Only prefetch for `--print` mode
- For interactive: lazy-connect MCP servers on first explicit tool use

**Risk:** Low-medium. MCP tools won't be available immediately in REPL, but they weren't in the tool pool anyway. Verify no other code path depends on early MCP connection.

## 3.4 Lazy-load official MCP URLs

**File:** `src/main.tsx:427` + `src/services/mcp/officialRegistry.ts:21`

**Problem:** `prefetchOfficialMcpUrls()` fires at process start. `officialUrls` cached forever with no TTL.

**Changes:**
- Move `prefetchOfficialMcpUrls()` call into `isOfficialMcpUrl()` (lazy on first use)
- Add 24h TTL refresh to `officialRegistry.ts:21` cache

**Risk:** Low. First call to `isOfficialMcpUrl()` will be slightly slower, but only if it's actually called.

## Verification

- Measure time from process start to first token streamed (before/after)
- Measure time from first user input to first token (before/after)
- Verify REPL still functions normally with deferred MCP prefetch
- Test `--print` mode still has MCP tools available
