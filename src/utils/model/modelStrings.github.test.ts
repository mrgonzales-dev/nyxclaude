import { afterEach, beforeEach, expect, test } from 'bun:test'

import { resetModelStringsForTestingOnly } from '../../bootstrap/state.js'
import {
  acquireSharedMutationLock,
  releaseSharedMutationLock,
} from '../../test/sharedMutationLock.js'
import { parseUserSpecifiedModel } from './model.js'
import { getModelStrings } from './modelStrings.js'

const originalEnv = {
  NYXCLAUDE_USE_GITHUB: process.env.NYXCLAUDE_USE_GITHUB,
  NYXCLAUDE_USE_OPENAI: process.env.NYXCLAUDE_USE_OPENAI,
  NYXCLAUDE_USE_GEMINI: process.env.NYXCLAUDE_USE_GEMINI,
  NYXCLAUDE_USE_BEDROCK: process.env.NYXCLAUDE_USE_BEDROCK,
  NYXCLAUDE_USE_VERTEX: process.env.NYXCLAUDE_USE_VERTEX,
  NYXCLAUDE_USE_FOUNDRY: process.env.NYXCLAUDE_USE_FOUNDRY,
}

function clearProviderFlags(): void {
  delete process.env.NYXCLAUDE_USE_GITHUB
  delete process.env.NYXCLAUDE_USE_OPENAI
  delete process.env.NYXCLAUDE_USE_GEMINI
  delete process.env.NYXCLAUDE_USE_BEDROCK
  delete process.env.NYXCLAUDE_USE_VERTEX
  delete process.env.NYXCLAUDE_USE_FOUNDRY
}

function restoreEnv(key: keyof typeof originalEnv): void {
  if (originalEnv[key] === undefined) {
    delete process.env[key]
  } else {
    process.env[key] = originalEnv[key]
  }
}

beforeEach(async () => {
  await acquireSharedMutationLock('model/modelStrings.github.test.ts')
})

afterEach(() => {
  try {
    for (const key of Object.keys(originalEnv) as Array<keyof typeof originalEnv>) {
      restoreEnv(key)
    }
    resetModelStringsForTestingOnly()
  } finally {
    releaseSharedMutationLock()
  }
})

test('GitHub provider model strings are concrete IDs', () => {
  clearProviderFlags()
  process.env.NYXCLAUDE_USE_GITHUB = '1'

  const modelStrings = getModelStrings()

  for (const value of Object.values(modelStrings)) {
    expect(typeof value).toBe('string')
    expect(value.trim().length).toBeGreaterThan(0)
  }
})

test('GitHub provider model strings are safe to parse', () => {
  clearProviderFlags()
  process.env.NYXCLAUDE_USE_GITHUB = '1'

  const modelStrings = getModelStrings()

  expect(() => parseUserSpecifiedModel(modelStrings.sonnet46 as any)).not.toThrow()
})
