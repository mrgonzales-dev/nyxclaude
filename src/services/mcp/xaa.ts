// ponytail: XAA (Cross-App Access) removed — enterprise MCP auth feature.
// Gated by CLAUDE_CODE_ENABLE_XAA env var which defaults to false.
export class XaaTokenExchangeError extends Error {}
export type ProtectedResourceMetadata = unknown
export type AuthorizationServerMetadata = unknown
export type JwtAuthGrantResult = unknown
export type XaaTokenResult = { access_token: string; expires_in: number; refresh_token?: string }
export type XaaResult = XaaTokenResult & { resource_metadata?: ProtectedResourceMetadata }
export async function discoverProtectedResource(_url: string): Promise<ProtectedResourceMetadata | null> { return null }
export async function discoverAuthorizationServer(_url: string): Promise<AuthorizationServerMetadata | null> { return null }
export async function requestJwtAuthorizationGrant(_opts: unknown): Promise<JwtAuthGrantResult | null> { return null }
export async function exchangeJwtAuthGrant(_opts: unknown): Promise<XaaTokenResult | null> { return null }
export async function performCrossAppAccess(_opts: unknown): Promise<XaaResult | null> { return null }
