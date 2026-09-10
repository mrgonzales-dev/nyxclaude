import { expect, test } from 'bun:test'
import { getVerifierSystemPrompt, VERIFIER_AGENT } from './verifierAgent.js'

test('verifier agent is a built-in agent with correct type', () => {
  expect(VERIFIER_AGENT.agentType).toBe('verifier')
  expect(VERIFIER_AGENT.source).toBe('built-in')
})

test('verifier agent has read-only tools (no edit/write)', () => {
  const disallowed = VERIFIER_AGENT.disallowedTools ?? []
  expect(disallowed).toContain('Edit')
  expect(disallowed).toContain('Write')
  expect(disallowed).toContain('Agent')
})

test('verifier agent prompt focuses on verification and adversarial checking', () => {
  const prompt = getVerifierSystemPrompt()
  expect(prompt.toLowerCase()).toContain('verif')
  expect(prompt.toLowerCase()).toContain('fail')
  expect(prompt.toLowerCase()).toContain('pass')
})
