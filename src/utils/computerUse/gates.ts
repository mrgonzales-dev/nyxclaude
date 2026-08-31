// ponytail: Computer Use gates removed — Anthropic-specific feature.
export type CuSubGates = { enabled: boolean }
export type CoordinateMode = 'absolute' | 'relative'
export function getChicagoEnabled(): boolean { return false }
export function getChicagoSubGates(): CuSubGates { return { enabled: false } }
export function getChicagoCoordinateMode(): CoordinateMode { return 'absolute' }
