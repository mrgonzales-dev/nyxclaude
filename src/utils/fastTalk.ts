import { getGlobalConfig, saveGlobalConfig } from './config.js'
import { isEnvTruthy } from './envUtils.js'

export const FASTTALK_PROMPT = `# Fasttalk mode active
Reply in 1-5 sentences max. Still do tasks properly with tools. Keep the final reply to the user to 1-5 sentences. Be direct. Skip preamble, filler, and summaries.`

let memoryFallback: boolean | undefined

export function isFastTalkEnabled(): boolean {
  if (isEnvTruthy(process.env.NYXCLAUDE_FASTTALK)) return true
  if (memoryFallback !== undefined) {
    try {
      const persisted = getGlobalConfig().fastTalkEnabled
      if (persisted !== undefined) {
        memoryFallback = persisted
        return persisted === true
      }
    } catch {
      // Config not bootstrapped yet — use in-memory value.
    }
    return memoryFallback === true
  }
  try {
    return getGlobalConfig().fastTalkEnabled === true
  } catch {
    return false
  }
}

export function setFastTalkEnabled(enabled: boolean): void {
  memoryFallback = enabled
  try {
    saveGlobalConfig(current => ({
      ...current,
      fastTalkEnabled: enabled,
    }))
  } catch {
    // Persist later once config is allowed; in-memory value still applies.
  }
}

export function toggleFastTalk(): boolean {
  const next = !isFastTalkEnabled()
  setFastTalkEnabled(next)
  return next
}

export function getFastTalkSection(): string | null {
  return isFastTalkEnabled() ? FASTTALK_PROMPT : null
}
