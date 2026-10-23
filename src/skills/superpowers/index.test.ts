import { describe, expect, test } from 'bun:test'
import { existsSync } from 'fs'
import { join } from 'path'
import {
  ensureSuperpowersExtracted,
  getDefaultSkillsSection,
} from './index.js'
import { SUPERPOWERS_SKILL_MANIFEST } from './generated.js'

// MACRO.VERSION is a bundle-time define; provide it for tests (same
// pattern as StartupScreen.test.ts).
const macroGlobal = globalThis as unknown as {
  MACRO?: { VERSION: string }
}
if (macroGlobal.MACRO === undefined) macroGlobal.MACRO = { VERSION: 'test' }

describe('superpowers default skills', () => {
  test('manifest covers the vendored skill set', () => {
    const names = Object.keys(SUPERPOWERS_SKILL_MANIFEST)
    expect(names).toContain('brainstorming')
    expect(names).toContain('test-driven-development')
    expect(names).toContain('systematic-debugging')
    expect(names.length).toBeGreaterThanOrEqual(14)
  })

  test('getDefaultSkillsSection emits a short notice, not skill bodies', async () => {
    const section = await getDefaultSkillsSection()
    expect(section).not.toBeNull()
    expect(section).toContain('# Built-in skills')
    expect(section).toContain('SKILL.md')
    expect(section).toContain('superpowers')
    // The notice must not embed a full skill body — the whole point is
    // on-demand reads. Generous bound: ~30 lines.
    expect(section!.split('\n').length).toBeLessThan(30)
  })

  test('ensureSuperpowersExtracted writes SKILL.md files to disk', async () => {
    const dir = await ensureSuperpowersExtracted()
    // Extraction can legitimately fail on read-only tmpdirs — skip rather
    // than fail in that environment.
    if (dir === null) return
    expect(existsSync(join(dir, 'brainstorming', 'SKILL.md'))).toBe(true)
    expect(existsSync(join(dir, 'test-driven-development', 'SKILL.md'))).toBe(
      true,
    )
    // Idempotent: second call resolves to the same dir.
    expect(await ensureSuperpowersExtracted()).toBe(dir)
  })
})
