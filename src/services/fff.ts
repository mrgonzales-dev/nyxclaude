// NYX-AGENT: fff (Fast File Finder) singleton service.
//
// Wraps @ff-labs/fff-node's FileFinder in a process-wide singleton so the
// GrepTool (and any future consumer) can share one long-lived index instead
// of forking ripgrep on every search.
//
// Uses @ff-labs/fff-node (not fff-bun) because the CLI runs under node, and
// fff-bun uses bun:ffi which is Bun-only. fff-node uses ffi-rs and ships
// compiled JS, so it stays external and loads fine under node.
//
// Lifecycle:
//   - getOrCreateFileFinder() lazily constructs the instance on first call.
//   - waitForFileFinderScan() blocks until the initial FS scan completes
//     (or the timeout elapses). Call this once at startup so the first
//     user-driven grep is already warm.
//   - destroyFileFinder() tears down the native handle. Wired into the
//     process exit path; safe to call multiple times.

// The loaded fff module — typed loosely to avoid importing the types
// statically (which would trigger the same TLA issue).
type FffModule = {
  FileFinder: {
    create(opts: {
      basePath: string
      aiMode?: boolean
      disableWatch?: boolean
    }): { ok: true; value: FffInstance } | { ok: false; error: string }
  }
}

type FffInstance = {
  waitForScan(timeoutMs?: number): Promise<{ ok: true; value: boolean } | { ok: false; error: string }>
  destroy(): void
  getBasePath(): { ok: true; value: string | null } | { ok: false; error: string }
  grep(
    pattern: string,
    options?: {
      mode?: 'plain' | 'regex' | 'fuzzy'
      smartCase?: boolean
      beforeContext?: number
      afterContext?: number
      pageSize?: number
      cursor?: any
    },
  ): { ok: true; value: any } | { ok: false; error: string }
  glob(
    pattern: string,
    options?: { pageSize?: number; pageIndex?: number },
  ): { ok: true; value: any } | { ok: false; error: string }
  fileSearch(
    query: string,
    options?: { pageSize?: number },
  ): { ok: true; value: any } | { ok: false; error: string }
  isDestroyed: boolean
}

let finder: FffInstance | null = null
let initPromise: Promise<FffInstance | null> | null = null
let scanPromise: Promise<void> | null = null

const DEFAULT_SCAN_TIMEOUT_MS = 10_000

/**
 * Lazily create the singleton FileFinder instance via dynamic import.
 *
 * Returns null if the native library is unavailable (e.g. unsupported
 * platform or missing binary). Callers must handle null by falling back
 * to a non-fff path.
 */
export function getOrCreateFileFinder(
  basePath: string = process.cwd(),
): Promise<FffInstance | null> {
  if (finder) return Promise.resolve(finder)
  if (initPromise) return initPromise

  initPromise = (async () => {
    try {
      const mod = (await import('@ff-labs/fff-node')) as unknown as FffModule
      const created = mod.FileFinder.create({
        basePath,
        aiMode: true,
        disableWatch: false,
      })
      if (!created.ok) {
        console.warn(`[fff] init failed: ${created.error}`)
        return null
      }
      finder = created.value
      return finder
    } catch (e) {
      console.warn(`[fff] dynamic import failed: ${e}`)
      return null
    }
  })()

  return initPromise
}

/**
 * Wait for the initial filesystem scan to finish.
 *
 * Safe to call multiple times — the scan is awaited once and the result
 * is cached. Returns true if the scan completed (or the finder is null),
 * false if it timed out.
 */
export async function waitForFileFinderScan(
  timeoutMs: number = DEFAULT_SCAN_TIMEOUT_MS,
): Promise<boolean> {
  const f = await getOrCreateFileFinder()
  if (!f) return true // nothing to wait for; callers will fall back

  if (scanPromise) return scanPromise.then(() => true).catch(() => false)

  scanPromise = (async () => {
    const result = await f.waitForScan(timeoutMs)
    if (!result.ok) {
      console.warn(`[fff] scan wait returned: ${result.error}`)
    }
  })()

  await scanPromise
  return true
}

/**
 * Returns the active finder if it has been initialized, or null.
 * Does NOT trigger initialization — use getOrCreateFileFinder() for that.
 */
export function getFileFinder(): FffInstance | null {
  return finder
}

/**
 * Tear down the native handle. Safe to call multiple times.
 */
export function destroyFileFinder(): void {
  if (!finder) return
  try {
    finder.destroy()
  } catch {
    // ignore — best-effort cleanup on shutdown
  }
  finder = null
  initPromise = null
  scanPromise = null
}
