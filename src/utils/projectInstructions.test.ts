import { describe, expect, test } from 'bun:test'
import { join } from 'node:path'

import {
  findProjectInstructionFilePathInAncestors,
  getProjectInstructionFilePath,
  getProjectInstructionFilePaths,
  hasProjectInstructionFile,
  isProjectInstructionFileName,
  PRIMARY_PROJECT_INSTRUCTION_FILE,
} from './projectInstructions.js'

describe('projectInstructions', () => {
  test('returns AGENTS.md as the root project instruction file', () => {
    const dir = '/repo'
    const existingPaths = new Set([
      join(dir, PRIMARY_PROJECT_INSTRUCTION_FILE),
    ])

    const filePath = getProjectInstructionFilePath(
      dir,
      path => existingPaths.has(path),
    )

    expect(filePath).toBe(join(dir, PRIMARY_PROJECT_INSTRUCTION_FILE))
  })

  test('returns the AGENTS.md candidate path even when absent', () => {
    const dir = '/repo'

    const filePath = getProjectInstructionFilePath(dir, () => false)

    expect(filePath).toBe(join(dir, PRIMARY_PROJECT_INSTRUCTION_FILE))
  })

  test('returns the root instruction path list', () => {
    const dir = '/repo'

    expect(getProjectInstructionFilePaths(dir)).toEqual([
      join(dir, PRIMARY_PROJECT_INSTRUCTION_FILE),
    ])
  })

  test('detects whether a repo instruction file exists', () => {
    const dir = '/repo'
    const existingPaths = new Set([join(dir, PRIMARY_PROJECT_INSTRUCTION_FILE)])

    expect(hasProjectInstructionFile(dir, path => existingPaths.has(path))).toBe(
      true,
    )
    expect(hasProjectInstructionFile(dir, () => false)).toBe(false)
  })

  test('recognizes AGENTS.md as a root instruction filename', () => {
    expect(isProjectInstructionFileName(PRIMARY_PROJECT_INSTRUCTION_FILE)).toBe(
      true,
    )
    expect(isProjectInstructionFileName('README.md')).toBe(false)
  })

  test('finds repo instructions in ancestor directories', () => {
    const repoDir = '/repo'
    const nestedDir = join(repoDir, 'packages', 'app')
    const existingPaths = new Set([join(repoDir, PRIMARY_PROJECT_INSTRUCTION_FILE)])

    expect(
      findProjectInstructionFilePathInAncestors(
        nestedDir,
        path => existingPaths.has(path),
      ),
    ).toBe(join(repoDir, PRIMARY_PROJECT_INSTRUCTION_FILE))
  })

  test('prefers the closest ancestor project instruction file', () => {
    const repoDir = '/repo'
    const nestedProjectDir = join(repoDir, 'packages', 'app')
    const existingPaths = new Set([
      join(repoDir, PRIMARY_PROJECT_INSTRUCTION_FILE),
      join(nestedProjectDir, PRIMARY_PROJECT_INSTRUCTION_FILE),
    ])

    expect(
      findProjectInstructionFilePathInAncestors(
        join(nestedProjectDir, 'src'),
        path => existingPaths.has(path),
      ),
    ).toBe(join(nestedProjectDir, PRIMARY_PROJECT_INSTRUCTION_FILE))
  })

  test('returns null when no ancestor repo instruction file exists', () => {
    expect(
      findProjectInstructionFilePathInAncestors('/repo/packages/app', () => false),
    ).toBeNull()
  })
})
