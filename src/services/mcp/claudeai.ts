import type { ScopedMcpServerConfig } from './types.js'

/**
 * Nyxclaude: claude.ai MCP auto-fetch removed.
 * Returns empty config — no servers are fetched from claude.ai.
 */
export async function fetchClaudeAIMcpConfigsIfEligible(): Promise<
  Record<string, ScopedMcpServerConfig>
> {
  return {}
}

/** No-op — no claude.ai MCP connections to track. */
export function markClaudeAiMcpConnected(_name: string): void {}

/** No-op — no claude.ai MCP connections to track. */
export function hasClaudeAiMcpEverConnected(): boolean {
  return false
}

/** No-op — no claude.ai MCP auth cache to clear. */
export function clearClaudeAiMcpAuthCache(): void {}

/** No-op — no claude.ai MCP config cache to clear. */
export function clearClaudeAIMcpConfigsCache(): void {}
