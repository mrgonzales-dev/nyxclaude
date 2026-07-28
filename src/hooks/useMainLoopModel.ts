import { useEffect, useReducer } from 'react'
import { onGrowthBookRefresh } from '../services/analytics/growthbook.js'
import { useAppState } from '../state/AppState.js'
import {
  getDefaultMainLoopModelSetting,
  type ModelName,
  parseUserSpecifiedModel,
} from '../utils/model/model.js'
import { hasNoProviderConfigured } from '../utils/providerProfile.js'

// The value of the selector is a full model name that can be used directly in
// API calls. Use this over getMainLoopModel() when the component needs to
// update upon a model config change.
export function useMainLoopModel(): ModelName {
  const mainLoopModel = useAppState(s => s.mainLoopModel)
  const mainLoopModelForSession = useAppState(s => s.mainLoopModelForSession)

  // parseUserSpecifiedModel reads tengu_ant_model_override via
  // _CACHED_MAY_BE_STALE (in resolveAntModel). Until GB init completes,
  // that's the stale disk cache; after, it's the in-memory remoteEval map.
  // AppState doesn't change when GB init finishes, so we subscribe to the
  // refresh signal and force a re-render to re-resolve with fresh values.
  // Without this, the alias resolution is frozen until something else
  // happens to re-render the component — the API would sample one model
  // while /model (which also re-resolves) displays another.
  const [, forceRerender] = useReducer(x => x + 1, 0)
  useEffect(() => onGrowthBookRefresh(forceRerender), [])

  // NYXCLAUDE: when no provider is configured, return a placeholder instead
  // of falling back to getDefaultMainLoopModelSetting() (which returns
  // claude-sonnet-4-6). This prevents the footer from showing "Sonnet 4.6"
  // and the effort indicator when there's no provider to serve the model.
  if (hasNoProviderConfigured()) {
    return '—'
  }

  const model = parseUserSpecifiedModel(
    mainLoopModelForSession ??
      mainLoopModel ??
      getDefaultMainLoopModelSetting(),
  )
  return model
}
