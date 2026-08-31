// ponytail: OAuth auth handler removed — API key only.
// These functions are kept as no-op stubs for backward compat with main.tsx.

export async function installOAuthTokens(_tokens: unknown): Promise<void> {}
export async function authLogin(_opts: unknown): Promise<void> {
  console.error('OAuth login is not available in this build. Set ANTHROPIC_API_KEY env var instead.')
  process.exit(1)
}
export async function authStatus(_opts: unknown): Promise<void> {
  console.log('API key authentication only. Set ANTHROPIC_API_KEY env var.')
}
export async function authLogout(): Promise<void> {
  console.log('Logged out. Set ANTHROPIC_API_KEY env var to authenticate.')
}
