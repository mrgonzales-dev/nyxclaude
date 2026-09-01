# Phase 7 — Background Work Cleanup

Stop waking up when there's nothing to do. CPU stays at 0% when the agent isn't working.

## 7.1 Inbox poller idle backoff

**File:** `src/hooks/useInboxPoller.ts:988`

**Problem:** `useInterval` polls the teammate mailbox every 1s even when only the leader is present. Unnecessary 1Hz wakeups in multi-agent sessions.

**Changes:**
- Raise the poll interval when idle (no active teammates, no pending messages)
- Use a tiered approach: active (1s) -> idle (5s) -> deep idle (30s)
- Or switch to the existing file-watcher/notify path for event-driven updates
- Reset to active interval on any teammate activity

**Risk:** Low. Polling latency increases when idle, but there's nothing to receive anyway.

## 7.2 Audit all periodic work

**Files:** All files with `setInterval` / `setTimeout` patterns

**Problem:** There may be other periodic work that runs regardless of activity, wasting CPU and battery.

**Changes:**
- Grep for `setInterval`, `setTimeout`, `requestAnimationFrame`, polling patterns
- For each: evaluate whether it needs to run at the current frequency
- Apply idle backoff where possible:
  - Active state: current interval
  - Idle state (no user input for 30s): 2-5x slower
  - Deep idle (no user input for 5min): 10x slower or pause entirely
- Resume active interval on any user/agent activity

**Candidates to audit:**
- `useInboxPoller.ts:988` (covered in 7.1)
- Any file watcher refresh intervals
- Any token usage polling
- Any autosave/autocompact timers
- Any MCP server health checks

**Risk:** Low. Periodic work resumes active frequency on activity. Only affects idle behavior.

## Verification

- Monitor CPU usage during idle session (before/after)
- Verify teammate messages still received within reasonable latency when idle
- Verify all periodic work resumes active frequency on user input
- Check for any missed events due to slower polling (test with simulated teammate activity)
