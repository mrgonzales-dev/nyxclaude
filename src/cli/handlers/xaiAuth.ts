// ponytail: XAI OAuth removed — use XAI_API_KEY env var instead.
export type XaiLoginFlow = 'browser' | 'device-code'
export async function xaiLogin(_options: { flow?: XaiLoginFlow }): Promise<void> {
  console.error('XAI OAuth is not available. Set XAI_API_KEY env var instead.')
  process.exit(1)
}
export type XaiLogoutDeps = { removeApiKey: () => Promise<void> }
export async function xaiLogout(_deps?: XaiLogoutDeps): Promise<void> {
  console.log('Logged out. Set XAI_API_KEY env var to authenticate.')
}
export async function xaiStatus(): Promise<void> {
  console.log('API key authentication only. Set XAI_API_KEY env var.')
}
