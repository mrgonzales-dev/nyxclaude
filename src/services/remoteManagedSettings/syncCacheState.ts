// ponytail: Remote managed settings sync cache removed — no-op stubs.
import type { SettingsJson } from '../../utils/settings/types.js'

export function setSessionCache(_value: SettingsJson | null): void {}
export function resetSyncCache(): void {}
export function setEligibility(_v: boolean): boolean { return false }
export function getSettingsPath(): string { return '' }
export function getRemoteManagedSettingsSyncFromCache(): SettingsJson | null { return null }
