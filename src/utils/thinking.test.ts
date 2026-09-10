import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'
import {
  acquireSharedMutationLock,
  releaseSharedMutationLock,
} from '../test/sharedMutationLock.js'
import { resetSettingsCache } from './settings/settingsCache.js'

const ENV_KEYS = [
  'NYXCLAUDE_USE_OPENAI',
  'NYXCLAUDE_USE_GEMINI',
  'NYXCLAUDE_USE_GITHUB',
  'NYXCLAUDE_USE_MISTRAL',
  'NYXCLAUDE_USE_BEDROCK',
  'NYXCLAUDE_USE_VERTEX',
  'NYXCLAUDE_USE_FOUNDRY',
  'OPENAI_BASE_URL',
  'OPENAI_API_BASE',
  'OPENAI_MODEL',
  'NVIDIA_NIM',
  'MINIMAX_API_KEY',
  'XAI_API_KEY',
  'ANTHROPIC_DEFAULT_OPUS_MODEL',
  'ANTHROPIC_DEFAULT_OPUS_MODEL_SUPPORTED_CAPABILITIES',
  'ANTHROPIC_DEFAULT_SONNET_MODEL',
  'ANTHROPIC_DEFAULT_SONNET_MODEL_SUPPORTED_CAPABILITIES',
  'ANTHROPIC_DEFAULT_HAIKU_MODEL',
  'ANTHROPIC_DEFAULT_HAIKU_MODEL_SUPPORTED_CAPABILITIES',
  'NYXCLAUDE_DISABLE_THINKING',
  'USER_TYPE',
]

const originalEnv: Record<string, string | undefined> = {}

beforeEach(async () => {
  await acquireSharedMutationLock('utils/thinking.test.ts')
  for (const key of ENV_KEYS) {
    originalEnv[key] = process.env[key]
    delete process.env[key]
  }
  resetSettingsCache()
})

afterEach(() => {
  try {
    mock.restore()
    for (const key of ENV_KEYS) {
      if (originalEnv[key] === undefined) {
        delete process.env[key]
      } else {
        process.env[key] = originalEnv[key]
      }
    }
    resetSettingsCache()
  } finally {
    releaseSharedMutationLock()
  }
})

async function importFreshThinkingModule() {
  mock.restore()
  const originalProviders = await import('./model/providers.js')
  mock.module('./model/providers.js', () => {
    return {
      ...originalProviders,
      getAPIProvider: () => 'openai',
    }
  })
  const nonce = `${Date.now()}-${Math.random()}`
  return import(`./thinking.js?ts=${nonce}`)
}

describe('modelSupportsThinking — Z.AI GLM', () => {
  test('enables thinking for exact GLM models on api.z.ai', async () => {
    process.env.NYXCLAUDE_USE_OPENAI = '1'
    process.env.OPENAI_BASE_URL = 'https://api.z.ai/api/coding/paas/v4'
    const { modelSupportsThinking } = await importFreshThinkingModule()

    expect(modelSupportsThinking('GLM-5.1')).toBe(true)
    expect(modelSupportsThinking('GLM-5-Turbo')).toBe(true)
    expect(modelSupportsThinking('GLM-4.7')).toBe(true)
    expect(modelSupportsThinking('GLM-4.5-Air')).toBe(true)
    expect(modelSupportsThinking('glm-5.2?thinking=disabled')).toBe(true)
    expect(modelSupportsThinking('glm-5.2 ?thinking=disabled')).toBe(true)
  })

  test('does not enable GLM thinking on non-Z.AI OpenAI-compatible endpoints', async () => {
    process.env.NYXCLAUDE_USE_OPENAI = '1'
    process.env.OPENAI_BASE_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1'
    const { modelSupportsThinking } = await importFreshThinkingModule()

    expect(modelSupportsThinking('glm-5.1')).toBe(false)
    expect(modelSupportsThinking('GLM-5.1')).toBe(false)
  })

  test('does not match unrelated GLM-looking model names', async () => {
    process.env.NYXCLAUDE_USE_OPENAI = '1'
    process.env.OPENAI_BASE_URL = 'https://api.z.ai/api/coding/paas/v4'
    const { modelSupportsThinking } = await importFreshThinkingModule()

    expect(modelSupportsThinking('glm-50')).toBe(false)
  })

  test('does not reuse stale capability overrides after env changes', async () => {
    process.env.NYXCLAUDE_USE_OPENAI = '1'
    process.env.OPENAI_BASE_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1'
    process.env.ANTHROPIC_DEFAULT_SONNET_MODEL = 'GLM-5.1'
    process.env.ANTHROPIC_DEFAULT_SONNET_MODEL_SUPPORTED_CAPABILITIES = ''
    const { modelSupportsThinking } = await importFreshThinkingModule()

    expect(modelSupportsThinking('GLM-5.1')).toBe(false)

    delete process.env.ANTHROPIC_DEFAULT_SONNET_MODEL
    delete process.env.ANTHROPIC_DEFAULT_SONNET_MODEL_SUPPORTED_CAPABILITIES
    process.env.OPENAI_BASE_URL = 'https://api.z.ai/api/coding/paas/v4'

    expect(modelSupportsThinking('GLM-5.1')).toBe(true)
  })
})

describe('modelSupportsAdaptiveThinking — Claude 4 allowlist', () => {
  // Provider is mocked to 'openai', so unknown Models default to false.
  // That makes the allowlist the only reason opus-4-8 returns true here, so
  // this test fails if opus-4-8 is dropped from the allowlist (#1769).
  test('includes Opus 4.8 in the adaptive-thinking allowlist', async () => {
    const { modelSupportsAdaptiveThinking } = await importFreshThinkingModule()

    expect(modelSupportsAdaptiveThinking('claude-opus-4-8')).toBe(true)
    // 4.7 stays supported (guards against an accidental allowlist rewrite).
    expect(modelSupportsAdaptiveThinking('claude-opus-4-7')).toBe(true)
    // A non-allowlisted Claude 4 opus is still excluded on non-1P providers.
    expect(modelSupportsAdaptiveThinking('claude-opus-4-2')).toBe(false)
  })
})

describe('shouldUseThinkingForModel — Ollama', () => {
  test('does not use thinking for Ollama models when app-level thinking is enabled', async () => {
    process.env.NYXCLAUDE_USE_OPENAI = '1'
    process.env.OPENAI_BASE_URL = 'http://localhost:11434/v1'
    const { shouldUseThinkingForModel } = await importFreshThinkingModule()
    const enabledThinking = { type: 'enabled' as const, budgetTokens: 1024 }

    expect(shouldUseThinkingForModel('llama3.1:8b', enabledThinking)).toBe(false)
    // Covers catalog-missing local names that would otherwise match Claude 4 heuristics.
    expect(shouldUseThinkingForModel('claude-sonnet-4-local', enabledThinking)).toBe(false)
  })
})

describe('modelSupportsThinking — catalog-based detection for non-Anthropic providers', () => {
  test('enables thinking for GPT-5.x models with supportsReasoning in catalog', async () => {
    process.env.NYXCLAUDE_USE_OPENAI = '1'
    // Default OpenAI base URL — route resolves to 'openai'
    const { modelSupportsThinking } = await importFreshThinkingModule()

    // GPT-5.5 has supportsReasoning: true in the OpenAI catalog
    expect(modelSupportsThinking('gpt-5.5')).toBe(true)
    expect(modelSupportsThinking('gpt-5.6-sol')).toBe(true)
  })

  test('does not enable thinking for models without supportsReasoning in catalog', async () => {
    process.env.NYXCLAUDE_USE_OPENAI = '1'
    const { modelSupportsThinking } = await importFreshThinkingModule()

    // A model not in any catalog and not matching Claude/DeepSeek patterns
    expect(modelSupportsThinking('some-unknown-model')).toBe(false)
  })
})
