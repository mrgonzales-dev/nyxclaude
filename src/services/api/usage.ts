// ponytail: Usage API removed — Anthropic subscription feature.
export type RateLimit = { utilization: number | null; resets_at: string | null }
export type ExtraUsage = { is_enabled: boolean; monthly_limit: number | null; used_credits: number | null; utilization: number | null }
export type Utilization = {
  rate_limit: RateLimit | null
  extra_usage: ExtraUsage | null
  subscription_type: string | null
  rate_limit_tier: string | null
  primary_plan: string | null
}
export async function fetchUtilization(): Promise<Utilization | null> { return null }
