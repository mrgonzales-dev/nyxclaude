/**
 * Live-sync of model capability metadata from https://models.dev/api.json.
 *
 * Replaces the hand-maintained Copilot model registry (formerly
 * src/utils/model/copilotModels.ts). One fetch covers every provider exposed by
 * models.dev, and the result is persisted to a sibling cache file at
 * `~/.nyxclaude/models-dev-catalog.json` so the picker can look up capabilities
 * synchronously without hitting the network.
 *
 * On startup, callers invoke prefetchModelsDevCatalog(). The sync lookup
 * helpers (getModelCapability, getAllModelsDevCatalogModels,
 * getCapabilityDescriptionFragment) read from the cache and tolerate a cold
 * start: when the cache is empty, they return null / [] / null instead of
 * throwing, so the picker degrades gracefully before the first fetch resolves.
 *
 * Why a sibling file rather than the shared discoveryCache? The shared cache
 * stores `ModelCatalogEntry` (id/apiName/label) — it cannot carry the richer
 * capability fields (reasoning, context, modalities, cost) that the picker
 * needs. Using a dedicated cache keeps this module independent of the route
 * discovery service.
 */
import { randomBytes } from 'crypto'
import { existsSync, readFileSync, statSync } from 'fs'
import { open } from 'fs/promises'
import { join } from 'path'
import { errorMessage } from '../errors.js'
import { getNyxclaudeConfigHomeDir } from '../envUtils.js'
import { logEvent } from '../../services/analytics/index.js'
import { logError } from '../log.js'

export const MODELS_DEV_CACHE_TTL_MS = 24 * 60 * 60 * 1000
const MODELS_DEV_CACHE_FILENAME = 'models-dev-catalog.json'
const MODELS_DEV_FETCH_URL = 'https://models.dev/api.json'
const MODELS_DEV_FETCH_TIMEOUT_MS = 5_000

export type ModelCapability = {
  id: string
  name: string
  family: string
  reasoning: boolean
  tool_call: boolean
  attachment: boolean
  temperature: boolean
  context: number
  output: number
  modalities: {
    input: string[]
    output: string[]
  }
  cost: {
    input: number
    output: number
    cache_read?: number
  }
  knowledge: string
  release_date: string
  last_updated: string
}

type ModelsDevApiFile = {
  [providerId: string]: {
    id?: string
    name?: string
    models?: Record<
      string,
      {
        id?: string
        name?: string
        family?: string
        attachment?: boolean
        reasoning?: boolean
        tool_call?: boolean
        temperature?: boolean
        knowledge?: string
        release_date?: string
        last_updated?: string
        modalities?: {
          input?: string[]
          output?: string[]
        }
        open_weights?: boolean
        cost?: {
          input?: number
          output?: number
          cache_read?: number
        }
        limit?: {
          context?: number
          input?: number
          output?: number
        }
      }
    >
  }
}

type CatalogSnapshot = {
  models: ModelCapability[]
  updatedAt: number
  error: { message: string; recordedAt: number } | null
}

let fetchPromise: Promise<void> | null = null
let syncSnapshot: { cachePath: string; mtimeMs: number; checkedAtMs: number; snapshot: CatalogSnapshot | null } | null = null

function getCachePath(): string {
  return join(getNyxclaudeConfigHomeDir(), MODELS_DEV_CACHE_FILENAME)
}

function emptySnapshot(): CatalogSnapshot {
  return { models: [], updatedAt: 0, error: null }
}

function asNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : []
}

function normalizeModel(
  providerId: string,
  modelId: string,
  raw: NonNullable<ModelsDevApiFile[string]['models']>[string],
): ModelCapability | null {
  const id = raw?.id ?? modelId
  const name = raw?.name ?? modelId
  if (!id || !name) return null

  return {
    id: `${providerId}/${id}`,
    name,
    family: raw?.family ?? providerId,
    reasoning: Boolean(raw?.reasoning),
    tool_call: Boolean(raw?.tool_call),
    attachment: Boolean(raw?.attachment),
    temperature: Boolean(raw?.temperature),
    context: asNumber(raw?.limit?.context, 0),
    output: asNumber(raw?.limit?.output, 0),
    modalities: {
      input: asStringArray(raw?.modalities?.input),
      output: asStringArray(raw?.modalities?.output),
    },
    cost: {
      input: asNumber(raw?.cost?.input, 0),
      output: asNumber(raw?.cost?.output, 0),
      cache_read:
        typeof raw?.cost?.cache_read === 'number'
          ? raw.cost.cache_read
          : undefined,
    },
    knowledge: raw?.knowledge ?? '',
    release_date: raw?.release_date ?? '',
    last_updated: raw?.last_updated ?? '',
  }
}

function parseModelsDevApi(payload: unknown): ModelCapability[] {
  if (!payload || typeof payload !== 'object') return []
  const file = payload as ModelsDevApiFile
  const out: ModelCapability[] = []
  for (const [providerId, provider] of Object.entries(file)) {
    if (!provider || typeof provider !== 'object') continue
    const models = provider.models
    if (!models || typeof models !== 'object') continue
    for (const [modelId, raw] of Object.entries(models)) {
      const normalized = normalizeModel(providerId, modelId, raw)
      if (normalized) out.push(normalized)
    }
  }
  return out
}

async function fetchModelsDevPayload(): Promise<ModelCapability[]> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), MODELS_DEV_FETCH_TIMEOUT_MS)
  try {
    const response = await fetch(MODELS_DEV_FETCH_URL, {
      method: 'GET',
      signal: controller.signal,
    })
    if (!response.ok) {
      throw new Error(`models.dev responded with HTTP ${response.status}`)
    }
    const payload = (await response.json()) as unknown
    return parseModelsDevApi(payload)
  } finally {
    clearTimeout(timeout)
  }
}

function readSnapshot(): CatalogSnapshot | null {
  const cachePath = getCachePath()
  const now = Date.now()
  if (
    syncSnapshot &&
    syncSnapshot.cachePath === cachePath &&
    now - syncSnapshot.checkedAtMs < 1_000
  ) {
    return syncSnapshot.snapshot
  }

  if (!existsSync(cachePath)) {
    syncSnapshot = { cachePath, mtimeMs: 0, checkedAtMs: now, snapshot: null }
    return null
  }

  let mtimeMs: number
  try {
    mtimeMs = statSync(cachePath).mtimeMs
  } catch {
    syncSnapshot = { cachePath, mtimeMs: 0, checkedAtMs: now, snapshot: null }
    return null
  }
  if (syncSnapshot && syncSnapshot.cachePath === cachePath && syncSnapshot.mtimeMs === mtimeMs) {
    syncSnapshot = { ...syncSnapshot, checkedAtMs: now }
    return syncSnapshot.snapshot
  }

  try {
    const raw = readFileSync(cachePath, { encoding: 'utf-8' })
    const parsed = JSON.parse(raw) as Partial<CatalogSnapshot>
    const models = Array.isArray(parsed.models) ? (parsed.models as ModelCapability[]) : []
    const updatedAt = typeof parsed.updatedAt === 'number' ? parsed.updatedAt : 0
    const error =
      parsed.error && typeof parsed.error === 'object' && typeof parsed.error.message === 'string' && typeof parsed.error.recordedAt === 'number'
        ? { message: parsed.error.message, recordedAt: parsed.error.recordedAt }
        : null
    const snapshot: CatalogSnapshot = { models, updatedAt, error }
    syncSnapshot = { cachePath, mtimeMs, checkedAtMs: now, snapshot }
    return snapshot
  } catch (error) {
    logError(error)
    syncSnapshot = { cachePath, mtimeMs: 0, checkedAtMs: now, snapshot: null }
    return null
  }
}

async function writeSnapshot(next: CatalogSnapshot): Promise<void> {
  const cachePath = getCachePath()
  const tempPath = `${cachePath}.${randomBytes(8).toString('hex')}.tmp`
  try {
    const homeDir = getNyxclaudeConfigHomeDir()
    const { mkdir } = await import('fs/promises')
    await mkdir(homeDir, { recursive: true })

    const content = JSON.stringify(next, null, 2)
    const handle = await open(tempPath, 'w', 0o600)
    try {
      await handle.writeFile(content, { encoding: 'utf-8' })
      await handle.sync()
    } finally {
      await handle.close()
    }
    const { rename, unlink } = await import('fs/promises')
    await rename(tempPath, cachePath)
    syncSnapshot = null
  } catch (error) {
    logError(error)
    try {
      const { unlink } = await import('fs/promises')
      await unlink(tempPath)
    } catch {
      // Ignore cleanup errors.
    }
  }
}

/**
 * Prefetch the models.dev catalog and persist it to the cache file. Safe to
 * call repeatedly; in-flight requests are deduplicated. Errors are recorded to
 * the cache and never thrown.
 */
export function prefetchModelsDevCatalog(): void {
  if (fetchPromise) return
  fetchPromise = (async () => {
    try {
      const models = await fetchModelsDevPayload()
      await writeSnapshot({
        models,
        updatedAt: Date.now(),
        error: null,
      })
      logEvent('nyxclaude_modelsdev_catalog_loaded', {
        source: 'network',
        size: models.length,
      })
    } catch (error) {
      logError(error)
      const current = readSnapshot() ?? emptySnapshot()
      await writeSnapshot({
        models: current.models,
        updatedAt: current.updatedAt,
        error: {
          message: errorMessage(error),
          recordedAt: Date.now(),
        },
      })
      logEvent('nyxclaude_modelsdev_catalog_fetch_failed', {
        error: errorMessage(error),
      })
    } finally {
      fetchPromise = null
    }
  })()
}

function matchCapability(
  models: ModelCapability[],
  modelId: string,
): ModelCapability | null {
  const target = modelId.toLowerCase()
  for (const m of models) {
    if (m.id.toLowerCase() === target) return m
    const tail = m.id.split('/').pop()
    if (tail && tail.toLowerCase() === target) return m
    if (m.name.toLowerCase() === target) return m
    if (m.family && m.family.toLowerCase() === target) return m
  }
  return null
}

/**
 * Synchronously look up capability metadata for a model id. Returns null when
 * no entry matches (cold start, unknown id, or empty cache).
 */
export function getModelCapability(modelId: string): ModelCapability | null {
  const snapshot = readSnapshot()
  if (!snapshot || snapshot.models.length === 0) return null
  return matchCapability(snapshot.models, modelId)
}

export function getAllModelsDevCatalogModels(): ModelCapability[] {
  const snapshot = readSnapshot()
  return snapshot?.models ?? []
}

/**
 * Returns a short, picker-friendly capability fragment such as
 * `Reasoning · 200K context` for a known model id. Returns null when no
 * metadata is available, so callers can fall back to existing hardcoded
 * descriptions.
 */
export function getCapabilityDescriptionFragment(modelId: string): string | null {
  const capability = getModelCapability(modelId)
  if (!capability) return null
  const fragments: string[] = []
  if (capability.reasoning) fragments.push('Reasoning')
  if (capability.tool_call) fragments.push('Tool call')
  if (capability.context > 0) {
    fragments.push(`${Math.round(capability.context / 1000)}K context`)
  }
  return fragments.length > 0 ? fragments.join(' · ') : null
}