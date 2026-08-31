// ponytail: Overage credit grant removed — Anthropic subscription feature.
export type OverageCreditGrantInfo = { amount: number; currency: string; expiresAt: string }
export function getCachedOverageCreditGrant(): OverageCreditGrantInfo | null { return null }
export function invalidateOverageCreditGrantCache(): void {}
export async function refreshOverageCreditGrantCache(): Promise<void> {}
export function formatGrantAmount(_info: OverageCreditGrantInfo): string | null { return null }
