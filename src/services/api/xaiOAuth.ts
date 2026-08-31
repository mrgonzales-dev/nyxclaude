// ponytail: XAI OAuth removed — use XAI_API_KEY env var instead.
export type XaiOAuthTokens = { access_token: string; refresh_token: string; expires_at: number }
export type XaiDeviceCode = { device_code: string; user_code: string; verification_uri: string; expires_in: number; interval: number }
export type XaiOAuthFlowHandle = { url: string; cancel: () => void }
export class XaiOAuthService {
  constructor(..._args: unknown[]) {}
  async getAuthUrl(): Promise<string> { return '' }
  async waitForCode(): Promise<string | null> { return null }
  async exchangeCodeForTokens(_code: string): Promise<XaiOAuthTokens | null> { return null }
  async refreshTokens(_tokens: XaiOAuthTokens): Promise<XaiOAuthTokens | null> { return null }
}
export async function requestXaiDeviceCode(_options?: unknown): Promise<XaiDeviceCode | null> { return null }
export async function pollXaiDeviceCode(_params: unknown): Promise<XaiOAuthTokens | null> { return null }
export async function refreshXaiAccessToken(_params: unknown): Promise<XaiOAuthTokens | null> { return null }
export async function startXaiOAuthCallback(_port: number): Promise<XaiOAuthFlowHandle> {
  return { url: '', cancel: () => {} }
}
