/**
 * Memory Pressure Monitor
 *
 * Watches process RSS and triggers cleanup actions at configurable thresholds.
 * Designed to prevent OOM when running multiple Nyxclaude sessions.
 */

import { logForDebugging } from './debug.js'

export type MemoryPressureLevel = 'normal' | 'elevated' | 'critical'

export interface MemoryPressureConfig {
  elevatedThresholdMB: number
  criticalThresholdMB: number
  checkIntervalMs: number
  perSessionBudgetMB: number
  /**
   * Minimum interval between memory-pressure compaction requests. While RSS
   * stays elevated, the monitor would otherwise re-arm `compactionRequested`
   * every `checkIntervalMs` (30s), and `consumeCompactionRequest()` drains it
   * every turn — forcing a compact before every turn. Compacting frees little
   * RSS (old message objects stay on the JS heap), so the thrash never
   * self-corrects. This floor limits memory-pressure forced compaction to at
   * most once per interval, matching the failure cooldown in autoCompact.ts.
   */
  minCompactionRequestIntervalMs: number
}

const DEFAULT_CONFIG: MemoryPressureConfig = {
  elevatedThresholdMB: 0,
  criticalThresholdMB: 0,
  checkIntervalMs: 30_000,
  perSessionBudgetMB: Number.parseInt(
    process.env.NYXCLAUDE_MAX_MEMORY_MB ?? '1536',
    10,
  ),
  minCompactionRequestIntervalMs: 5 * 60 * 1000,
}

let currentLevel: MemoryPressureLevel = 'normal'
let pressureListeners: Array<(level: MemoryPressureLevel) => void> = []
let monitorInterval: ReturnType<typeof setInterval> | null = null
let compactionRequested = false
let lastCompactionRequestMs = 0

// Registry of caches that can be pruned under critical memory pressure.
// Caches register themselves at init; the monitor prunes them all when
// RSS crosses the critical threshold.
const prunableCaches: Array<{ clear(): void }> = []

/**
 * Register a cache for automatic pruning under critical memory pressure.
 * Safe to call multiple times with the same cache (idempotent).
 */
export function registerPrunableCache(cache: { clear(): void }): void {
  if (!prunableCaches.includes(cache)) {
    prunableCaches.push(cache)
  }
}

/**
 * Clear all registered prunable caches. Called automatically when memory
 * pressure reaches 'critical'. Also callable directly for manual cache
 * eviction.
 */
export function pruneRegisteredCaches(): void {
  for (const cache of prunableCaches) {
    try {
      cache.clear()
    } catch {
      // best-effort — cache may already be empty
    }
  }
}

export function getMemoryPressureLevel(): MemoryPressureLevel {
  return currentLevel
}

export function onMemoryPressure(
  callback: (level: MemoryPressureLevel) => void,
): () => void {
  pressureListeners.push(callback)
  return () => {
    pressureListeners = pressureListeners.filter(l => l !== callback)
  }
}

export function startMemoryPressureMonitor(
  config: Partial<MemoryPressureConfig> = {},
): void {
  if (monitorInterval) return

  const resolved = { ...DEFAULT_CONFIG, ...config }

  if (resolved.elevatedThresholdMB === 0) {
    resolved.elevatedThresholdMB = Math.floor(
      resolved.perSessionBudgetMB * 0.8,
    )
  }
  if (resolved.criticalThresholdMB === 0) {
    resolved.criticalThresholdMB = Math.floor(
      resolved.perSessionBudgetMB * 0.9,
    )
  }

  // Reset the request throttle so a fresh monitor arms immediately on the
  // first elevated detection (a previous session's timestamp must not
  // suppress the initial request).
  lastCompactionRequestMs = 0

  logForDebugging(
    `[MemoryPressure] Monitor started: elevated=${resolved.elevatedThresholdMB}MB, critical=${resolved.criticalThresholdMB}MB, interval=${resolved.checkIntervalMs}ms`,
  )

  monitorInterval = setInterval(() => {
    const rss = process.memoryUsage().rss / 1024 / 1024
    const previousLevel = currentLevel

    if (rss >= resolved.criticalThresholdMB) {
      currentLevel = 'critical'
    } else if (rss >= resolved.elevatedThresholdMB) {
      currentLevel = 'elevated'
    } else {
      currentLevel = 'normal'
    }

    if (currentLevel !== previousLevel) {
      logForDebugging(
        `[MemoryPressure] Level changed: ${previousLevel} -> ${currentLevel} (RSS: ${rss.toFixed(0)}MB)`,
      )
      if (currentLevel === 'critical') {
        logForDebugging('[MemoryPressure] Critical — pruning registered caches')
        pruneRegisteredCaches()
      }
      for (const listener of pressureListeners) {
        try {
          listener(currentLevel)
        } catch {
          // Don't let listener errors crash the monitor
        }
      }
    }

    // Keep requesting compaction while pressure stays elevated/critical, but
    // throttle to minCompactionRequestIntervalMs. Without this floor the flag
    // re-arms every checkIntervalMs (30s) and consumeCompactionRequest()
    // drains it every turn, forcing a compact before every turn. Compacting
    // frees little RSS (old message objects stay on the JS heap), so the
    // thrash never self-corrects — the floor breaks the cycle.
    if (currentLevel !== 'normal') {
      const now = Date.now()
      if (now - lastCompactionRequestMs >= resolved.minCompactionRequestIntervalMs) {
        compactionRequested = true
        lastCompactionRequestMs = now
      }
    }
  }, resolved.checkIntervalMs)

  // Don't keep process alive just for monitoring
  ;(monitorInterval as ReturnType<typeof setInterval> & { unref?: () => void }).unref?.()
}

/**
 * Returns true if memory pressure triggered a compaction request since last check.
 * Consumes the flag (resets to false).
 */
export function consumeCompactionRequest(): boolean {
  if (compactionRequested) {
    compactionRequested = false
    return true
  }
  return false
}

export function stopMemoryPressureMonitor(): void {
  if (monitorInterval) {
    clearInterval(monitorInterval)
    monitorInterval = null
  }
  currentLevel = 'normal'
  pressureListeners = []
  compactionRequested = false
  lastCompactionRequestMs = 0
}
