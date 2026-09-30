// ponytail: OAuth config removed — API key only. Stubs kept for backward compat.

export function fileSuffixForOauthConfig(): string { return '' }
export const REMOTE_INFERENCE_SCOPE = 'user:inference' as const
export const REMOTE_PROFILE_SCOPE = 'user:profile' as const
export const OAUTH_BETA_HEADER = 'oauth-2025-04-20' as const
export const CONSOLE_OAUTH_SCOPES: string[] = []
export const REMOTE_OAUTH_SCOPES: string[] = []
export const ALL_OAUTH_SCOPES: string[] = []
export const MCP_CLIENT_METADATA_URL = ''
export type OauthConfig = {
  consoleApiUrl: string
  remoteUrl: string
  clientId: string
  redirectPort: number
  redirectPath: string
  redirectHost: string
  redirectProtocol: 'http' | 'https'
  pkceRequired: boolean
  codeChallengeMethod: 'S256' | 'plain'
  authorizationUrl: string
  tokenUrl: string
  scope: string
  BASE_API_URL: string
}
export function getOauthConfig(): OauthConfig {
  return {
    consoleApiUrl: '',
    remoteUrl: '',
    clientId: '',
    redirectPort: 0,
    redirectPath: '',
    redirectHost: '',
    redirectProtocol: 'http',
    pkceRequired: false,
    codeChallengeMethod: 'S256',
    authorizationUrl: '',
    tokenUrl: '',
    scope: '',
    BASE_API_URL: '',
  }
}
