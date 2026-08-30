export const PRODUCT_DISPLAY_NAME = 'Nyxclaude'
export const PRODUCT_URL = 'https://github.com/mrg/nyxclaude'

// Remote session URLs — neutralized. Bridge code is deleted; remote sessions
// are not supported. These constants remain for type compat with downstream
// consumers but resolve to inert values.
export const CLAUDE_AI_BASE_URL = ''
export const CLAUDE_AI_STAGING_BASE_URL = ''
export const CLAUDE_AI_LOCAL_BASE_URL = ''

export function isRemoteSessionStaging(
  _sessionId?: string,
  _ingressUrl?: string,
): boolean {
  return false
}

export function isRemoteSessionLocal(
  _sessionId?: string,
  _ingressUrl?: string,
): boolean {
  return false
}

export function getClaudeAiBaseUrl(
  _sessionId?: string,
  _ingressUrl?: string,
): string {
  return ''
}

/**
 * Remote session URL — returns empty string. Remote sessions are not supported.
 */
export function getRemoteSessionUrl(
  _sessionId: string,
  _ingressUrl?: string,
): string {
  return ''
}
