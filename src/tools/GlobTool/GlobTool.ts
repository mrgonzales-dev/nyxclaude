import { z } from 'zod/v4'
import type { ValidationResult } from '../../Tool.js'
import { buildTool, type ToolDef } from '../../Tool.js'
import { getCwd } from '../../utils/cwd.js'
import { isENOENT } from '../../utils/errors.js'
import {
  FILE_NOT_FOUND_CWD_NOTE,
  suggestPathUnderCwd,
} from '../../utils/file.js'
import { getFsImplementation } from '../../utils/fsOperations.js'
import { glob } from '../../utils/glob.js'
import { lazySchema } from '../../utils/lazySchema.js'
import { expandPath, toRelativePath } from '../../utils/path.js'
import { checkReadPermissionForTool } from '../../utils/permissions/filesystem.js'
import type { PermissionDecision } from '../../utils/permissions/PermissionResult.js'
import { matchWildcardPattern } from '../../utils/permissions/shellRuleMatching.js'
// NYXCLAUDE: fff (Fast File Finder) integration — in-process file pattern
// matching that replaces ripgrep forks for the common case.
import { getFileFinder } from '../../services/fff.js'
import { DESCRIPTION, GLOB_TOOL_NAME } from './prompt.js'
import {
  getToolUseSummary,
  renderToolResultMessage,
  renderToolUseErrorMessage,
  renderToolUseMessage,
  userFacingName,
} from './UI.js'

const inputSchema = lazySchema(() =>
  z.strictObject({
    pattern: z.string().describe('The glob pattern to match files against'),
    path: z
      .string()
      .optional()
      .describe(
        'The directory to search in. If not specified, the current working directory will be used. IMPORTANT: Omit this field to use the default directory. DO NOT enter "undefined" or "null" - simply omit it for the default behavior. Must be a valid directory path if provided.',
      ),
  }),
)
type InputSchema = ReturnType<typeof inputSchema>

const outputSchema = lazySchema(() =>
  z.object({
    durationMs: z
      .number()
      .describe('Time taken to execute the search in milliseconds'),
    numFiles: z.number().describe('Total number of files found'),
    filenames: z
      .array(z.string())
      .describe('Array of file paths that match the pattern'),
    truncated: z
      .boolean()
      .describe('Whether results were truncated (limited to 100 files)'),
  }),
)
type OutputSchema = ReturnType<typeof outputSchema>

export type Output = z.infer<OutputSchema>

export const GlobTool = buildTool({
  name: GLOB_TOOL_NAME,
  searchHint: 'find files by name pattern or wildcard',
  maxResultSizeChars: 100_000,
  async description() {
    return DESCRIPTION
  },
  userFacingName,
  getToolUseSummary,
  getActivityDescription(input) {
    const summary = getToolUseSummary(input)
    return summary ? `Finding ${summary}` : 'Finding files'
  },
  get inputSchema(): InputSchema {
    return inputSchema()
  },
  get outputSchema(): OutputSchema {
    return outputSchema()
  },
  isConcurrencySafe() {
    return true
  },
  isReadOnly() {
    return true
  },
  toAutoClassifierInput(input) {
    return input.pattern
  },
  isSearchOrReadCommand() {
    return { isSearch: true, isRead: false }
  },
  getPath({ path }): string {
    return path ? expandPath(path) : getCwd()
  },
  async preparePermissionMatcher({ pattern }) {
    return rulePattern => matchWildcardPattern(rulePattern, pattern)
  },
  async validateInput({ path }): Promise<ValidationResult> {
    // If path is provided, validate that it exists and is a directory
    if (path) {
      const fs = getFsImplementation()
      const absolutePath = expandPath(path)

      // SECURITY: Skip filesystem operations for UNC paths to prevent NTLM credential leaks.
      if (absolutePath.startsWith('\\\\') || absolutePath.startsWith('//')) {
        return { result: true }
      }

      let stats
      try {
        stats = await fs.stat(absolutePath)
      } catch (e: unknown) {
        if (isENOENT(e)) {
          const cwdSuggestion = await suggestPathUnderCwd(absolutePath)
          let message = `Directory does not exist: ${path}. ${FILE_NOT_FOUND_CWD_NOTE} ${getCwd()}.`
          if (cwdSuggestion) {
            message += ` Did you mean ${cwdSuggestion}?`
          }
          return {
            result: false,
            message,
            errorCode: 1,
          }
        }
        throw e
      }

      if (!stats.isDirectory()) {
        return {
          result: false,
          message: `Path is not a directory: ${path}`,
          errorCode: 2,
        }
      }
    }

    return { result: true }
  },
  async checkPermissions(input, context): Promise<PermissionDecision> {
    const appState = context.getAppState()
    return checkReadPermissionForTool(
      GlobTool,
      input,
      appState.toolPermissionContext,
    )
  },
  async prompt() {
    return DESCRIPTION
  },
  renderToolUseMessage,
  renderToolUseErrorMessage,
  renderToolResultMessage,
  // Reuses Grep's render (UI.tsx:65) — shows filenames.join. durationMs/
  // numFiles are "Found 3 files in 12ms" chrome (under-count, fine).
  extractSearchText({ filenames }) {
    return filenames.join('\n')
  },
  async call(input, { abortController, getAppState, globLimits }) {
    const start = Date.now()
    const appState = getAppState()
    const limit = globLimits?.maxResults ?? 100

    // NYXCLAUDE: try fff (in-process, warm index) first. Fall back to
    // ripgrep when fff is unavailable or the search path is outside the
    // indexed base path.
    const finder = getFileFinder()
    if (finder) {
      try {
        const result = await callWithFff(
          finder,
          input,
          { limit },
        )
        if (result) {
          const output: Output = {
            filenames: result.filenames,
            durationMs: Date.now() - start,
            numFiles: result.filenames.length,
            truncated: result.truncated,
          }
          return { data: output }
        }
      } catch (e) {
        // fff failed — fall through to ripgrep
        // eslint-disable-next-line no-console
        console.warn(`[fff] glob failed, falling back to ripgrep: ${e}`)
      }
    }

    const { files, truncated } = await glob(
      input.pattern,
      GlobTool.getPath(input),
      { limit, offset: 0 },
      abortController.signal,
      appState.toolPermissionContext,
    )
    // Relativize paths under cwd to save tokens (same as GrepTool)
    const filenames = files.map(toRelativePath)
    const output: Output = {
      filenames,
      durationMs: Date.now() - start,
      numFiles: filenames.length,
      truncated,
    }
    return {
      data: output,
    }
  },
  mapToolResultToToolResultBlockParam(output, toolUseID) {
    if (output.filenames.length === 0) {
      return {
        tool_use_id: toolUseID,
        type: 'tool_result',
        content: 'No files found',
      }
    }
    return {
      tool_use_id: toolUseID,
      type: 'tool_result',
      content: [
        ...output.filenames,
        ...(output.truncated
          ? [
              '(Results are truncated. Consider using a more specific path or pattern.)',
            ]
          : []),
      ].join('\n'),
    }
  },
} satisfies ToolDef<InputSchema, Output>)

// NYXCLAUDE: fff-based glob implementation. Uses the long-lived FileFinder
// index for fast file pattern matching. Returns null when the search path
// is outside the indexed base path, so the caller falls back to ripgrep.
async function callWithFff(
  finder: NonNullable<ReturnType<typeof getFileFinder>>,
  input: { pattern: string; path?: string },
  { limit }: { limit: number },
): Promise<{ filenames: string[]; truncated: boolean } | null> {
  const cwd = getCwd()
  const absolutePath = input.path ? expandPath(input.path) : cwd

  // If searching outside the indexed base path, bail out (let ripgrep handle it)
  const basePathResult = finder.getBasePath()
  if (!basePathResult.ok || !basePathResult.value) return null
  const basePath = basePathResult.value
  // Use path-boundary-aware check to avoid false prefix matches (e.g. /proj vs /proj2)
  if (absolutePath !== basePath && !absolutePath.startsWith(basePath + '/')) return null

  // fff's glob() takes a glob pattern and returns matching file paths.
  // Fetch enough to cover the limit, then truncate.
  const pageSize = Math.min(limit + 1, 1000) // +1 to detect truncation
  const globResult = finder.glob(input.pattern, { pageSize })

  if (!globResult.ok) {
    // Pattern error or other failure — bail out to ripgrep
    return null
  }

  const rawValue = globResult.value
  const items: string[] = (rawValue && typeof rawValue === 'object' && 'items' in rawValue)
    ? rawValue.items
    : rawValue
  if (!Array.isArray(items)) return null

  // fff returns absolute paths; relativize under cwd to save tokens
  // Compute the subdirectory prefix relative to cwd (not basePath) since
  // toRelativePath produces paths relative to cwd.
  let subDirPrefix: string | null = null
  if (input.path && absolutePath !== basePath) {
    // absolutePath is under basePath; relativize it under cwd
    subDirPrefix = toRelativePath(absolutePath)
    if (subDirPrefix === '.') subDirPrefix = null
  }

  const relativePaths = items
    .map((p: string) => toRelativePath(p))
    // Filter to the requested subdirectory if path was given
    .filter((p: string) => {
      if (!subDirPrefix) return true
      // Path-boundary-aware: avoid matching sibling dirs with shared prefix
      return p === subDirPrefix || p.startsWith(subDirPrefix + '/')
    })

  // Truncation is detected when fff returned a full page (pageSize items),
  // meaning there may be more results. When post-fetch filtering reduces
  // results below limit, we cannot know if more matches exist in the
  // unfiltered set — treat a full page as truncated.
  const truncated = items.length >= pageSize || relativePaths.length > limit
  const filenames = relativePaths.slice(0, limit)

  return { filenames, truncated }
}
