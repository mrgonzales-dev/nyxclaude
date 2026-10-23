/**
 * Generates src/skills/superpowers/generated.ts from the vendored
 * src/skills/superpowers/skills/ tree (obra/superpowers, MIT — see
 * LICENSE.superpowers). The bundler has no text-asset loader, so skill
 * files are embedded as a Record<relPath, content> and extracted to
 * disk at runtime — same pattern as bundledSkills.ts `files`.
 *
 * Run: bun run scripts/generate-superpowers-skills.ts
 * Re-run after updating the vendored skills/ tree.
 */
import { readdirSync, readFileSync, writeFileSync } from 'fs'
import { join, relative, sep } from 'path'

const SKILLS_DIR = join(import.meta.dir, '../src/skills/superpowers/skills')
const OUT = join(import.meta.dir, '../src/skills/superpowers/generated.ts')

function walk(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name)
    if (entry.isDirectory()) out.push(...walk(p))
    else if (entry.isFile()) out.push(p)
  }
  return out.sort()
}

const files: Record<string, string> = {}
for (const abs of walk(SKILLS_DIR)) {
  const rel = relative(SKILLS_DIR, abs).split(sep).join('/')
  files[rel] = readFileSync(abs, 'utf8')
}

// Extract each skill's `description:` frontmatter line for the prompt
// listing. Supports folded plain scalars on one line only — the
// superpowers frontmatter all uses single-line quoted or plain scalars.
const manifest: Record<string, string> = {}
for (const [path, content] of Object.entries(files)) {
  const m = path.match(/^([^/]+)\/SKILL\.md$/)
  if (!m) continue
  const fm = content.match(/^description:\s*["']?(.*?)["']?\s*$/m)
  // Keep the listing short — the prompt is a notice, not docs. Truncate
  // at the first sentence or 100 chars.
  let desc = (fm?.[1] ?? '').replace(/\s+/g, ' ').trim()
  const cut = desc.search(/[.;]\s/)
  if (cut > 0) desc = desc.slice(0, cut)
  if (desc.length > 100) desc = desc.slice(0, 100).replace(/\s\S*$/, '') + '…'
  manifest[m[1]] = desc
}

// JSON.stringify handles escaping/backticks safely.
const body = `// GENERATED FILE — do not edit. Regenerate with:
//   bun run scripts/generate-superpowers-skills.ts
// Source: github.com/obra/superpowers @ 2ce8aa1 (MIT, see LICENSE.superpowers)

/** Relative path -> file content for the vendored superpowers skills tree. */
export const SUPERPOWERS_SKILL_FILES: Record<string, string> = ${JSON.stringify(files, null, 2)}

/** Skill name -> one-line description from SKILL.md frontmatter. */
export const SUPERPOWERS_SKILL_MANIFEST: Record<string, string> = ${JSON.stringify(manifest, null, 2)}
`

writeFileSync(OUT, body)
console.log(`wrote ${OUT}: ${Object.keys(files).length} files, ${Object.keys(manifest).length} skills`)
