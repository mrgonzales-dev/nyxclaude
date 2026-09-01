# Phase 0 — /model Fuzzy Search Completion

The /model page fuzzy search was partially implemented but never finished.
The search wiring exists but has UX gaps and no tests.

## Current state

- `src/utils/model/fuzzySearch.ts` — exists, uses fuse.js, has basic tests
- `src/components/ModelPicker.tsx` — has `searchQuery` state, `filteredOptions` via `fuzzySearch`, `handleSearchInput` callback, `onSearchInput` passed to Select, `highlightText` for matching
- `src/components/CustomSelect/use-select-input.ts` — has `onSearchInput` prop, forwards printable characters

## Problems

1. **No backspace handling** — `handleSearchInput` (line 382-387) only appends (`prev => prev + input`). Once you type, you can't correct a typo. The `onSearchInput` in `use-select-input.ts` only forwards single printable chars (lines 297-305); no backspace/delete handling.

2. **No Escape-to-clear** — When search is active and user presses Escape, it cancels the entire picker instead of clearing the search first. Standard UX is: first Escape clears search, second Escape cancels.

3. **No tests** — `model.test.tsx` has zero references to search/fuzzy/backspace/searchQuery/onSearchInput.

## Changes

### 0.1 Add backspace support to Select input layer

**Files:** `src/components/CustomSelect/use-select-input.ts`, `src/components/CustomSelect/select.tsx`

- Add `onSearchBackspace?: () => void` optional prop to `UseSelectProps` and `SelectProps`
- In `use-select-input.ts` `useInput` handler: when not in input mode, `onSearchInput` is set, and `key.backspace` or `key.delete` is pressed, call `onSearchBackspace()`
- Thread the prop through `select.tsx` to `useSelectInput`

### 0.2 Add backspace + Escape-to-clear to ModelPicker

**File:** `src/components/ModelPicker.tsx`

- Add `handleSearchBackspace` callback: `setSearchQuery(prev => prev.slice(0, -1))`
- Pass `onSearchBackspace={handleSearchBackspace}` to Select
- Modify `onCancel`: when `searchQuery` is non-empty, clear search instead of canceling
  - `onCancel={() => { if (searchQuery) setSearchQuery(''); else onCancel?.() }}`

### 0.3 Tests (TDD — write first, then implement)

**File:** `src/utils/model/fuzzySearch.test.ts` — add edge cases:
- Multi-word query matches across label and description
- Case-insensitive matching
- Special characters in query

**File:** `src/commands/model/model.test.tsx` — add search integration tests:
- Typing a search query filters the model list
- Backspace removes the last character from search
- Escape clears search when active, cancels when empty
- Selecting a filtered model works correctly
- Search query with no matches shows empty list

## Risk

Low. The search is additive — when no query is typed, behavior is identical to before. Backspace and Escape-to-clear are standard UX patterns.
