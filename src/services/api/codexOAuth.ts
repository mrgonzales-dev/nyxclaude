// ponytail: Codex OAuth removed — use OPENAI_API_KEY env var instead.
export type CodexOAuthTokens = { access_token: string; refresh_token: string; expires_at: number }
export type CodexManualCallbackResult = { code: string; state: string }
export class CodexOAuthService {
  constructor(..._args: unknown[]) {}
  async getAuthUrl(): Promise<string> { return '' }
  async waitForCode(): Promise<string | null> { return null }
  async exchangeCodeForTokens(_code: string): Promise<CodexOAuthTokens | null> { return null }
  async refreshTokens(_tokens: CodexOAuthTokens): Promise<CodexOAuthTokens | null> { return null }
}
