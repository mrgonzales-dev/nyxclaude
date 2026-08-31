// ponytail: Referral system removed — Anthropic internal feature.

export type ReferralEligibility = { eligible: boolean; reason?: string }
export type ReferrerRewardInfo = { amount: number; currency: string }
export type PassesEligibility = { eligible: boolean; remainingPasses: number }

export async function fetchReferralEligibility(): Promise<ReferralEligibility | null> { return null }
export async function fetchReferralRedemptions(): Promise<unknown[]> { return [] }
export function checkCachedPassesEligibility(): PassesEligibility {
  return { eligible: false, remainingPasses: 0 }
}
export function formatCreditAmount(_reward: ReferrerRewardInfo): string { return '' }
export function getCachedReferrerReward(): ReferrerRewardInfo | null { return null }
export async function getCachedOrFetchPassesEligibility(): Promise<PassesEligibility> {
  return { eligible: false, remainingPasses: 0 }
}
export function getCachedRemainingPasses(): number { return 0 }
export async function prefetchPassesEligibility(): Promise<void> {}
