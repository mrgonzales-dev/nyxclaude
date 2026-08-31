// ponytail: Tip scheduler removed — cosmetic feature.
import type { Tip } from './types.js'
export function selectTipWithLongestTimeSinceShown(_tips: Tip[]): Tip | null { return null }
export async function getTipToShowOnSpinner(): Promise<Tip | null> { return null }
export function recordShownTip(_tip: Tip): void {}
