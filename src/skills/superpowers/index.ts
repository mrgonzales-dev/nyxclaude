/**
 * Vendored "superpowers" skills (github.com/obra/superpowers, MIT —
 * see LICENSE.superpowers). These are default skills that ship with the
 * CLI but are NOT loaded into the system prompt. The prompt only gets a
 * short notice (names + one-line descriptions + base dir); the agent
 * Reads the relevant SKILL.md on demand.
 *
 * Files are embedded via generated.ts (no text-asset loader in the
 * bundler) and extracted under the bundled-skills temp root so the
 * filesystem permission allowlist (filesystem.ts ~:1949) covers reads.
 */
import { logForDebugging } from '../../utils/debug.js'
import { mkdir, open } from 'fs/promises'
import { constants as fsConstants } from 'fs'
import { dirname, join } from 'path'
import { getBundledSkillExtractDir } from '../bundledSkills.js'
import {
  SUPERPOWERS_SKILL_FILES,
  SUPERPOWERS_SKILL_MANIFEST,
} from './generated.js'

const SKILL_ROOT_NAME = 'superpowers'

let extractionPromise: Promise<string | null> | undefined

/**
 * Extract the vendored skills tree once per process. Returns the base
 * dir containing <skill>/SKILL.md, or null on write failure (skills are
 * optional — never let extraction break the prompt).
 */
export function ensureSuperpowersExtracted(): Promise<string | null> {
  extractionPromise ??= extractSuperpowers()
  return extractionPromise
}

async function extractSuperpowers(): Promise<string | null> {
  const dir = getBundledSkillExtractDir(SKILL_ROOT_NAME)
  try {
    // Reuse the same safe-write guarantees as bundled skills: O_EXCL so
    // we never follow a pre-planted file, owner-only modes.
    const byParent = new Map<string, [string, string][]>()
    for (const [relPath, content] of Object.entries(SUPERPOWERS_SKILL_FILES)) {
      const target = join(dir, relPath)
      const parent = dirname(target)
      const group = byParent.get(parent)
      if (group) group.push([target, content])
      else byParent.set(parent, [[target, content]])
    }
    const O_NOFOLLOW = fsConstants.O_NOFOLLOW ?? 0
    const flags =
      process.platform === 'win32'
        ? 'wx'
        : fsConstants.O_WRONLY | fsConstants.O_CREAT | fsConstants.O_EXCL | O_NOFOLLOW
    await Promise.all(
      [...byParent].map(async ([parent, entries]) => {
        await mkdir(parent, { recursive: true, mode: 0o700 })
        await Promise.all(
          entries.map(async ([p, c]) => {
            try {
              const fh = await open(p, flags as number, 0o600)
              try {
                await fh.writeFile(c, 'utf8')
              } finally {
                await fh.close()
              }
            } catch (e) {
              // File already extracted this session — fine.
              if ((e as NodeJS.ErrnoException).code !== 'EEXIST') throw e
            }
          }),
        )
      }),
    )
    return dir
  } catch (e) {
    logForDebugging(
      `Failed to extract superpowers skills to ${dir}: ${e instanceof Error ? e.message : String(e)}`,
    )
    return null
  }
}

/**
 * Short system-prompt section announcing the default skills. Awaits the
 * memoized extraction so the files are on disk before the model is told
 * to Read them. The resolved value is static per session (extract root
 * is process-memoized), so this is safe inside a cached
 * systemPromptSection — the first prompt build pays the one-time write.
 * Returns null on extraction failure so a broken tmpdir never blocks
 * the prompt with a dangling path.
 */
export async function getDefaultSkillsSection(): Promise<string | null> {
  const dir = await ensureSuperpowersExtracted()
  if (dir === null) return null
  const listing = Object.entries(SUPERPOWERS_SKILL_MANIFEST)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, desc]) => `- ${name} — ${desc}`)
    .join('\n')
  return [
    '# Built-in skills',
    '',
    `A library of reusable workflow skills is installed under \`${dir}/\`. Each skill is a directory with a SKILL.md plus optional reference files.`,
    '',
    'These are guidelines, not pre-loaded context. Do NOT read them all. When a task matches a skill below, Read that skill\'s SKILL.md (and any files it references) before doing the work. Skip this section entirely when no skill applies.',
    '',
    listing,
  ].join('\n')
}
