import { useEffect, useRef } from 'react'
import { computeIdleBackoffDelay } from '../utils/idleBackoff.js'

/**
 * Like {@link useInterval} but applies idle backoff to the delay.
 *
 * When the user/agent has been idle, the interval is stretched (2× after 30s,
 * 5× after 5min) to reduce unnecessary wakeups. Pass `null` for
 * `baseIntervalMs` to pause (no timer scheduled).
 *
 * Uses a self-rescheduling `setTimeout` so the delay is re-evaluated on every
 * tick — if the user becomes active again, the next tick immediately returns
 * to the base interval without waiting for a re-render.
 *
 * @param callback - Function to call on each tick. Should be stable
 *                   (wrapped in `useCallback` or via React Compiler).
 * @param baseIntervalMs - Base interval in ms, or `null` to pause.
 */
export function useIdleBackoffInterval(
  callback: () => void,
  baseIntervalMs: number | null,
): void {
  const savedCallback = useRef(callback)

  useEffect(() => {
    savedCallback.current = callback
  }, [callback])

  useEffect(() => {
    if (baseIntervalMs === null) return

    const intervalMs: number = baseIntervalMs
    let timer: ReturnType<typeof setTimeout> | null = null

    function tick(): void {
      savedCallback.current()
      schedule()
    }

    function schedule(): void {
      timer = setTimeout(tick, computeIdleBackoffDelay(intervalMs))
    }

    schedule()

    return () => {
      if (timer !== null) {
        clearTimeout(timer)
        timer = null
      }
    }
  }, [baseIntervalMs])
}
