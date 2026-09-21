import { describe, expect, test } from 'bun:test'
import {
  getLanguageIntegritySection,
  getOutputEfficiencySection,
  getReasoningSection,
  LANGUAGE_INTEGRITY_SUBAGENT_LINE,
} from './prompts.js'

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

describe('getLanguageIntegritySection', () => {
  const section = getLanguageIntegritySection()

  test('has a Language integrity heading', () => {
    expect(section).toContain('# Language integrity')
  })

  test('bans Chinese thinking and replies', () => {
    expect(section).toContain('Never think')
    expect(section).toContain('Never reply')
  })

  test('declares precedence over language preference', () => {
    expect(section).toContain('takes precedence')
  })

  test('includes hard self-correct knock/poke', () => {
    expect(section).toContain('ENGLISH ONLY')
    expect(section).toContain('STOP')
  })

  test('subagent line carries the same hard rule', () => {
    expect(LANGUAGE_INTEGRITY_SUBAGENT_LINE).toContain('ENGLISH ONLY')
    expect(LANGUAGE_INTEGRITY_SUBAGENT_LINE).toContain('never think')
  })
})
