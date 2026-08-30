// NYXCLAUDE: OAuth/login removed. These functions were previously in
// src/commands/logout/logout.tsx (deleted). Kept here for auth.ts imports.

import { removeApiKey } from '../../utils/auth.js'
import { clearBetasCaches } from '../../utils/betas.js'
import { saveGlobalConfig } from '../../utils/config.js'
import { getSecureStorage } from '../../utils/secureStorage/index.js'
import { clearToolSchemaCache } from '../../utils/toolSchemaCache.js'
import { resetUserCache } from '../../utils/user.js'
import { refreshGrowthBookAfterAuthChange } from '../../services/analytics/growthbook.js'
import { clearPolicyLimitsCache } from '../../services/policyLimits/index.js'
import { clearRemoteManagedSettingsCache } from '../../services/remoteManagedSettings/index.js'

export async function performLogout({
  clearOnboarding = false,
}: {
  clearOnboarding?: boolean
}): Promise<void> {
  await removeApiKey()

  const secureStorage = getSecureStorage()
  secureStorage.delete()
  await clearAuthRelatedCaches()
  saveGlobalConfig(current => {
    const updated = { ...current }
    if (clearOnboarding) {
      updated.hasCompletedOnboarding = false
      updated.subscriptionNoticeCount = 0
      updated.hasAvailableSubscription = false
      if (updated.customApiKeyResponses?.approved) {
        updated.customApiKeyResponses = {
          ...updated.customApiKeyResponses,
          approved: [],
        }
      }
    }
    updated.oauthAccount = undefined
    return updated
  })
}

export async function clearAuthRelatedCaches(): Promise<void> {
  clearBetasCaches()
  clearToolSchemaCache()
  resetUserCache()
  refreshGrowthBookAfterAuthChange()
  await clearRemoteManagedSettingsCache()
  await clearPolicyLimitsCache()
}
