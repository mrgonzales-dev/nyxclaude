// NYXCLAUDE: Chrome integration removed — stubbed.
import type { ScopedMcpServerConfig } from '../../services/mcp/types.js'

export type ClaudeInChromeStartupMode = 'disabled' | 'explicit' | 'auto'

export function resolveClaudeInChromeStartupMode(_args: {
  explicitEnabled: boolean
  autoEnabled: boolean
  hasClaudeInChromeAccess: boolean
}): ClaudeInChromeStartupMode {
  return 'disabled'
}

export function mergeClaudeInChromeStartupConfig(args: {
  mode: ClaudeInChromeStartupMode
  setupResult: unknown
  dynamicMcpConfig?: Record<string, ScopedMcpServerConfig>
  appendSystemPrompt?: string
  hasWebBrowserTool?: boolean
}): {
  tools: unknown[]
  mcpServerConfig: unknown
  dynamicMcpConfig: Record<string, ScopedMcpServerConfig>
  allowedTools: string[]
  appendSystemPrompt: string
} {
  return {
    tools: [],
    mcpServerConfig: null,
    dynamicMcpConfig: args.dynamicMcpConfig ?? {},
    allowedTools: [],
    appendSystemPrompt: args.appendSystemPrompt ?? '',
  }
}
