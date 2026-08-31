/**
 * Idle backoff utility for periodic work.
 *
 * Provides a simple multiplier-based backoff for background timers. When the
 * user (or agent) has been inactive, periodic work can run less frequently to
 * reduce unnecessary event-loop wakeups.
 *
 * Backoff tiers:
 *  - Active (idle < 30s):   1× the base interval
 *  - Light idle (30s–5min): 2× the base interval
 *  - Deep idle (≥ 5min):    5× the base interval
 *
 * "Activity" is defined as recent user interaction (keystrokes, etc.) OR
 * active agent work (API calls, tool execution in progress).
 */

import { getLastInteractionTime } from '../bootstrap/state.js'
import { isSessionActivityActive } from './sessionActivity.js'

/** Idle threshold for light backoff (2×). */
export const IDLE_BACKOFF_THRESHOLD_MS = 30_000

/** Idle threshold for deep backoff (5×). */
export const IDLE_BACKOFF_DEEP_THRESHOLD_MS = 5 * 60_000

/**
 * Returns the current backoff multiplier based on how long the system has
 * been idle.
 *
 * - 1× if there is active agent work (regardless of user idle time)
 * - 1× if the user interacted within the last 30 seconds
 * - 2× if idle for 30s–5min
 * - 5× if idle for ≥ 5min
 */
export function getIdleBackoffMultiplier(): number {
  // Active agent work (API call, tool exec) keeps timers at full frequency.
  if (isSessionActivityActive()) return 1

  const idleMs = Date.now() - getLastInteractionTime()

  if (idleMs >= IDLE_BACKOFF_DEEP_THRESHOLD_MS) return 5
  if (idleMs >= IDLE_BACKOFF_THRESHOLD_MS) return 2
  return 1
}

/**
 * Computes the effective delay for a periodic timer, applying idle backoff
 * to the supplied base interval.
 *
 * @param baseMs - The base (active) interval in milliseconds.
 * @returns The adjusted interval, rounded to the nearest millisecond.
 */
export function computeIdleBackoffDelay(baseMs: number): number {
  return Math.round(baseMs * getIdleBackoffMultiplier())
}
