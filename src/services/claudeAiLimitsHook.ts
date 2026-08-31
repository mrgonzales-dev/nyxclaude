// ponytail: Claude AI limits hook removed — returns empty limits.
import type { ClaudeAILimits } from './claudeAiLimits.js'

export function useClaudeAiLimits(): ClaudeAILimits {
  return {
    utilization: null,
    rateLimitType: null,
    overageEnabled: false,
    overageDisabledReason: null,
    rawUtilization: null,
  }
}
