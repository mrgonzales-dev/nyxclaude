// NYXCLAUDE: OAuth removed — API key only. These types are stubs kept for
// backward compat with modules that still import them.

export type OAuthTokens = {
  accessToken: string
  refreshToken: string
  expiresAt: number
  scopes?: string[]
}

export type SubscriptionType = string

export type AccountInfo = {
  organizationUuid?: string
  organizationName?: string
  accountEmail?: string
  subscriptionType?: SubscriptionType
}

export type ReferralRedemptionsResponse = {
  data?: unknown[]
}

export type ReferrerRewardInfo = {
  rewardType?: string
}
