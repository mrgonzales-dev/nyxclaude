import { afterEach, beforeEach, expect, test } from 'bun:test'
import { mock } from 'bun:test'

import { resetModelStringsForTestingOnly } from '../../bootstrap/state.js'
import {
  acquireSharedMutationLock,
  releaseSharedMutationLock,
} from '../../test/sharedMutationLock.js'
import { getGlobalConfig, saveGlobalConfig } from '../config.js'
import {
  resetSettingsCache,
  setSessionSettingsCache,
} from '../settings/settingsCache.js'

async function importFreshModelOptionsModule() {
  mock.restore()
  mock.module('./providers.js', () => ({
    getAPIProvider: () => 'github',
    getAPIProviderForStatsig: () => 'github',
    isFirstPartyAnthropicBaseUrl: () => false,
    isGithubNativeAnthropicMode: () => false,
    usesAnthropicAccountFlow: () => false,
  }))
  const nonce = `${Date.now()}-${Math.random()}`
  return import(`./modelOptions.js?ts=${nonce}`)
}

const originalEnv = {
  NYXCLAUDE_USE_GITHUB: process.env.NYXCLAUDE_USE_GITHUB,
  NYXCLAUDE_USE_OPENAI: process.env.NYXCLAUDE_USE_OPENAI,
  NYXCLAUDE_USE_GEMINI: process.env.NYXCLAUDE_USE_GEMINI,
  NYXCLAUDE_USE_BEDROCK: process.env.NYXCLAUDE_USE_BEDROCK,
  NYXCLAUDE_USE_VERTEX: process.env.NYXCLAUDE_USE_VERTEX,
  NYXCLAUDE_USE_FOUNDRY: process.env.NYXCLAUDE_USE_FOUNDRY,
  OPENAI_MODEL: process.env.OPENAI_MODEL,
  OPENAI_BASE_URL: process.env.OPENAI_BASE_URL,
  ANTHROPIC_CUSTOM_MODEL_OPTION: process.env.ANTHROPIC_CUSTOM_MODEL_OPTION,
}
const initialConfig = getGlobalConfig()
const originalConfig = {
  additionalModelOptionsCache: structuredClone(
    initialConfig.additionalModelOptionsCache ?? [],
  ),
  additionalModelOptionsCacheScope:
    initialConfig.additionalModelOptionsCacheScope,
  openaiAdditionalModelOptionsCache: structuredClone(
    initialConfig.openaiAdditionalModelOptionsCache ?? [],
  ),
  openaiAdditionalModelOptionsCacheByProfile: structuredClone(
    initialConfig.openaiAdditionalModelOptionsCacheByProfile ?? {},
  ),
  providerProfiles: structuredClone(initialConfig.providerProfiles ?? []),
  activeProviderProfileId: initialConfig.activeProviderProfileId,
}

function restoreEnvValue(
  key: keyof typeof originalEnv,
): void {
  const value = originalEnv[key]
  if (value === undefined) {
    delete process.env[key]
  } else {
    process.env[key] = value
  }
}

beforeEach(async () => {
  await acquireSharedMutationLock('model/modelOptions.github.test.ts')
  mock.restore()
  setSessionSettingsCache({ settings: {}, errors: [] })
  delete process.env.NYXCLAUDE_USE_GITHUB
  delete process.env.NYXCLAUDE_USE_OPENAI
  delete process.env.NYXCLAUDE_USE_GEMINI
  delete process.env.NYXCLAUDE_USE_BEDROCK
  delete process.env.NYXCLAUDE_USE_VERTEX
  delete process.env.NYXCLAUDE_USE_FOUNDRY
  delete process.env.OPENAI_MODEL
  delete process.env.OPENAI_BASE_URL
  delete process.env.ANTHROPIC_CUSTOM_MODEL_OPTION
  resetModelStringsForTestingOnly()
})

afterEach(() => {
  try {
    mock.restore()
    resetSettingsCache()
    restoreEnvValue('NYXCLAUDE_USE_GITHUB')
    restoreEnvValue('NYXCLAUDE_USE_OPENAI')
    restoreEnvValue('NYXCLAUDE_USE_GEMINI')
    restoreEnvValue('NYXCLAUDE_USE_BEDROCK')
    restoreEnvValue('NYXCLAUDE_USE_VERTEX')
    restoreEnvValue('NYXCLAUDE_USE_FOUNDRY')
    restoreEnvValue('OPENAI_MODEL')
    restoreEnvValue('OPENAI_BASE_URL')
    restoreEnvValue('ANTHROPIC_CUSTOM_MODEL_OPTION')
    saveGlobalConfig(current => ({
      ...current,
      additionalModelOptionsCache: originalConfig.additionalModelOptionsCache,
      additionalModelOptionsCacheScope: originalConfig.additionalModelOptionsCacheScope,
      openaiAdditionalModelOptionsCache: originalConfig.openaiAdditionalModelOptionsCache,
      openaiAdditionalModelOptionsCacheByProfile:
        originalConfig.openaiAdditionalModelOptionsCacheByProfile,
      providerProfiles: originalConfig.providerProfiles,
      activeProviderProfileId: originalConfig.activeProviderProfileId,
    }))
    resetModelStringsForTestingOnly()
  } finally {
    releaseSharedMutationLock()
  }
})

test('GitHub provider exposes default + all Copilot models in /model options', async () => {
  process.env.NYXCLAUDE_USE_GITHUB = '1'
  delete process.env.NYXCLAUDE_USE_OPENAI
  delete process.env.NYXCLAUDE_USE_GEMINI
  delete process.env.NYXCLAUDE_USE_BEDROCK
  delete process.env.NYXCLAUDE_USE_VERTEX
  delete process.env.NYXCLAUDE_USE_FOUNDRY

  process.env.OPENAI_MODEL = 'gpt-4o'
  delete process.env.ANTHROPIC_CUSTOM_MODEL_OPTION

  const { getModelOptions } = await importFreshModelOptionsModule()
  const options = getModelOptions(false)
  const nonDefault = options.filter(
    (option: { value: unknown }) => option.value !== null,
  )

  expect(nonDefault.length).toBeGreaterThan(1)
  expect(nonDefault.some((o: { value: unknown }) => o.value === 'gpt-4o')).toBe(true)
  expect(nonDefault.some((o: { value: unknown }) => o.value === 'gpt-5.3-codex')).toBe(true)
})
