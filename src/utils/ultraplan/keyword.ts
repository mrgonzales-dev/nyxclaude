// ponytail: Ultraplan keyword detection removed — feature flag ULTRAPLAN is false.
type TriggerPosition = { word: string; start: number; end: number }
export function findUltraplanTriggerPositions(_text: string): TriggerPosition[] { return [] }
export function findUltrareviewTriggerPositions(_text: string): TriggerPosition[] { return [] }
export function hasUltraplanKeyword(_text: string): boolean { return false }
export function hasUltrareviewKeyword(_text: string): boolean { return false }
export function replaceUltraplanKeyword(text: string): string { return text }
