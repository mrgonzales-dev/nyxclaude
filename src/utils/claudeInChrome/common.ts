// NYXCLAUDE: Chrome integration removed — stubbed.
// All functions return empty/false/null. Constants kept for import compatibility.

export const CLAUDE_IN_CHROME_MCP_SERVER_NAME = 'claude-in-chrome'

export type ChromiumBrowser = 'chrome' | 'chromium' | 'brave' | 'edge' | 'arc'

export const CHROMIUM_BROWSERS: Record<string, unknown> = {}
export const BROWSER_DETECTION_ORDER: ChromiumBrowser[] = []

export function getAllBrowserDataPaths(): { macos: string[]; linux: string[]; windows: string[] } {
  return { macos: [], linux: [], windows: [] }
}

export function getAllNativeMessagingHostsDirs(): string[] {
  return []
}

export function getAllWindowsRegistryKeys(): string[] {
  return []
}

export async function detectAvailableBrowser(): Promise<ChromiumBrowser | null> {
  return null
}

export function isClaudeInChromeMCPServer(name: string): boolean {
  return name === CLAUDE_IN_CHROME_MCP_SERVER_NAME
}

export function trackClaudeInChromeTabId(_tabId: number): void {
  // no-op
}

export function isTrackedClaudeInChromeTabId(_tabId: number): boolean {
  return false
}

export async function openInChrome(_url: string): Promise<boolean> {
  return false
}

export function getSocketDir(): string {
  return ''
}

export function getSecureSocketPath(): string {
  return ''
}

export function getAllSocketPaths(): string[] {
  return []
}
