// NYXCLAUDE: OAuth removed — API key only.

export class OAuthService {
  constructor(..._args: unknown[]) {}
  async getAuthUrl(): Promise<string> { return '' }
  async exchangeCodeForToken(_code: string): Promise<null> { return null }
  async refreshToken(_tokens: unknown): Promise<null> { return null }
}
