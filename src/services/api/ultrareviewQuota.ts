// ponytail: Ultrareview quota removed — Anthropic subscription feature.
export type UltrareviewQuotaResponse = {
  reviews_used: number
  reviews_limit: number
  reviews_remaining: number
  is_overage: boolean
}
export async function fetchUltrareviewQuota(): Promise<UltrareviewQuotaResponse | null> { return null }
