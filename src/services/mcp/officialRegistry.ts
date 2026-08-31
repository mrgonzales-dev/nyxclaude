import axios from 'axios'
import { logForDebugging } from '../../utils/debug.js'
import { errorMessage } from '../../utils/errors.js'
import {
  getAPIProvider,
  isFirstPartyAnthropicBaseUrl,
} from '../../utils/model/providers.js'

type RegistryServer = {
  server: {
    remotes?: Array<{ url: string }>
  }
}

type RegistryResponse = {
  servers: RegistryServer[]
}

// URLs stripped of query string and trailing slash — matches the normalization
// done by getLoggingSafeMcpBaseUrl so direct Set.has() lookup works.
let officialUrls: Set<string> | undefined = undefined

// Timestamp (ms since epoch) of the last successful registry fetch. 0 means
// "never fetched" so the first call to isOfficialMcpUrl triggers a lazy load.
let officialUrlsFetchedAt = 0

// Guards against overlapping fire-and-forget fetches so concurrent callers
// don't all kick off redundant network requests.
let officialUrlsFetchInFlight = false

// Refresh the registry at most once per 24h.
const OFFICIAL_URLS_TTL_MS = 24 * 60 * 60 * 1000

function normalizeUrl(url: string): string | undefined {
  try {
    const u = new URL(url)
    u.search = ''
    return u.toString().replace(/\/$/, '')
  } catch {
    return undefined
  }
}

/**
 * Fire-and-forget fetch of the official MCP registry.
 * Populates officialUrls for isOfficialMcpUrl lookups.
 */
export async function prefetchOfficialMcpUrls(): Promise<void> {
  if (process.env.CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC) {
    return
  }

  // The official first-party MCP registry is only relevant for first-party mode.
  if (getAPIProvider() !== 'firstParty' || !isFirstPartyAnthropicBaseUrl()) {
    officialUrls = undefined
    officialUrlsFetchedAt = 0
    return
  }

  // Avoid stacking redundant concurrent fetches.
  if (officialUrlsFetchInFlight) {
    return
  }
  officialUrlsFetchInFlight = true

  try {
    const response = await axios.get<RegistryResponse>(
      'https://api.anthropic.com/mcp-registry/v0/servers?version=latest&visibility=commercial',
      { timeout: 5000 },
    )

    const urls = new Set<string>()
    for (const entry of response.data.servers) {
      for (const remote of entry.server.remotes ?? []) {
        const normalized = normalizeUrl(remote.url)
        if (normalized) {
          urls.add(normalized)
        }
      }
    }
    officialUrls = urls
    officialUrlsFetchedAt = Date.now()
    logForDebugging(`[mcp-registry] Loaded ${urls.size} official MCP URLs`)
  } catch (error) {
    logForDebugging(`Failed to fetch MCP registry: ${errorMessage(error)}`, {
      level: 'error',
    })
  } finally {
    officialUrlsFetchInFlight = false
  }
}

/**
 * Returns true iff the given (already-normalized via getLoggingSafeMcpBaseUrl)
 * URL is in the official MCP registry. Undefined registry → false (fail-closed).
 *
 * The registry is lazy-loaded on first use (instead of eagerly at process
 * start) and refreshed at most once per 24h. The first lookup before the
 * fire-and-forget fetch completes returns false (fail-closed); subsequent
 * lookups once populated consult the cached set.
 */
export function isOfficialMcpUrl(normalizedUrl: string): boolean {
  if (
    getAPIProvider() !== 'firstParty' ||
    !isFirstPartyAnthropicBaseUrl()
  ) {
    return false
  }

  // Lazy-load on first use, and re-fetch if the cache is older than 24h.
  if (
    officialUrls === undefined ||
    Date.now() - officialUrlsFetchedAt > OFFICIAL_URLS_TTL_MS
  ) {
    void prefetchOfficialMcpUrls()
  }

  return officialUrls?.has(normalizedUrl) ?? false
}

export function resetOfficialMcpUrlsForTesting(): void {
  officialUrls = undefined
  officialUrlsFetchedAt = 0
  officialUrlsFetchInFlight = false
}
