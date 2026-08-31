// ponytail: XAI OAuth callback removed — no external refs.
export type XaiOAuthCallbackResult = { code: string; state: string }
export type XaiOAuthCallbackHandle = { url: string; cancel: () => void }
export async function startXaiOAuthCallback(_params: unknown): Promise<XaiOAuthCallbackHandle> {
  return { url: '', cancel: () => {} }
}
