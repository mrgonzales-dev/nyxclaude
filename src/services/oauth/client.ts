// NYXCLAUDE: OAuth removed — API key only. All functions are no-op stubs.
import type { AccountInfo, OAuthTokens, SubscriptionType } from './types.js'

export function isOAuthTokenExpired(_tokens: OAuthTokens): boolean {
  return true
}

export async function refreshOAuthToken(_tokens: OAuthTokens): Promise<OAuthTokens | null> {
  return null
}

export function shouldUseClaudeAIAuth(): boolean {
  return false
}

export function getOrganizationUUID(): string | null {
  return null
}

export async function populateOAuthAccountInfoIfNeeded(): Promise<void> {}

export function getOauthAccountInfo(): AccountInfo | undefined {
  return undefined
}

export function getSubscriptionType(): SubscriptionType | null {
  return null
}

export async function createAndStoreApiKey(_tokens: OAuthTokens): Promise<string | null> {
  return null
}

export async function fetchAndStoreUserRoles(_tokens: OAuthTokens): Promise<void> {}

export function storeOAuthAccountInfo(_account: AccountInfo): void {}
