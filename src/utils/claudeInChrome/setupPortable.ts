// NYXCLAUDE: Chrome integration removed — stubbed.

export const CHROME_EXTENSION_URL = ''

export type ChromiumBrowser = 'chrome' | 'chromium' | 'brave' | 'edge' | 'arc'

export type BrowserPath = {
  browser: ChromiumBrowser
  dataPath: string
  nativeMessagingPath: string
}

export function getAllBrowserDataPathsPortable(): BrowserPath[] {
  return []
}

export async function detectExtensionInstallationPortable(): Promise<ChromiumBrowser | null> {
  return null
}

export async function isChromeExtensionInstalledPortable(): Promise<boolean> {
  return false
}

export function isChromeExtensionInstalled(): Promise<boolean> {
  return Promise.resolve(false)
}
