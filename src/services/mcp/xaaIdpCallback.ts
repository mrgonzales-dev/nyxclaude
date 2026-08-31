// ponytail: XAA IdP callback removed — enterprise MCP auth feature.
export type XaaIdpCallbackValidationResult = { valid: boolean; error?: string }
export function validateXaaIdpCallbackParams(_params: unknown): XaaIdpCallbackValidationResult {
  return { valid: false, error: 'XAA not available' }
}
export function shouldCompleteXaaIdpCallback(_params: unknown): boolean { return false }
