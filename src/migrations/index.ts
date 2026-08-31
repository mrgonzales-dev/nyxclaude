// All migration functions are no-ops — config migrations are not needed
// in the slimmed-down terminal harness.
export function migrateAutoUpdatesToSettings(): void {}
export function migrateBypassPermissionsAcceptedToSettings(): void {}
export function migrateEnableAllProjectMcpServersToSettings(): void {}
export function migrateLegacyOpusToCurrent(): void {}
export function migrateOpusToOpus1m(): void {}
export function migrateReplBridgeEnabledToRemoteControlAtStartup(): void {}
export function migrateSonnet1mToSonnet45(): void {}
export function migrateSonnet45ToSonnet46(): void {}
export function resetAutoModeOptInForDefaultOffer(): void {}
export function resetProToOpusDefault(): void {}
