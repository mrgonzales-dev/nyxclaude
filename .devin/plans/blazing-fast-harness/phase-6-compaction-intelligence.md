# Phase 6 — Compaction Intelligence

Smarter compaction = fewer compactions = less token waste.

## 6.1 Session-memory compaction first

**File:** `src/services/compact/autoCompact.ts:481-525`

**Problem:** `partitionContext` + `pruneByRelevance` run before `trySessionMemoryCompaction`. If session-memory compaction succeeds, the partition/prune work is wasted — extra O(n log n) pass over the full history.

**Changes:**
- Reorder: try `trySessionMemoryCompaction` first
- Only run `partitionContext` + `pruneByRelevance` if session-memory compaction fails
- This skips the expensive pass on the common path

**Risk:** Medium. Must verify session-memory compaction failure path still triggers partition/prune correctly. Test with sessions where session-memory compaction fails.

## 6.2 Microcompact caching

**File:** `src/services/compact/microCompact.ts:257-275` + `460-514`

**Problem:** `microcompactMessages` re-scans all messages and, on time-based triggers, re-maps the whole array every turn. Repeated O(n) passes and new array allocations on the query hot path.

**Changes:**
- Cache the last microcompact result
- Invalidate only when new compactable tool results arrive
- Skip the re-map when nothing has changed since last microcompact

**Risk:** Low-medium. Must ensure cache invalidation triggers on all paths that add compactable tool results. Test with mixed tool use patterns.

## 6.3 File read result truncation

**File:** `src/tools/FileReadTool/FileReadTool.ts:744-803` / `413`

**Problem:** `text` results return full file content with line numbers and `maxResultSizeChars: Infinity`. Can emit thousands of tokens on large reads.

**Changes:**
- Set finite `maxResultSizeChars` (e.g., 100,000 chars ~ 25k tokens)
- On overflow: return truncated content with a message directing the model to use `offset`/`limit`
- Include file size and line count in the truncated result so the model knows what it's missing

**Risk:** Low-medium. Model may need multiple reads for very large files, but this is the intended behavior. Verify the truncation message is clear enough that the model adjusts its reads.

## Verification

- Test compaction with a session where session-memory compaction succeeds (verify partition/prune skipped)
- Test compaction with a session where it fails (verify partition/prune runs)
- Benchmark microcompact on a 50-turn session before/after
- Test file read on a 500KB+ file: verify truncation + clear guidance
