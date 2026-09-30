import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import {
  acquireSharedMutationLock,
  releaseSharedMutationLock,
} from '../../test/sharedMutationLock.js'
import {
  getAllModelsDevCatalogModels,
  getCapabilityDescriptionFragment,
  getModelCapability,
  prefetchModelsDevCatalog,
} from './modelsDevCatalog.js'

const originalConfigDir = process.env.NYXCLAUDE_CONFIG_DIR
const originalFetch = globalThis.fetch
let tempDir: string

function cachePath(): string {
  return join(tempDir, 'models-dev-catalog.json')
}

function seedCache(models: Array<{ id: string; name: string; family?: string; reasoning?: boolean; tool_call?: boolean; context?: number }>) {
  const path = cachePath()
  mkdirSync(join(path, '..'), { recursive: true })
  const payload = {
    models: models.map(m => ({
      id: m.id,
      name: m.name,
      family: m.family ?? '',
      reasoning: Boolean(m.reasoning),
      tool_call: Boolean(m.tool_call),
      attachment: false,
      temperature: true,
      context: m.context ?? 0,
      output: 0,
      modalities: { input: ['text'], output: ['text'] },
      cost: { input: 0, output: 0 },
      knowledge: '',
      release_date: '',
      last_updated: '',
    })),
    updatedAt: Date.now(),
    error: null,
  }
  writeFileSync(path, JSON.stringify(payload, null, 2), 'utf-8')
}

beforeEach(async () => {
  await acquireSharedMutationLock('modelsDevCatalog.test.ts')
  tempDir = mkdtempSync(join(tmpdir(), 'nyxclaude-modelsdev-catalog-test-'))
  process.env.NYXCLAUDE_CONFIG_DIR = tempDir
})

afterEach(() => {
  try {
    globalThis.fetch = originalFetch
    if (originalConfigDir === undefined) {
      delete process.env.NYXCLAUDE_CONFIG_DIR
    } else {
      process.env.NYXCLAUDE_CONFIG_DIR = originalConfigDir
    }
    rmSync(tempDir, { recursive: true, force: true })
  } finally {
    releaseSharedMutationLock()
  }
})

describe('getModelCapability', () => {
  test('returns null on cold start with empty cache', () => {
    expect(getModelCapability('claude-sonnet-4-6')).toBeNull()
    expect(getAllModelsDevCatalogModels()).toEqual([])
  })

  test('returns null for an id that is not in the cache', () => {
    seedCache([{ id: 'anthropic/claude-sonnet-4-6', name: 'Claude Sonnet 4.6' }])
    expect(getModelCapability('does-not-exist')).toBeNull()
  })

  test('finds a capability by full provider-prefixed id', () => {
    seedCache([{ id: 'anthropic/claude-sonnet-4-6', name: 'Claude Sonnet 4.6' }])
    const cap = getModelCapability('anthropic/claude-sonnet-4-6')
    expect(cap).not.toBeNull()
    expect(cap?.name).toBe('Claude Sonnet 4.6')
  })

  test('finds a capability by tail id (without provider prefix)', () => {
    seedCache([{ id: 'anthropic/claude-sonnet-4-6', name: 'Claude Sonnet 4.6' }])
    const cap = getModelCapability('claude-sonnet-4-6')
    expect(cap).not.toBeNull()
    expect(cap?.name).toBe('Claude Sonnet 4.6')
  })

  test('finds a capability by display name (case-insensitive)', () => {
    seedCache([{ id: 'anthropic/claude-sonnet-4-6', name: 'Claude Sonnet 4.6' }])
    const cap = getModelCapability('Claude Sonnet 4.6')
    expect(cap).not.toBeNull()
  })
})

describe('getCapabilityDescriptionFragment', () => {
  test('returns null when no capability is found', () => {
    expect(getCapabilityDescriptionFragment('unknown')).toBeNull()
  })

  test('returns a fragment when capability is found', () => {
    seedCache([
      {
        id: 'anthropic/claude-sonnet-4-6',
        name: 'Claude Sonnet 4.6',
        family: 'claude-sonnet',
        reasoning: true,
        tool_call: true,
        context: 200000,
      },
    ])
    const fragment = getCapabilityDescriptionFragment('claude-sonnet-4-6')
    expect(fragment).not.toBeNull()
    expect(fragment).toContain('Reasoning')
    expect(fragment).toContain('200K context')
  })
})

describe('prefetchModelsDevCatalog', () => {
  test('populates the cache on successful fetch', async () => {
    const fakeApi = {
      anthropic: {
        id: 'anthropic',
        name: 'Anthropic',
        models: {
          'claude-sonnet-4-6': {
            id: 'claude-sonnet-4-6',
            name: 'Claude Sonnet 4.6',
            family: 'claude-sonnet',
            reasoning: true,
            tool_call: true,
            attachment: true,
            temperature: true,
            modalities: { input: ['text'], output: ['text'] },
            limit: { context: 200000, output: 32768 },
            cost: { input: 3, output: 15 },
          },
        },
      },
    }
    globalThis.fetch = (async () =>
      new Response(JSON.stringify(fakeApi), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })) as typeof fetch

    prefetchModelsDevCatalog()
    for (let i = 0; i < 100 && getAllModelsDevCatalogModels().length === 0; i++) {
      await new Promise(resolve => setTimeout(resolve, 20))
    }
    const models = getAllModelsDevCatalogModels()
    expect(models.length).toBe(1)
    expect(models[0]?.id).toBe('anthropic/claude-sonnet-4-6')
  })

  test('records an error and leaves the cache empty when fetch fails', async () => {
    globalThis.fetch = (async () =>
      new Response('upstream down', { status: 502 })) as typeof fetch

    prefetchModelsDevCatalog()
    for (let i = 0; i < 100; i++) {
      await new Promise(resolve => setTimeout(resolve, 20))
    }
    expect(getAllModelsDevCatalogModels()).toEqual([])
    expect(getModelCapability('claude-sonnet-4-6')).toBeNull()
  })

  test('does not throw on a network-level failure', async () => {
    globalThis.fetch = (async () => {
      throw new Error('ECONNREFUSED')
    }) as typeof fetch

    expect(() => prefetchModelsDevCatalog()).not.toThrow()
  })
})