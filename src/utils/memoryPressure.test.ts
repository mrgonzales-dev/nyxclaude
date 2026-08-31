import { afterEach, expect, test } from 'bun:test'

import {
  consumeCompactionRequest,
  getMemoryPressureLevel,
  startMemoryPressureMonitor,
  stopMemoryPressureMonitor,
} from './memoryPressure.js'

afterEach(() => {
  stopMemoryPressureMonitor()
})

/**
 * Start the monitor with thresholds low enough that real process RSS always
 * registers as elevated, and intervals small enough for deterministic tests.
 * Returns a helper that resolves after at least one monitor tick.
 */
function startElevatedMonitor(opts?: {
  checkIntervalMs?: number
  minCompactionRequestIntervalMs?: number
}): { tick: () => Promise<void> } {
  const checkIntervalMs = opts?.checkIntervalMs ?? 5
  const minCompactionRequestIntervalMs =
    opts?.minCompactionRequestIntervalMs ?? 50
  startMemoryPressureMonitor({
    elevatedThresholdMB: 1, // any real process exceeds 1 MB RSS
    criticalThresholdMB: Number.MAX_SAFE_INTEGER, // never critical
    checkIntervalMs,
    minCompactionRequestIntervalMs,
    perSessionBudgetMB: 1536,
  })
  const tick = async (): Promise<void> => {
    await new Promise(resolve => setTimeout(resolve, checkIntervalMs + 5))
  }
  return { tick }
}

test('elevated pressure arms a compaction request on first detection', async () => {
  const { tick } = startElevatedMonitor()
  await tick()

  expect(getMemoryPressureLevel()).toBe('elevated')
  expect(consumeCompactionRequest()).toBe(true)
  // Flag is one-shot — second consume returns false.
  expect(consumeCompactionRequest()).toBe(false)
})

test('compaction request is not re-armed within the min interval', async () => {
  const { tick } = startElevatedMonitor({
    checkIntervalMs: 5,
    minCompactionRequestIntervalMs: 50,
  })
  await tick()

  // First request armed and consumed.
  expect(consumeCompactionRequest()).toBe(true)

  // Wait for several monitor ticks but stay under the 50 ms floor.
  await new Promise(resolve => setTimeout(resolve, 25))
  expect(consumeCompactionRequest()).toBe(false)
})

test('compaction request re-arms after the min interval elapses', async () => {
  const { tick } = startElevatedMonitor({
    checkIntervalMs: 5,
    minCompactionRequestIntervalMs: 30,
  })
  await tick()

  // First request armed and consumed.
  expect(consumeCompactionRequest()).toBe(true)

  // Wait past the 30 ms floor so the monitor can re-arm.
  await new Promise(resolve => setTimeout(resolve, 45))
  expect(consumeCompactionRequest()).toBe(true)
})

test('stopMemoryPressureMonitor resets compaction request state', async () => {
  const { tick } = startElevatedMonitor()
  await tick()

  expect(consumeCompactionRequest()).toBe(true)

  stopMemoryPressureMonitor()
  expect(consumeCompactionRequest()).toBe(false)
  expect(getMemoryPressureLevel()).toBe('normal')
})

test('normal pressure does not arm compaction requests', async () => {
  startMemoryPressureMonitor({
    elevatedThresholdMB: Number.MAX_SAFE_INTEGER, // never elevated
    criticalThresholdMB: Number.MAX_SAFE_INTEGER,
    checkIntervalMs: 5,
    minCompactionRequestIntervalMs: 50,
    perSessionBudgetMB: 1536,
  })
  await new Promise(resolve => setTimeout(resolve, 15))

  expect(getMemoryPressureLevel()).toBe('normal')
  expect(consumeCompactionRequest()).toBe(false)
})
