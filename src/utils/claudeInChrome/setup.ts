// NYXCLAUDE: Chrome integration removed — all functions stubbed to no-op/false.
// The source has been removed to eliminate the @ant/claude-for-chrome-mcp
// dependency and all Chrome extension integration code.

export function shouldEnableClaudeInChrome(_chromeFlag?: boolean): boolean {
  return false
}

export function shouldAutoEnableClaudeInChrome(): boolean {
  return false
}

export function setupClaudeInChrome(): {
  mcpServerConfig: unknown
  tools: unknown[]
  error?: string
} {
  return { mcpServerConfig: null, tools: [] }
}

export async function installChromeNativeHostManifest(): Promise<{
  success: boolean
  error?: string
}> {
  return { success: false, error: 'Chrome integration removed' }
}

export async function isChromeExtensionInstalled(): Promise<boolean> {
  return false
}
