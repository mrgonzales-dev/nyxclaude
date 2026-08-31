// ponytail: Ultrareview command removed — Anthropic subscription feature.
import type { LocalJSXCommandCall } from '../../types/command.js'
export const call: LocalJSXCommandCall = async (onDone) => {
  onDone('Ultrareview is not available.', { display: 'system' })
  return null
}
