// ponytail: Codex usage API removed — OpenAI/Anthropic usage tracking.
export type CodexUsageWindow = { start: string; end: string }
export type CodexUsageCredits = { used: number; limit: number }
export type CodexUsageSnapshot = { window: CodexUsageWindow; credits: CodexUsageCredits }
export type CodexUsageData = { snapshots: CodexUsageSnapshot[]; plan_type: string | null }
export type CodexUsageRow = { label: string; used: number; limit: number }
export function normalizeCodexUsagePayload(_payload: unknown): CodexUsageData {
  return { snapshots: [], plan_type: null }
}
export function buildCodexUsageRows(_data: CodexUsageData): CodexUsageRow[] { return [] }
export function formatCodexPlanType(_planType: string | null): string { return '' }
export function getCodexUsageUrl(_baseUrl?: string): string { return '' }
export async function fetchCodexUsage(): Promise<CodexUsageData> {
  return { snapshots: [], plan_type: null }
}
