# Phase 5 — Fix the Token Counter

Replace O(n) token counting with O(1). Remove blocking API calls for file size validation.

## 5.1 Incremental content hash

**File:** `src/utils/incrementalTokenCounter.ts:30-43` + `72-118`

**Problem:** `getCount()` JSON.stringifies and SHA-256 hashes the entire message array on every token-count call. `tokenCountWithEstimation` is called at least twice per turn (`src/query.ts:1260`, `src/query.ts:1307`). O(n) stringification per hot-path call, becomes noticeable on long sessions.

**Changes:**
- Replace full `JSON.stringify` + SHA-256 with incrementally updated hash
- Append new message hashes as messages are added
- Don't rehash the whole array
- Maintain a running hash that updates on append only

**Implementation detail:**
- Store hash as a rolling value updated when messages are appended
- On cache miss (hash mismatch), fall back to full recompute
- The cache key is the hash; the value is the token count

**Risk:** Low. Hash collisions are negligible with SHA-256. Must ensure hash updates on all message append paths (including tool results, compaction, etc.).

## 5.2 Local tokenizer for file reads

**File:** `src/tools/FileReadTool/FileReadTool.ts:845`

**Problem:** `validateContentTokens` calls `countTokensWithAPI` for any large read. This adds a blocking API round-trip on big files.

**Changes:**
- Use a local fast tokenizer (e.g., `tiktoken` or a char-based heuristic) for initial estimate
- Only fall back to `countTokensWithAPI` when the local estimate is near the limit (within 20%)
- This avoids the API call for the vast majority of file reads

**Risk:** Low. Local tokenizer may be slightly less accurate, but the fallback ensures correctness near the boundary.

## Verification

- Benchmark `getCount()` on a 100-message session before/after
- Verify token counts remain accurate (compare local tokenizer vs API for files near the limit)
- Test with very long sessions (500+ messages) to confirm O(1) scaling
