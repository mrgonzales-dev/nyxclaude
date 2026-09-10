// ponytail: Remote limits hook removed — returns empty limits.
import type { RateLimits } from './limits.js'

export function useLimits(): RateLimits {
  return {
    utilization: null,
    rateLimitType: null,
    overageEnabled: false,
    overageDisabledReason: null,
    rawUtilization: null,
    isUsingOverage: false,
    overageStatus: null,
    status: null,
    resetsAt: null,
    overageResetsAt: null,
    unifiedRateLimitFallbackAvailable: false,
    surpassedThreshold: null,
  }
}
