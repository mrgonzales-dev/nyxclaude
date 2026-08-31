// ponytail: Ultraplan CCR session removed — feature flag ULTRAPLAN is false.
export type PollFailReason = 'timeout' | 'error' | 'cancelled'
export class UltraplanPollError extends Error {
  reason: PollFailReason
  constructor(message: string, reason: PollFailReason) {
    super(message)
    this.reason = reason
  }
}
export const ULTRAPLAN_TELEPORT_SENTINEL = '__ULTRAPLAN_TELEPORT_LOCAL__'
export type ScanResult = { phase: string; content: string }
export type UltraplanPhase = 'running' | 'needs_input' | 'plan_ready'
export class ExitPlanModeScanner {
  scan(_chunk: string): ScanResult | null { return null }
  reset(): void {}
}
export type PollResult = { phase: UltraplanPhase; approved: boolean }
export async function pollForApprovedExitPlanMode(
  _sessionId: string,
  _timeoutMs: number,
  _onPhase?: (phase: UltraplanPhase) => void,
): Promise<PollResult> {
  throw new UltraplanPollError('Ultraplan not available', 'error')
}
