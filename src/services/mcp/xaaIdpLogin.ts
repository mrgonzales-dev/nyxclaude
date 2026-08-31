// ponytail: XAA IdP login removed — enterprise MCP auth feature.
// Gated by CLAUDE_CODE_ENABLE_XAA env var which defaults to false.
export function isXaaEnabled(): boolean {
  return false
}
export type XaaIdpSettings = { issuer: string; clientId: string; scope?: string }
export function getXaaIdpSettings(): XaaIdpSettings | undefined { return undefined }
export type IdpLoginOptions = { issuer: string; clientId: string; scope?: string }
export function issuerKey(issuer: string): string { return `xaa:idp:${issuer}` }
export function getCachedIdpIdToken(_idpIssuer: string): string | undefined { return undefined }
export function saveIdpIdTokenFromJwt(_idpIssuer: string, _jwt: string): void {}
export function clearIdpIdToken(_idpIssuer: string): void {}
export function saveIdpClientSecret(_idpIssuer: string, _secret: string): void {}
export function getIdpClientSecret(_idpIssuer: string): string | undefined { return undefined }
export function clearIdpClientSecret(_idpIssuer: string): void {}
export async function discoverOidc(_issuer: string): Promise<unknown | null> { return null }
export async function acquireIdpIdToken(_opts: unknown): Promise<string | null> { return null }
