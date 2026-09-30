import { afterEach, beforeEach, expect, test } from 'bun:test'

import {
  acquireSharedMutationLock,
  releaseSharedMutationLock,
} from '../../test/sharedMutationLock.js'
import {
  type GlobalConfig,
  getGlobalConfig,
  saveGlobalConfig,
} from '../config.js'
import { getDefaultMainLoopModelSetting, getUserSpecifiedModelSetting } from './model.js'

const env = {
  NYXCLAUDE_USE_GITHUB: process.env.NYXCLAUDE_USE_GITHUB,
  NYXCLAUDE_USE_OPENAI: process.env.NYXCLAUDE_USE_OPENAI,
  NYXCLAUDE_USE_GEMINI: process.env.NYXCLAUDE_USE_GEMINI,
  NYXCLAUDE_USE_BEDROCK: process.env.NYXCLAUDE_USE_BEDROCK,
  NYXCLAUDE_USE_VERTEX: process.env.NYXCLAUDE_USE_VERTEX,
  NYXCLAUDE_USE_FOUNDRY: process.env.NYXCLAUDE_USE_FOUNDRY,
  OPENAI_MODEL: process.env.OPENAI_MODEL,
}
// `model` is a legacy loose key not declared on GlobalConfig.
const originalModel = (getGlobalConfig() as GlobalConfig & Record<string, unknown>).model

function restoreEnv(key: keyof typeof env): void {
  if (env[key] === undefined) {
    delete process.env[key]
  } else {
    process.env[key] = env[key]
  }
}

beforeEach(async () => {
  await acquireSharedMutationLock('model/model.github.test.ts')
  process.env.NYXCLAUDE_USE_GITHUB = '1'
  delete process.env.NYXCLAUDE_USE_OPENAI
  delete process.env.NYXCLAUDE_USE_GEMINI
  delete process.env.NYXCLAUDE_USE_BEDROCK
  delete process.env.NYXCLAUDE_USE_VERTEX
  delete process.env.NYXCLAUDE_USE_FOUNDRY
  delete process.env.OPENAI_MODEL
  saveGlobalConfig(current => ({
    ...current,
    model: ({ bad: true } as unknown) as string,
  }))
})

afterEach(() => {
  try {
    for (const key of Object.keys(env) as Array<keyof typeof env>) {
      restoreEnv(key)
    }
    saveGlobalConfig(current => ({
      ...current,
      model: originalModel,
    }))
  } finally {
    releaseSharedMutationLock()
  }
})

test('github default model setting ignores non-string saved model', () => {
  const model = getDefaultMainLoopModelSetting()
  expect(typeof model).toBe('string')
  expect(model).not.toBe('[object Object]')
  expect(model.length).toBeGreaterThan(0)
})

test('user specified model ignores non-string saved model', () => {
  const model = getUserSpecifiedModelSetting()
  if (model !== undefined && model !== null) {
    expect(typeof model).toBe('string')
    expect(model).not.toBe('[object Object]')
  }
})
