// ponytail: Clinepass usage removed — Anthropic internal feature.
export type ClinePassUsageData = { used: number; limit: number }
export type ClinePassUsageRow = { label: string; used: number; limit: number }
export async function fetchClinePassUsage(): Promise<ClinePassUsageData | null> { return null }
export function getCachedClinepassUsage(): ClinePassUsageData | null { return null }
export function buildClinePassUsageRows(_data: ClinePassUsageData): ClinePassUsageRow[] { return [] }
