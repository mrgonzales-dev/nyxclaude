// ponytail: Tip registry removed — cosmetic feature.
import type { Tip, TipContext } from './types.js'
export function getCustomCommandsTipContent(): string { return '' }
export async function getRelevantTips(_context?: TipContext): Promise<Tip[]> { return [] }
