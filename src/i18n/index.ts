export type { LocalizationKey, InterpolationValues, Locale } from './types.js'
export { getNyxclaudeCommandDescriptionKey } from './commandDescriptions.js'
export function detectLocale(): string {
  return 'en'
}
export function localize(
  key: string | undefined,
  _values?: Record<string, string | number>,
): string {
  return key ?? ''
}
