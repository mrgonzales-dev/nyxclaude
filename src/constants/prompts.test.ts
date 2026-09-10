import { describe, expect, test } from 'bun:test'
import { getOutputEfficiencySection, getReasoningSection } from './prompts.js'

describe('getReasoningSection', () => {
  const section = getReasoningSection()

  test('has a Reasoning heading', () => {
    expect(section).toContain('# Reasoning')
  })

  test('mentions decomposition and verification', () => {
    expect(section).toContain('Decompose')
    expect(section).toContain('Verify')
  })

  test('distinguishes output brevity from internal reasoning', () => {
    expect(section).toContain('output brevity')
    expect(section).toContain('internal reasoning')
  })

  test('guides models with and without native thinking', () => {
    expect(section).toContain('native thinking or reasoning')
  })
})

describe('getOutputEfficiencySection', () => {
  const section = getOutputEfficiencySection()

  test('says narration not reasoning', () => {
    expect(section).toContain('not narration of your reasoning')
  })
})
