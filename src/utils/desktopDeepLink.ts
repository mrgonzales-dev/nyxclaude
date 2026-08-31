// ponytail: Desktop deep link removed — Anthropic Desktop app feature.
export type DesktopInstallStatus = { installed: boolean; version?: string }
export async function getDesktopInstallStatus(): Promise<DesktopInstallStatus> {
  return { installed: false }
}
export async function openCurrentSessionInDesktop(): Promise<{ success: boolean; error?: string }> {
  return { success: false, error: 'Desktop app not available' }
}
