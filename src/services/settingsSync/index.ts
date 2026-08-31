// ponytail: Settings sync removed — Anthropic cloud feature, not needed
// for a basic terminal harness. All functions are no-ops.

export async function uploadUserSettingsInBackground(): Promise<void> {}
export function _resetDownloadPromiseForTesting(): void {}
export async function downloadUserSettings(): Promise<boolean> { return false }
export async function redownloadUserSettings(): Promise<boolean> { return false }
