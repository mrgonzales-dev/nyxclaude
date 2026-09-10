import type { ScopedMcpServerConfig } from './types.js'

/**
 * Nyxclaude: web console MCP auto-fetch removed.
 * Returns empty config — no servers are fetched from web console.
 */
export async function fetchRemoteMcpConfigsIfEligible(): Promise<
  Record<string, ScopedMcpServerConfig>
> {
  return {}
}

/** No-op — no web console MCP connections to track. */
export function markRemoteMcpConnected(_name: string): void {}

/** No-op — no web console MCP connections to track. */
export function hasRemoteMcpEverConnected(): boolean {
  return false
}

/** No-op — no web console MCP auth cache to clear. */
export function clearRemoteMcpAuthCache(): void {}

/** No-op — no web console MCP config cache to clear. */
export function clearRemoteMcpConfigsCache(): void {}
