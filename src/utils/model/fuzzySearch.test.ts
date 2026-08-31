import { describe, expect, test } from 'bun:test'
import { fuzzySearch, type FuzzySearchableOption } from './fuzzySearch.js'

const OPTIONS: FuzzySearchableOption[] = [
  { value: 'claude-opus-4-6', label: 'Opus 4.6', description: 'Most capable' },
  { value: 'claude-sonnet-4-5', label: 'Sonnet 4.5', description: 'Balanced' },
  { value: 'claude-haiku-4-2', label: 'Haiku 4.2', description: 'Fast' },
  { value: 'gpt-5', label: 'GPT-5', description: 'OpenAI model' },
  { value: 'gemini-2-5-pro', label: 'Gemini 2.5 Pro', description: 'Google model' },
]

describe('fuzzySearch', () => {
  test('returns all options for empty query', () => {
    const result = fuzzySearch(OPTIONS, '')
    expect(result).toEqual(OPTIONS)
  })

  test('filters by exact label substring', () => {
    const result = fuzzySearch(OPTIONS, 'opus')
    expect(result.map(r => r.value)).toEqual(['claude-opus-4-6'])
  })

  test('filters by fuzzy label match', () => {
    const result = fuzzySearch(OPTIONS, 'sonet')
    expect(result.map(r => r.value)).toContain('claude-sonnet-4-5')
  })

  test('filters by description', () => {
    const result = fuzzySearch(OPTIONS, 'google')
    expect(result.map(r => r.value)).toEqual(['gemini-2-5-pro'])
  })

  test('ranks better matches before worse matches', () => {
    const result = fuzzySearch(OPTIONS, 'pro')
    expect(result[0]!.value).toBe('gemini-2-5-pro')
  })

  test('returns empty array when nothing matches', () => {
    const result = fuzzySearch(OPTIONS, 'xyz')
    expect(result).toEqual([])
  })

  test('case-insensitive matching', () => {
    const upper = fuzzySearch(OPTIONS, 'OPUS')
    const lower = fuzzySearch(OPTIONS, 'opus')
    expect(upper.map(r => r.value)).toEqual(lower.map(r => r.value))
  })

  test('multi-word query matches within a single field', () => {
    const result = fuzzySearch(OPTIONS, 'gemini pro')
    expect(result.map(r => r.value)).toContain('gemini-2-5-pro')
  })

  test('preserves option properties in results', () => {
    const result = fuzzySearch(OPTIONS, 'opus')
    expect(result[0]).toEqual(OPTIONS[0])
  })

  test('handles whitespace-only query as empty', () => {
    const result = fuzzySearch(OPTIONS, '   ')
    expect(result).toEqual(OPTIONS)
  })
})
