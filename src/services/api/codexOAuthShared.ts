// ponytail: Codex OAuth shared constants removed.
export const CODEX_OAUTH_ISSUER = 'https://auth.openai.com'
export const CODEX_REFRESH_URL = `${CODEX_OAUTH_ISSUER}/oauth/token`
export const DEFAULT_CODEX_OAUTH_CLIENT_ID = ''
export const DEFAULT_CODEX_OAUTH_CALLBACK_PORT = 1455
export const DEFAULT_CODEX_OAUTH_CALLBACK_HOST = 'localhost'
export const CODEX_OAUTH_SCOPE = ''
export const CODEX_OAUTH_ORIGINATOR = 'codex_cli_rs'
export const CODEX_API_KEY_TOKEN_NAME = 'openai-api-key'
export const CODEX_ID_TOKEN_SUBJECT_TYPE = ''
export const CODEX_TOKEN_EXCHANGE_GRANT = ''
export function asTrimmedString(value: unknown): string | undefined {
  return typeof value === 'string' ? value.trim() : undefined
}
export function getCodexOAuthClientId(): string { return DEFAULT_CODEX_OAUTH_CLIENT_ID }
export function getCodexOAuthCallbackPort(): number { return DEFAULT_CODEX_OAUTH_CALLBACK_PORT }
export function getCodexOAuthCallbackHost(): string { return DEFAULT_CODEX_OAUTH_CALLBACK_HOST }
export function getCodexOAuthCallbackOrigin(): string { return `http://${DEFAULT_CODEX_OAUTH_CALLBACK_HOST}:${DEFAULT_CODEX_OAUTH_CALLBACK_PORT}` }
export function decodeJwtPayload(_token: string): Record<string, unknown> | null { return null }
export function parseChatgptAccountId(_token: string): string | null { return null }
export function escapeHtml(value: string): string { return value }
export async function exchangeCodexIdTokenForApiKey(_params: unknown): Promise<string | null> { return null }
