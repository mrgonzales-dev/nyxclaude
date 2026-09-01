// ponytail: Claude AI limits removed — Anthropic subscription feature.
// All functions are no-ops, all types are empty stubs.

export type RateLimitType = string
export type OverageDisabledReason = string

export type ClaudeAILimits = {
  utilization: number | null
  rateLimitType: RateLimitType | null
  overageEnabled: boolean
  overageDisabledReason: OverageDisabledReason | null
  rawUtilization: RawUtilization | null
  isUsingOverage: boolean
  overageStatus: string | null
  status: string | null
  resetsAt: string | null
  overageResetsAt: string | null
}

export type RawUtilization = {
  inputTokensUsed: number
  inputTokensLimit: number
  outputTokensUsed: number
  outputTokensLimit: number
  requestCountUsed: number
  requestCountLimit: number
  five_hour?: { utilization: number; resets_at?: string }
  seven_day?: { utilization: number; resets_at?: string }
}

export let currentLimits: ClaudeAILimits = {
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
}

export function getRateLimitDisplayName(_type: RateLimitType): string { return '' }
export function getRawUtilization(): RawUtilization | null { return null }
export const statusListeners: Set<() => void> = new Set()
export function emitStatusChange(_limits: ClaudeAILimits): void {}
export async function checkQuotaStatus(): Promise<void> {}
export function extractQuotaStatusFromHeaders(_headers: unknown): void {}
export function extractQuotaStatusFromError(_error: unknown): void {}
export function getRateLimitErrorMessage(_limits: ClaudeAILimits, _model: string): string | null { return null }
export function getRateLimitWarning(_limits: ClaudeAILimits): string | null { return null }
export function getUsingOverageText(_limits: ClaudeAILimits): string { return '' }
