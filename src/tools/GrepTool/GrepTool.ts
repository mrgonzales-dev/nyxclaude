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
import { lazySchema } from '../../utils/lazySchema.js'
import {
  expandPath,
  relativizeContentLine,
  toRelativePath,
} from '../../utils/path.js'
// NYX-AGENT: fff (Fast File Finder) integration — in-process content search
// that replaces ripgrep forks for the common case.
import { getFileFinder } from '../../services/fff.js'
import {
  checkReadPermissionForTool,
  getFileReadIgnorePatterns,
  normalizePatternsToPath,
} from '../../utils/permissions/filesystem.js'
import type { PermissionDecision } from '../../utils/permissions/PermissionResult.js'
import { matchWildcardPattern } from '../../utils/permissions/shellRuleMatching.js'
import { getGlobExclusionsForPluginCache } from '../../utils/plugins/orphanedPluginFilter.js'
import { ripGrep } from '../../utils/ripgrep.js'
import { semanticBoolean } from '../../utils/semanticBoolean.js'
import { semanticNumber } from '../../utils/semanticNumber.js'
import { plural } from '../../utils/stringUtils.js'
import { GREP_TOOL_NAME, getDescription } from './prompt.js'
import {
  getToolUseSummary,
  renderToolResultMessage,
  renderToolUseErrorMessage,
  renderToolUseMessage,
} from './UI.js'

const inputSchema = lazySchema(() =>
  z.strictObject({
    pattern: z
      .string()
      .describe(
        'The regular expression pattern to search for in file contents',
      ),
    path: z
      .string()
      .optional()
      .describe(
        'File or directory to search in (rg PATH). Defaults to current working directory.',
      ),
    glob: z
      .string()
      .optional()
      .describe(
        'Glob pattern to filter files (e.g. "*.js", "*.{ts,tsx}") - maps to rg --glob',
      ),
    output_mode: z
      .enum(['content', 'files_with_matches', 'count'])
      .optional()
      .describe(
        'Output mode: "content" shows matching lines (supports -A/-B/-C context, -n line numbers, head_limit), "files_with_matches" shows file paths (supports head_limit), "count" shows match counts (supports head_limit). Defaults to "files_with_matches".',
      ),
    '-B': semanticNumber(z.number().optional()).describe(
      'Number of lines to show before each match (rg -B). Requires output_mode: "content", ignored otherwise.',
    ),
    '-A': semanticNumber(z.number().optional()).describe(
      'Number of lines to show after each match (rg -A). Requires output_mode: "content", ignored otherwise.',
    ),
    '-C': semanticNumber(z.number().optional()).describe('Alias for context.'),
    context: semanticNumber(z.number().optional()).describe(
      'Number of lines to show before and after each match (rg -C). Requires output_mode: "content", ignored otherwise.',
    ),
    '-n': semanticBoolean(z.boolean().optional()).describe(
      'Show line numbers in output (rg -n). Requires output_mode: "content", ignored otherwise. Defaults to true.',
    ),
    '-i': semanticBoolean(z.boolean().optional()).describe(
      'Case insensitive search (rg -i)',
    ),
    type: z
      .string()
      .optional()
      .describe(
        'File type to search (rg --type). Common types: js, py, rust, go, java, etc. More efficient than include for standard file types.',
      ),
    head_limit: semanticNumber(z.number().optional()).describe(
      'Limit output to first N lines/entries, equivalent to "| head -N". Works across all output modes: content (limits output lines), files_with_matches (limits file paths), count (limits count entries). Defaults to 250 when unspecified. Pass 0 for unlimited (use sparingly — large result sets waste context).',
    ),
    offset: semanticNumber(z.number().optional()).describe(
      'Skip first N lines/entries before applying head_limit, equivalent to "| tail -n +N | head -N". Works across all output modes. Defaults to 0.',
    ),
    multiline: semanticBoolean(z.boolean().optional()).describe(
      'Enable multiline mode where . matches newlines and patterns can span lines (rg -U --multiline-dotall). Default: false.',
    ),
  }),
)
type InputSchema = ReturnType<typeof inputSchema>

// Version control system directories to exclude from searches
// These are excluded automatically because they create noise in search results
const VCS_DIRECTORIES_TO_EXCLUDE = [
  '.git',
  '.svn',
  '.hg',
  '.bzr',
  '.jj',
  '.sl',
] as const

// Default cap on grep results when head_limit is unspecified. Unbounded content-mode
// greps can fill up to the 20KB persist threshold (~6-24K tokens/grep-heavy session).
// 250 is generous enough for exploratory searches while preventing context bloat.
// Pass head_limit=0 explicitly for unlimited.
const DEFAULT_HEAD_LIMIT = 250

function applyHeadLimit<T>(
  items: T[],
  limit: number | undefined,
  offset: number = 0,
): { items: T[]; appliedLimit: number | undefined } {
  // Explicit 0 = unlimited escape hatch
  if (limit === 0) {
    return { items: items.slice(offset), appliedLimit: undefined }
  }
  const effectiveLimit = limit ?? DEFAULT_HEAD_LIMIT
  const sliced = items.slice(offset, offset + effectiveLimit)
  // Only report appliedLimit when truncation actually occurred, so the model
  // knows there may be more results and can paginate with offset.
  const wasTruncated = items.length - offset > effectiveLimit
  return {
    items: sliced,
    appliedLimit: wasTruncated ? effectiveLimit : undefined,
  }
}

// Format limit/offset information for display in tool results.
// appliedLimit is only set when truncation actually occurred (see applyHeadLimit),
// so it may be undefined even when appliedOffset is set — build parts conditionally
// to avoid "limit: undefined" appearing in user-visible output.
function formatLimitInfo(
  appliedLimit: number | undefined,
  appliedOffset: number | undefined,
): string {
  const parts: string[] = []
  if (appliedLimit !== undefined) parts.push(`limit: ${appliedLimit}`)
  if (appliedOffset) parts.push(`offset: ${appliedOffset}`)
  return parts.join(', ')
}

const outputSchema = lazySchema(() =>
  z.object({
    mode: z.enum(['content', 'files_with_matches', 'count']).optional(),
    numFiles: z.number(),
    filenames: z.array(z.string()),
    content: z.string().optional(),
    numLines: z.number().optional(), // For content mode
    numMatches: z.number().optional(), // For count mode
    appliedLimit: z.number().optional(), // The limit that was applied (if any)
    appliedOffset: z.number().optional(), // The offset that was applied
  }),
)
type OutputSchema = ReturnType<typeof outputSchema>

type Output = z.infer<OutputSchema>

export const GrepTool = buildTool({
  name: GREP_TOOL_NAME,
  searchHint: 'search file contents with regex (ripgrep)',
  // 20K chars - tool result persistence threshold
  maxResultSizeChars: 20_000,
  strict: true,
  async description() {
    return getDescription()
  },
  userFacingName() {
    return 'Search'
  },
  getToolUseSummary,
  getActivityDescription(input) {
    const summary = getToolUseSummary(input)
    return summary ? `Searching for ${summary}` : 'Searching'
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
    return input.path ? `${input.pattern} in ${input.path}` : input.pattern
  },
  isSearchOrReadCommand() {
    return { isSearch: true, isRead: false }
  },
  getPath({ path }): string {
    return path || getCwd()
  },
  async preparePermissionMatcher({ pattern }) {
    return rulePattern => matchWildcardPattern(rulePattern, pattern)
  },
  async validateInput({ path }): Promise<ValidationResult> {
    // If path is provided, validate that it exists
    if (path) {
      const fs = getFsImplementation()
      const absolutePath = expandPath(path)

      // SECURITY: Skip filesystem operations for UNC paths to prevent NTLM credential leaks.
      if (absolutePath.startsWith('\\\\') || absolutePath.startsWith('//')) {
        return { result: true }
      }

      try {
        await fs.stat(absolutePath)
      } catch (e: unknown) {
        if (isENOENT(e)) {
          const cwdSuggestion = await suggestPathUnderCwd(absolutePath)
          let message = `Path does not exist: ${path}. ${FILE_NOT_FOUND_CWD_NOTE} ${getCwd()}.`
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
    }

    return { result: true }
  },
  async checkPermissions(input, context): Promise<PermissionDecision> {
    const appState = context.getAppState()
    return checkReadPermissionForTool(
      GrepTool,
      input,
      appState.toolPermissionContext,
    )
  },
  async prompt() {
    return getDescription()
  },
  renderToolUseMessage,
  renderToolUseErrorMessage,
  renderToolResultMessage,
  // SearchResultSummary shows content (mode=content) or filenames.join.
  // numFiles/numLines/numMatches are chrome ("Found 3 files") — fine to
  // skip (under-count, not phantom). Glob reuses this via UI.tsx:65.
  extractSearchText({ mode, content, filenames }) {
    if (mode === 'content' && content) return content
    return filenames.join('\n')
  },
  mapToolResultToToolResultBlockParam(
    {
      mode = 'files_with_matches',
      numFiles,
      filenames,
      content,
      numLines: _numLines,
      numMatches,
      appliedLimit,
      appliedOffset,
    },
    toolUseID,
  ) {
    if (mode === 'content') {
      const limitInfo = formatLimitInfo(appliedLimit, appliedOffset)
      const resultContent = content || 'No matches found'
      const finalContent = limitInfo
        ? `${resultContent}\n\n[Showing results with pagination = ${limitInfo}]`
        : resultContent
      return {
        tool_use_id: toolUseID,
        type: 'tool_result',
        content: finalContent,
      }
    }

    if (mode === 'count') {
      const limitInfo = formatLimitInfo(appliedLimit, appliedOffset)
      const rawContent = content || 'No matches found'
      const matches = numMatches ?? 0
      const files = numFiles ?? 0
      const summary = `\n\nFound ${matches} total ${matches === 1 ? 'occurrence' : 'occurrences'} across ${files} ${files === 1 ? 'file' : 'files'}.${limitInfo ? ` with pagination = ${limitInfo}` : ''}`
      return {
        tool_use_id: toolUseID,
        type: 'tool_result',
        content: rawContent + summary,
      }
    }

    // files_with_matches mode
    const limitInfo = formatLimitInfo(appliedLimit, appliedOffset)
    if (numFiles === 0) {
      return {
        tool_use_id: toolUseID,
        type: 'tool_result',
        content: 'No files found',
      }
    }
    // head_limit has already been applied in call() method, so just show all filenames
    const result = `Found ${numFiles} ${plural(numFiles, 'file')}${limitInfo ? ` ${limitInfo}` : ''}\n${filenames.join('\n')}`
    return {
      tool_use_id: toolUseID,
      type: 'tool_result',
      content: result,
    }
  },
  async call(
    {
      pattern,
      path,
      glob,
      type,
      output_mode = 'files_with_matches',
      '-B': context_before,
      '-A': context_after,
      '-C': context_c,
      context,
      '-n': show_line_numbers = true,
      '-i': case_insensitive = false,
      head_limit,
      offset = 0,
      multiline = false,
    },
    { abortController, getAppState },
  ) {
    // NYX-AGENT: try fff (in-process, warm index) first. Fall back to
    // ripgrep when fff is unavailable or the query uses features fff
    // doesn't support (multiline regex, --type filtering).
    const finder = getFileFinder()
    const canUseFff = finder !== null && !multiline && !type

    if (canUseFff) {
      try {
        const result = await callWithFff(
          finder!,
          {
            pattern,
            path,
            glob,
            output_mode,
            context_before,
            context_after,
            context_c,
            context,
            show_line_numbers,
            case_insensitive,
            head_limit,
            offset,
          },
          { getAppState },
        )
        if (result) return result
      } catch (e) {
        // fff failed — fall through to ripgrep
        // eslint-disable-next-line no-console
        console.warn(`[fff] grep failed, falling back to ripgrep: ${e}`)
      }
    }

    return callWithRipgrep(
      {
        pattern,
        path,
        glob,
        type,
        output_mode,
        context_before,
        context_after,
        context_c,
        context,
        show_line_numbers,
        case_insensitive,
        head_limit,
        offset,
        multiline,
      },
      { abortController, getAppState },
    )
  },
} satisfies ToolDef<InputSchema, Output>)

// NYX-AGENT: fff-based grep implementation. Uses the long-lived FileFinder
// index for sub-10ms content search. Post-filters for glob/path/ignore
// patterns that fff's grep() doesn't natively support.
async function callWithFff(
  finder: NonNullable<ReturnType<typeof getFileFinder>>,
  input: {
    pattern: string
    path?: string
    glob?: string
    output_mode: 'content' | 'files_with_matches' | 'count'
    context_before?: number
    context_after?: number
    context_c?: number
    context?: number
    show_line_numbers?: boolean
    case_insensitive?: boolean
    head_limit?: number
    offset: number
  },
  { getAppState }: { getAppState: () => { toolPermissionContext: any } },
): Promise<{ data: Output } | null> {
  const {
    pattern,
    path,
    glob,
    output_mode = 'files_with_matches',
    context_before,
    context_after,
    context_c,
    context,
    show_line_numbers = true,
    case_insensitive = false,
    head_limit,
    offset,
  } = input

  const cwd = getCwd()
  const absolutePath = path ? expandPath(path) : cwd

  // If searching outside the indexed base path, bail out (let ripgrep handle it)
  const basePathResult = finder.getBasePath()
  if (!basePathResult.ok || !basePathResult.value) return null
  const basePath = basePathResult.value
  if (!absolutePath.startsWith(basePath)) return null

  // Build the regex pattern. fff uses Rust regex crate (same as ripgrep).
  let regexPattern = pattern
  if (case_insensitive && !pattern.startsWith('(?i)')) {
    regexPattern = `(?i)${pattern}`
  }

  // Compute context lines (-C takes precedence over -B/-A)
  let beforeCtx = 0
  let afterCtx = 0
  if (output_mode === 'content') {
    if (context !== undefined) {
      beforeCtx = context
      afterCtx = context
    } else if (context_c !== undefined) {
      beforeCtx = context_c
      afterCtx = context_c
    } else {
      beforeCtx = context_before ?? 0
      afterCtx = context_after ?? 0
    }
  }

  // Determine page size — fetch enough to cover head_limit + offset
  const effectiveLimit = head_limit === 0 ? 500 : head_limit ?? DEFAULT_HEAD_LIMIT
  const pageSize = Math.min(effectiveLimit + offset, 1000)

  // Collect results, possibly across multiple pages
  const allMatches: any[] = []
  let cursor: any = null
  let pagesFetched = 0
  const MAX_PAGES = 10

  while (pagesFetched < MAX_PAGES) {
    const grepResult = finder.grep(regexPattern, {
      mode: 'regex' as const,
      smartCase: false,
      beforeContext: beforeCtx,
      afterContext: afterCtx,
      pageSize,
      cursor,
    })

    if (!grepResult.ok) {
      // Pattern compile error or other failure — bail out to ripgrep
      return null
    }

    allMatches.push(...grepResult.value.items)

    // Stop if we have enough results, or no more pages
    if (allMatches.length >= effectiveLimit + offset) break
    if (!grepResult.value.nextCursor) break

    cursor = grepResult.value.nextCursor
    pagesFetched++
  }

  // Post-filter: restrict to the requested subdirectory if path was given
  let filtered = allMatches
  if (path && absolutePath !== basePath) {
    const relBase = absolutePath.slice(basePath.length).replace(/^\//, '')
    filtered = filtered.filter(m => m.relativePath.startsWith(relBase))
  }

  // Post-filter: glob patterns
  if (glob) {
    const globPatterns = parseGlobPatterns(glob)
    filtered = filtered.filter(m =>
      globPatterns.some(g => matchGlob(m.relativePath, g)),
    )
  }

  // Post-filter: VCS directories (fff respects .gitignore but may include
  // hidden dirs when --hidden equivalent is on)
  filtered = filtered.filter(m =>
    !VCS_DIRECTORIES_TO_EXCLUDE.some(d => m.relativePath.startsWith(`${d}/`) || m.relativePath === d),
  )

  // Post-filter: custom ignore patterns from permission context
  try {
    const appState = getAppState()
    const ignorePatterns = normalizePatternsToPath(
      getFileReadIgnorePatterns(appState.toolPermissionContext),
      cwd,
    )
    if (ignorePatterns.length > 0) {
      filtered = filtered.filter(m =>
        !ignorePatterns.some(ip => matchGlob(m.relativePath, ip.replace(/^\//, ''))),
      )
    }
  } catch {
    // ignore permission errors — best effort
  }

  // Format output based on mode
  if (output_mode === 'content') {
    const { items: limited, appliedLimit } = applyHeadLimit(filtered, head_limit, offset)
    const lines = limited.map(m => {
      const relPath = m.relativePath
      const lineNum = show_line_numbers ? `${m.lineNumber}:` : ''
      // Context lines from fff come as separate entries with contextBefore/contextAfter
      // For simplicity, format each match line with its context inline
      const parts: string[] = []
      if (m.contextBefore) {
        for (let i = 0; i < m.contextBefore.length; i++) {
          const ctxLine = m.contextBefore[i]!
          const ctxLineNum = m.lineNumber - m.contextBefore.length + i
          parts.push(`${relPath}-${ctxLineNum}-${ctxLine}`)
        }
      }
      parts.push(`${relPath}:${lineNum}${m.lineContent}`)
      if (m.contextAfter) {
        for (let i = 0; i < m.contextAfter.length; i++) {
          const ctxLine = m.contextAfter[i]!
          const ctxLineNum = m.lineNumber + 1 + i
          parts.push(`${relPath}-${ctxLineNum}-${ctxLine}`)
        }
      }
      return parts.join('\n')
    })
    const output: Output = {
      mode: 'content',
      numFiles: 0,
      filenames: [],
      content: lines.join('\n'),
      numLines: lines.length,
      ...(appliedLimit !== undefined && { appliedLimit }),
      ...(offset > 0 && { appliedOffset: offset }),
    }
    return { data: output }
  }

  if (output_mode === 'count') {
    // Count matches per file
    const counts = new Map<string, number>()
    for (const m of filtered) {
      counts.set(m.relativePath, (counts.get(m.relativePath) ?? 0) + 1)
    }
    const sortedEntries = [...counts.entries()].sort((a, b) => b[1] - a[1])
    const { items: limited, appliedLimit } = applyHeadLimit(sortedEntries, head_limit, offset)
    const countLines = limited.map(([file, count]) => `${file}:${count}`)
    const totalMatches = limited.reduce((sum, [, c]) => sum + c, 0)
    const output: Output = {
      mode: 'count',
      numFiles: limited.length,
      filenames: [],
      content: countLines.join('\n'),
      numMatches: totalMatches,
      ...(appliedLimit !== undefined && { appliedLimit }),
      ...(offset > 0 && { appliedOffset: offset }),
    }
    return { data: output }
  }

  // files_with_matches mode (default)
  // Deduplicate by file, sort by frecency score (fff already returns in frecency order)
  const seenFiles = new Set<string>()
  const uniqueFiles: string[] = []
  for (const m of filtered) {
    if (!seenFiles.has(m.relativePath)) {
      seenFiles.add(m.relativePath)
      uniqueFiles.push(m.relativePath)
    }
  }

  const { items: limitedFiles, appliedLimit } = applyHeadLimit(uniqueFiles, head_limit, offset)
  const output: Output = {
    mode: 'files_with_matches',
    filenames: limitedFiles,
    numFiles: limitedFiles.length,
    ...(appliedLimit !== undefined && { appliedLimit }),
    ...(offset > 0 && { appliedOffset: offset }),
  }
  return { data: output }
}

// Parse a glob string like "*.ts *.tsx" or "*.{js,ts}" into individual patterns
function parseGlobPatterns(glob: string): string[] {
  const patterns: string[] = []
  const rawPatterns = glob.split(/\s+/)
  for (const raw of rawPatterns) {
    if (raw.includes('{') && raw.includes('}')) {
      patterns.push(raw)
    } else {
      patterns.push(...raw.split(',').filter(Boolean))
    }
  }
  return patterns.filter(Boolean)
}

// Simple glob matcher — supports *, **, and brace expansion {a,b}
function matchGlob(filePath: string, pattern: string): boolean {
  // Expand braces: *.{ts,tsx} → *.ts, *.tsx
  const expanded = expandBraces(pattern)
  return expanded.some(p => matchSingleGlob(filePath, p))
}

function expandBraces(pattern: string): string[] {
  const match = pattern.match(/^(.*)\{([^}]+)\}(.*)$/)
  if (!match) return [pattern]
  const [, prefix, options, suffix] = match
  return options!.split(',').map(opt => `${prefix}${opt}${suffix}`)
}

function matchSingleGlob(filePath: string, pattern: string): boolean {
  // Ripgrep-style glob matching: a pattern without ** or / matches at any depth.
  // E.g. "*.ts" matches "src/foo.ts" (equivalent to "**/*.ts").
  // A pattern starting with / matches from the root only.
  let normalizedPattern = pattern
  if (!pattern.includes('**') && !pattern.includes('/')) {
    // No path separator and no ** → match at any depth
    normalizedPattern = `**/${pattern}`
  } else if (pattern.startsWith('/')) {
    // Leading / → root-relative
    normalizedPattern = pattern.slice(1)
  }

  // Convert glob to regex. Escape literal dots FIRST, before introducing
  // any regex metacharacters via the ** and * replacements.
  let regex = normalizedPattern
    .replace(/\./g, '\\.')        // escape literal dots
    .replace(/\*\*/g, '\x00')     // placeholder for **
    .replace(/\*/g, '[^/]*')      // single * → no path separators
    .replace(/\x00/g, '.*')       // ** → any path
    .replace(/\?/g, '[^/]')       // ? → single non-separator
  regex = `^${regex}$`
  return new RegExp(regex).test(filePath)
}

// NYX-AGENT: ripgrep fallback — the original GrepTool.call() logic, extracted
// as a standalone function for use when fff is unavailable or unsupported.
async function callWithRipgrep(
  input: {
    pattern: string
    path?: string
    glob?: string
    type?: string
    output_mode: 'content' | 'files_with_matches' | 'count'
    context_before?: number
    context_after?: number
    context_c?: number
    context?: number
    show_line_numbers?: boolean
    case_insensitive?: boolean
    head_limit?: number
    offset: number
    multiline: boolean
  },
  { abortController, getAppState }: { abortController: AbortController; getAppState: () => any },
): Promise<{ data: Output }> {
  const {
    pattern,
    path,
    glob,
    type,
    output_mode = 'files_with_matches',
    context_before,
    context_after,
    context_c,
    context,
    show_line_numbers = true,
    case_insensitive = false,
    head_limit,
    offset = 0,
    multiline = false,
  } = input
    const absolutePath = path ? expandPath(path) : getCwd()
    const args = ['--hidden']

    // Exclude VCS directories to avoid noise from version control metadata
    for (const dir of VCS_DIRECTORIES_TO_EXCLUDE) {
      args.push('--glob', `!${dir}`)
    }

    // Limit line length to prevent base64/minified content from cluttering output
    args.push('--max-columns', '500')

    // Only apply multiline flags when explicitly requested
    if (multiline) {
      args.push('-U', '--multiline-dotall')
    }

    // Add optional flags
    if (case_insensitive) {
      args.push('-i')
    }

    // Add output mode flags
    if (output_mode === 'files_with_matches') {
      args.push('-l')
    } else if (output_mode === 'count') {
      args.push('-c')
    }

    // Add line numbers if requested
    if (show_line_numbers && output_mode === 'content') {
      args.push('-n')
    }

    // Add context flags (-C/context takes precedence over context_before/context_after)
    if (output_mode === 'content') {
      if (context !== undefined) {
        args.push('-C', context.toString())
      } else if (context_c !== undefined) {
        args.push('-C', context_c.toString())
      } else {
        if (context_before !== undefined) {
          args.push('-B', context_before.toString())
        }
        if (context_after !== undefined) {
          args.push('-A', context_after.toString())
        }
      }
    }

    // If pattern starts with dash, use -e flag to specify it as a pattern
    // This prevents ripgrep from interpreting it as a command-line option
    if (pattern.startsWith('-')) {
      args.push('-e', pattern)
    } else {
      args.push(pattern)
    }

    // Add type filter if specified
    if (type) {
      args.push('--type', type)
    }

    if (glob) {
      // Split on commas and spaces, but preserve patterns with braces
      const globPatterns: string[] = []
      const rawPatterns = glob.split(/\s+/)

      for (const rawPattern of rawPatterns) {
        // If pattern contains braces, don't split further
        if (rawPattern.includes('{') && rawPattern.includes('}')) {
          globPatterns.push(rawPattern)
        } else {
          // Split on commas for patterns without braces
          globPatterns.push(...rawPattern.split(',').filter(Boolean))
        }
      }

      for (const globPattern of globPatterns.filter(Boolean)) {
        args.push('--glob', globPattern)
      }
    }

    // Add ignore patterns
    const appState = getAppState()
    const ignorePatterns = normalizePatternsToPath(
      getFileReadIgnorePatterns(appState.toolPermissionContext),
      getCwd(),
    )
    for (const ignorePattern of ignorePatterns) {
      // Note: ripgrep only applies gitignore patterns relative to the working directory
      // So for non-absolute paths, we need to prefix them with '**'
      // See: https://github.com/BurntSushi/ripgrep/discussions/2156#discussioncomment-2316335
      //
      // We also need to negate the pattern with `!` to exclude it
      const rgIgnorePattern = ignorePattern.startsWith('/')
        ? `!${ignorePattern}`
        : `!**/${ignorePattern}`
      args.push('--glob', rgIgnorePattern)
    }

    // Exclude orphaned plugin version directories
    for (const exclusion of await getGlobExclusionsForPluginCache(
      absolutePath,
    )) {
      args.push('--glob', exclusion)
    }

    // WSL has severe performance penalty for file reads (3-5x slower on WSL2)
    // The timeout is handled by ripgrep itself via execFile timeout option
    // We don't use AbortController for timeout to avoid interrupting the agent loop
    // If ripgrep times out, it throws RipgrepTimeoutError which propagates up
    // so Nyxclaude knows the search didn't complete (rather than thinking there were no matches)
    const results = await ripGrep(args, absolutePath, abortController.signal)

    if (output_mode === 'content') {
      // For content mode, results are the actual content lines
      // Convert absolute paths to relative paths to save tokens

      // Apply head_limit first — relativize is per-line work, so
      // avoid processing lines that will be discarded (broad patterns can
      // return 10k+ lines with head_limit keeping only ~30-100).
      const { items: limitedResults, appliedLimit } = applyHeadLimit(
        results,
        head_limit,
        offset,
      )

      // Lines are match rows (`path:content` / `path:num:content`) or context
      // rows (`path-content` / `path-num-content` for -A/-B/-C). relativizeContentLine
      // strips the known cwd prefix, so the delimiter and Windows drive colons /
      // dashes in path names never need to be parsed.
      const finalLines = limitedResults.map(line => relativizeContentLine(line))
      const output = {
        mode: 'content' as const,
        numFiles: 0, // Not applicable for content mode
        filenames: [],
        content: finalLines.join('\n'),
        numLines: finalLines.length,
        ...(appliedLimit !== undefined && { appliedLimit }),
        ...(offset > 0 && { appliedOffset: offset }),
      }
      return { data: output }
    }

    if (output_mode === 'count') {
      // For count mode, pass through raw ripgrep output (filename:count format)
      // Apply head_limit first to avoid relativizing entries that will be discarded.
      const { items: limitedResults, appliedLimit } = applyHeadLimit(
        results,
        head_limit,
        offset,
      )

      // Convert absolute paths to relative paths to save tokens
      const finalCountLines = limitedResults.map(line => {
        // Lines have format: /absolute/path:count
        const colonIndex = line.lastIndexOf(':')
        if (colonIndex > 0) {
          const filePath = line.substring(0, colonIndex)
          const count = line.substring(colonIndex)
          return toRelativePath(filePath) + count
        }
        return line
      })

      // Parse count output to extract total matches and file count
      let totalMatches = 0
      let fileCount = 0
      for (const line of finalCountLines) {
        const colonIndex = line.lastIndexOf(':')
        if (colonIndex > 0) {
          const countStr = line.substring(colonIndex + 1)
          const count = parseInt(countStr, 10)
          if (!isNaN(count)) {
            totalMatches += count
            fileCount += 1
          }
        }
      }

      const output = {
        mode: 'count' as const,
        numFiles: fileCount,
        filenames: [],
        content: finalCountLines.join('\n'),
        numMatches: totalMatches,
        ...(appliedLimit !== undefined && { appliedLimit }),
        ...(offset > 0 && { appliedOffset: offset }),
      }
      return { data: output }
    }

    // For files_with_matches mode (default)
    // Use allSettled so a single ENOENT (file deleted between ripgrep's scan
    // and this stat) does not reject the whole batch. Failed stats sort as mtime 0.
    const stats = await Promise.allSettled(
      results.map(_ => getFsImplementation().stat(_)),
    )
    const sortedMatches = results
      // Sort by modification time
      .map((_, i) => {
        const r = stats[i]!
        return [
          _,
          r.status === 'fulfilled' ? (r.value.mtimeMs ?? 0) : 0,
        ] as const
      })
      .sort((a, b) => {
        if (process.env.NODE_ENV === 'test') {
          // In tests, we always want to sort by filename, so that results are deterministic
          return a[0].localeCompare(b[0])
        }
        const timeComparison = b[1] - a[1]
        if (timeComparison === 0) {
          // Sort by filename as a tiebreaker
          return a[0].localeCompare(b[0])
        }
        return timeComparison
      })
      .map(_ => _[0])

    // Apply head_limit to sorted file list (like "| head -N")
    const { items: finalMatches, appliedLimit } = applyHeadLimit(
      sortedMatches,
      head_limit,
      offset,
    )

    // Convert absolute paths to relative paths to save tokens
    const relativeMatches = finalMatches.map(toRelativePath)

    const output = {
      mode: 'files_with_matches' as const,
      filenames: relativeMatches,
      numFiles: relativeMatches.length,
      ...(appliedLimit !== undefined && { appliedLimit }),
      ...(offset > 0 && { appliedOffset: offset }),
    }

    return {
      data: output,
    }
}
