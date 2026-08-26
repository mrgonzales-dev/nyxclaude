import { describe, test, expect, mock, beforeEach } from 'bun:test'
import { resolve } from 'path'

// Mock fff service — controlled per-test via mock.module
const fffState = {
  finder: null as any,
}

mock.module('../../services/fff.js', () => ({
  getFileFinder: () => fffState.finder,
}))

// Mock the ripgrep-based glob utility
const globMock = mock(async (
  _pattern: string,
  _cwd: string,
  _opts: { limit: number; offset: number },
  _signal: AbortSignal,
  _ctx: any,
) => ({ files: [] as string[], truncated: false }))

mock.module('../../utils/glob.js', () => ({
  glob: globMock,
}))

// Mock cwd to a known path
const TEST_CWD = resolve(import.meta.dir, '../../../')
mock.module('../../utils/cwd.js', () => ({
  getCwd: () => TEST_CWD,
  pwd: () => TEST_CWD,
  runWithCwdOverride: (cwd: string, fn: () => any) => fn(),
}))

// Import after mocks are set up
const { GlobTool } = await import('./GlobTool.js')

function makeContext(overrides: any = {}) {
  return {
    abortController: new AbortController(),
    getAppState: () => ({
      toolPermissionContext: { denyRules: [] },
      ...overrides,
    }),
    globLimits: { maxResults: 100 },
    ...overrides,
  }
}

describe('GlobTool', () => {
  beforeEach(() => {
    fffState.finder = null
    globMock.mockReset()
  })

  describe('fff path', () => {
    test('returns files from fff when finder is available', async () => {
      fffState.finder = {
        getBasePath: () => ({ ok: true, value: TEST_CWD }),
        glob: (_pattern: string, _opts: any) => ({
          ok: true,
          value: {
            items: [
              resolve(TEST_CWD, 'src/foo.ts'),
              resolve(TEST_CWD, 'src/bar.ts'),
            ],
          },
        }),
      }

      const result = await GlobTool.call(
        { pattern: '**/*.ts' },
        makeContext(),
      )

      expect(result.data.numFiles).toBe(2)
      expect(result.data.filenames).toContain('src/foo.ts')
      expect(result.data.filenames).toContain('src/bar.ts')
      expect(result.data.truncated).toBe(false)
      // ripgrep fallback should NOT have been called
      expect(globMock).not.toHaveBeenCalled()
    })

    test('truncates results when fff returns more than limit', async () => {
      const files = Array.from({ length: 5 }, (_, i) =>
        resolve(TEST_CWD, `file${i}.ts`),
      )
      fffState.finder = {
        getBasePath: () => ({ ok: true, value: TEST_CWD }),
        glob: (_pattern: string, _opts: any) => ({
          ok: true,
          value: { items: files },
        }),
      }

      const result = await GlobTool.call(
        { pattern: '**/*.ts' },
        makeContext({ globLimits: { maxResults: 3 } }),
      )

      expect(result.data.numFiles).toBe(3)
      expect(result.data.truncated).toBe(true)
    })

    test('returns empty results when fff finds no files', async () => {
      fffState.finder = {
        getBasePath: () => ({ ok: true, value: TEST_CWD }),
        glob: (_pattern: string, _opts: any) => ({
          ok: true,
          value: { items: [] },
        }),
      }

      const result = await GlobTool.call(
        { pattern: '**/*.nonexistent' },
        makeContext(),
      )

      expect(result.data.numFiles).toBe(0)
      expect(result.data.filenames).toEqual([])
      expect(result.data.truncated).toBe(false)
    })

    test('filters results to subdirectory when path is given', async () => {
      fffState.finder = {
        getBasePath: () => ({ ok: true, value: TEST_CWD }),
        glob: (_pattern: string, _opts: any) => ({
          ok: true,
          value: {
            items: [
              resolve(TEST_CWD, 'src/foo.ts'),
              resolve(TEST_CWD, 'test/bar.ts'),
              resolve(TEST_CWD, 'src/baz.ts'),
            ],
          },
        }),
      }

      const result = await GlobTool.call(
        { pattern: '**/*.ts', path: 'src' },
        makeContext(),
      )

      expect(result.data.numFiles).toBe(2)
      expect(result.data.filenames).toEqual(
        expect.arrayContaining(['src/foo.ts', 'src/baz.ts']),
      )
      // Should NOT contain test/bar.ts
      expect(result.data.filenames).not.toContain('test/bar.ts')
    })
  })

  describe('ripgrep fallback', () => {
    test('falls back to ripgrep when fff is null', async () => {
      fffState.finder = null
      globMock.mockResolvedValue({
        files: [resolve(TEST_CWD, 'src/fallback.ts')],
        truncated: false,
      })

      const result = await GlobTool.call(
        { pattern: '**/*.ts' },
        makeContext(),
      )

      expect(globMock).toHaveBeenCalledTimes(1)
      expect(result.data.numFiles).toBe(1)
      expect(result.data.filenames).toContain('src/fallback.ts')
    })

    test('falls back to ripgrep when fff getBasePath fails', async () => {
      fffState.finder = {
        getBasePath: () => ({ ok: false, error: 'no base path' }),
        glob: () => ({ ok: true, value: { items: [] } }),
      }
      globMock.mockResolvedValue({
        files: [resolve(TEST_CWD, 'src/rg.ts')],
        truncated: false,
      })

      const result = await GlobTool.call(
        { pattern: '**/*.ts' },
        makeContext(),
      )

      expect(globMock).toHaveBeenCalledTimes(1)
      expect(result.data.filenames).toContain('src/rg.ts')
    })

    test('falls back to ripgrep when search path is outside fff base path', async () => {
      fffState.finder = {
        getBasePath: () => ({ ok: true, value: '/some/other/path' }),
        glob: () => ({ ok: true, value: { items: [] } }),
      }
      globMock.mockResolvedValue({
        files: [resolve(TEST_CWD, 'src/outside.ts')],
        truncated: false,
      })

      const result = await GlobTool.call(
        { pattern: '**/*.ts' },
        makeContext(),
      )

      expect(globMock).toHaveBeenCalledTimes(1)
      expect(result.data.filenames).toContain('src/outside.ts')
    })

    test('falls back to ripgrep when fff glob() returns error', async () => {
      fffState.finder = {
        getBasePath: () => ({ ok: true, value: TEST_CWD }),
        glob: () => ({ ok: false, error: 'pattern compile failed' }),
      }
      globMock.mockResolvedValue({
        files: [resolve(TEST_CWD, 'src/err.ts')],
        truncated: false,
      })

      const result = await GlobTool.call(
        { pattern: '[' },
        makeContext(),
      )

      expect(globMock).toHaveBeenCalledTimes(1)
      expect(result.data.filenames).toContain('src/err.ts')
    })

    test('falls back to ripgrep when fff glob() returns non-array value', async () => {
      fffState.finder = {
        getBasePath: () => ({ ok: true, value: TEST_CWD }),
        glob: () => ({ ok: true, value: 'not an array' }),
      }
      globMock.mockResolvedValue({
        files: [resolve(TEST_CWD, 'src/weird.ts')],
        truncated: false,
      })

      const result = await GlobTool.call(
        { pattern: '**/*.ts' },
        makeContext(),
      )

      expect(globMock).toHaveBeenCalledTimes(1)
      expect(result.data.filenames).toContain('src/weird.ts')
    })

    test('falls back to ripgrep when fff throws', async () => {
      fffState.finder = {
        getBasePath: () => ({ ok: true, value: TEST_CWD }),
        glob: () => {
          throw new Error('fff native crash')
        },
      }
      globMock.mockResolvedValue({
        files: [resolve(TEST_CWD, 'src/crash.ts')],
        truncated: false,
      })

      const result = await GlobTool.call(
        { pattern: '**/*.ts' },
        makeContext(),
      )

      expect(globMock).toHaveBeenCalledTimes(1)
      expect(result.data.filenames).toContain('src/crash.ts')
    })

    test('ripgrep fallback handles truncation', async () => {
      fffState.finder = null
      globMock.mockResolvedValue({
        files: Array.from({ length: 5 }, (_, i) =>
          resolve(TEST_CWD, `file${i}.ts`),
        ),
        truncated: true,
      })

      const result = await GlobTool.call(
        { pattern: '**/*.ts' },
        makeContext({ globLimits: { maxResults: 3 } }),
      )

      expect(result.data.truncated).toBe(true)
    })
  })

  describe('mapToolResultToToolResultBlockParam', () => {
    test('returns "No files found" for empty results', () => {
      const block = GlobTool.mapToolResultToToolResultBlockParam(
        { filenames: [], numFiles: 0, durationMs: 10, truncated: false },
        'test-id',
      )

      expect(block.type).toBe('tool_result')
      expect(block.content).toBe('No files found')
    })

    test('lists filenames for non-empty results', () => {
      const block = GlobTool.mapToolResultToToolResultBlockParam(
        { filenames: ['a.ts', 'b.ts'], numFiles: 2, durationMs: 10, truncated: false },
        'test-id',
      )

      expect(block.content).toContain('a.ts')
      expect(block.content).toContain('b.ts')
      expect(block.content).not.toContain('truncated')
    })

    test('appends truncation notice when truncated', () => {
      const block = GlobTool.mapToolResultToToolResultBlockParam(
        { filenames: ['a.ts'], numFiles: 1, durationMs: 10, truncated: true },
        'test-id',
      )

      expect(block.content).toContain('truncated')
    })
  })

  describe('tool metadata', () => {
    test('name is Glob', () => {
      expect(GlobTool.name).toBe('Glob')
    })

    test('isReadOnly returns true', () => {
      expect(GlobTool.isReadOnly()).toBe(true)
    })

    test('isConcurrencySafe returns true', () => {
      expect(GlobTool.isConcurrencySafe()).toBe(true)
    })

    test('isSearchOrReadCommand returns search=true, read=false', () => {
      expect(GlobTool.isSearchOrReadCommand()).toEqual({ isSearch: true, isRead: false })
    })

    test('getPath returns expanded path when provided', () => {
      const result = GlobTool.getPath({ pattern: '*.ts', path: 'src' })
      expect(result).toBe(resolve(TEST_CWD, 'src'))
    })

    test('getPath returns cwd when no path provided', () => {
      const result = GlobTool.getPath({ pattern: '*.ts' })
      expect(result).toBe(TEST_CWD)
    })
  })
})
