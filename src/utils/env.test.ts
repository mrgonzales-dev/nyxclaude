import { afterEach, beforeEach, expect, test } from 'bun:test'
import { mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import {
  acquireSharedMutationLock,
  releaseSharedMutationLock,
} from '../test/sharedMutationLock.js'

const originalEnv = {
  NYXCLAUDE_CONFIG_DIR: process.env.NYXCLAUDE_CONFIG_DIR,
  CLAUDE_CONFIG_DIR: process.env.CLAUDE_CONFIG_DIR,
  CLAUDE_CODE_CUSTOM_OAUTH_URL: process.env.CLAUDE_CODE_CUSTOM_OAUTH_URL,
  USER_TYPE: process.env.USER_TYPE,
}

let tempDir: string

beforeEach(async () => {
  await acquireSharedMutationLock('env.test.ts')
  tempDir = mkdtempSync(join(tmpdir(), 'nyxclaude-env-test-'))
  process.env.NYXCLAUDE_CONFIG_DIR = tempDir
  delete process.env.CLAUDE_CONFIG_DIR
  delete process.env.CLAUDE_CODE_CUSTOM_OAUTH_URL
  delete process.env.USER_TYPE
})

afterEach(() => {
  try {
    rmSync(tempDir, { recursive: true, force: true })
    if (originalEnv.NYXCLAUDE_CONFIG_DIR === undefined) {
      delete process.env.NYXCLAUDE_CONFIG_DIR
    } else {
      process.env.NYXCLAUDE_CONFIG_DIR = originalEnv.NYXCLAUDE_CONFIG_DIR
    }
    if (originalEnv.CLAUDE_CONFIG_DIR === undefined) {
      delete process.env.CLAUDE_CONFIG_DIR
    } else {
      process.env.CLAUDE_CONFIG_DIR = originalEnv.CLAUDE_CONFIG_DIR
    }
    if (originalEnv.CLAUDE_CODE_CUSTOM_OAUTH_URL === undefined) {
      delete process.env.CLAUDE_CODE_CUSTOM_OAUTH_URL
    } else {
      process.env.CLAUDE_CODE_CUSTOM_OAUTH_URL = originalEnv.CLAUDE_CODE_CUSTOM_OAUTH_URL
    }
    if (originalEnv.USER_TYPE === undefined) {
      delete process.env.USER_TYPE
    } else {
      process.env.USER_TYPE = originalEnv.USER_TYPE
    }
  } finally {
    releaseSharedMutationLock()
  }
})

async function importFreshEnvModule() {
  return import(`./env.js?ts=${Date.now()}-${Math.random()}`)
}

// getGlobalClaudeFile — default path plus explicit override compatibility

test('getGlobalClaudeFile: new install returns .nyxclaude.json when neither file exists', async () => {
  const { getGlobalClaudeFile } = await importFreshEnvModule()
  expect(getGlobalClaudeFile()).toBe(join(tempDir, '.nyxclaude.json'))
})

test('getGlobalClaudeFile: ignores .claude.json when only legacy file exists', async () => {
  writeFileSync(join(tempDir, '.claude.json'), '{}')
  const { getGlobalClaudeFile } = await importFreshEnvModule()
  expect(getGlobalClaudeFile()).toBe(join(tempDir, '.nyxclaude.json'))
})

test('getGlobalClaudeFile: migrated user uses .nyxclaude.json when both files exist', async () => {
  writeFileSync(join(tempDir, '.claude.json'), '{}')
  writeFileSync(join(tempDir, '.nyxclaude.json'), '{}')
  const { getGlobalClaudeFile } = await importFreshEnvModule()
  expect(getGlobalClaudeFile()).toBe(join(tempDir, '.nyxclaude.json'))
})

test('getGlobalClaudeFile: NYXCLAUDE_CONFIG_DIR uses preferred config dir', async () => {
  const preferredDir = mkdtempSync(join(tmpdir(), 'nyxclaude-preferred-env-test-'))
  try {
    process.env.NYXCLAUDE_CONFIG_DIR = preferredDir
    process.env.CLAUDE_CONFIG_DIR = tempDir

    const { getGlobalClaudeFile } = await importFreshEnvModule()

    expect(getGlobalClaudeFile()).toBe(join(preferredDir, '.nyxclaude.json'))
  } finally {
    rmSync(preferredDir, { recursive: true, force: true })
  }
})

test('getGlobalClaudeFile: NYXCLAUDE_CONFIG_DIR ignores .claude.json fallback when only legacy file exists', async () => {
  const preferredDir = mkdtempSync(join(tmpdir(), 'nyxclaude-preferred-env-test-'))
  try {
    process.env.NYXCLAUDE_CONFIG_DIR = preferredDir
    process.env.CLAUDE_CONFIG_DIR = tempDir
    writeFileSync(join(preferredDir, '.claude.json'), '{}')

    const { getGlobalClaudeFile } = await importFreshEnvModule()

    expect(getGlobalClaudeFile()).toBe(join(preferredDir, '.nyxclaude.json'))
  } finally {
    rmSync(preferredDir, { recursive: true, force: true })
  }
})

test('resolveGlobalClaudeFile: ignores legacy file even when new file is missing', async () => {
  writeFileSync(join(tempDir, '.claude.json'), '{}')
  const { resolveGlobalClaudeFile } = await importFreshEnvModule()

  expect(
    resolveGlobalClaudeFile({
      homeDir: tempDir,
    }),
  ).toBe(join(tempDir, '.nyxclaude.json'))
})

test('env.terminal: returns agy if process.env.TERM_PROGRAM is agy', async () => {
  const originalTermProgram = process.env.TERM_PROGRAM
  const originalAskpass = process.env.VSCODE_GIT_ASKPASS_MAIN
  try {
    process.env.TERM_PROGRAM = 'agy'
    delete process.env.VSCODE_GIT_ASKPASS_MAIN
    const { env } = await importFreshEnvModule()
    expect(env.terminal).toBe('agy')
  } finally {
    if (originalTermProgram === undefined) {
      delete process.env.TERM_PROGRAM
    } else {
      process.env.TERM_PROGRAM = originalTermProgram
    }
    if (originalAskpass === undefined) {
      delete process.env.VSCODE_GIT_ASKPASS_MAIN
    } else {
      process.env.VSCODE_GIT_ASKPASS_MAIN = originalAskpass
    }
  }
})

test('env.terminal: returns agy if VSCODE_GIT_ASKPASS_MAIN contains agy', async () => {
  const originalTermProgram = process.env.TERM_PROGRAM
  const originalAskpass = process.env.VSCODE_GIT_ASKPASS_MAIN
  try {
    delete process.env.TERM_PROGRAM
    process.env.VSCODE_GIT_ASKPASS_MAIN = 'path/to/agy'
    const { env } = await importFreshEnvModule()
    expect(env.terminal).toBe('agy')
  } finally {
    if (originalTermProgram === undefined) {
      delete process.env.TERM_PROGRAM
    } else {
      process.env.TERM_PROGRAM = originalTermProgram
    }
    if (originalAskpass === undefined) {
      delete process.env.VSCODE_GIT_ASKPASS_MAIN
    } else {
      process.env.VSCODE_GIT_ASKPASS_MAIN = originalAskpass
    }
  }
})

test('env.terminal: returns agy if VSCODE_GIT_ASKPASS_MAIN contains antigravity', async () => {
  const originalTermProgram = process.env.TERM_PROGRAM
  const originalAskpass = process.env.VSCODE_GIT_ASKPASS_MAIN
  try {
    delete process.env.TERM_PROGRAM
    process.env.VSCODE_GIT_ASKPASS_MAIN = 'path/to/antigravity'
    const { env } = await importFreshEnvModule()
    expect(env.terminal).toBe('agy')
  } finally {
    if (originalTermProgram === undefined) {
      delete process.env.TERM_PROGRAM
    } else {
      process.env.TERM_PROGRAM = originalTermProgram
    }
    if (originalAskpass === undefined) {
      delete process.env.VSCODE_GIT_ASKPASS_MAIN
    } else {
      process.env.VSCODE_GIT_ASKPASS_MAIN = originalAskpass
    }
  }
})

test('env.terminal: returns agy if VSCODE_GIT_ASKPASS_MAIN contains mixed-case Antigravity app path', async () => {
  const originalTermProgram = process.env.TERM_PROGRAM
  const originalAskpass = process.env.VSCODE_GIT_ASKPASS_MAIN
  try {
    delete process.env.TERM_PROGRAM
    process.env.VSCODE_GIT_ASKPASS_MAIN =
      '/Applications/Antigravity.app/Contents/Resources/app/extensions/git/dist/askpass-main.js'
    const { env } = await importFreshEnvModule()
    expect(env.terminal).toBe('agy')
  } finally {
    if (originalTermProgram === undefined) {
      delete process.env.TERM_PROGRAM
    } else {
      process.env.TERM_PROGRAM = originalTermProgram
    }
    if (originalAskpass === undefined) {
      delete process.env.VSCODE_GIT_ASKPASS_MAIN
    } else {
      process.env.VSCODE_GIT_ASKPASS_MAIN = originalAskpass
    }
  }
})

test('env.terminal: agy is classified as a VS Code-like IDE terminal', async () => {
  const originalTermProgram = process.env.TERM_PROGRAM
  const originalAskpass = process.env.VSCODE_GIT_ASKPASS_MAIN
  try {
    process.env.TERM_PROGRAM = 'agy'
    delete process.env.VSCODE_GIT_ASKPASS_MAIN
    const { env } = await importFreshEnvModule()
    const { isVSCodeIde, toIDEDisplayName } =
      await import(`./ide.js?ts=${Date.now()}-${Math.random()}`)
    expect(env.terminal).toBe('agy')
    expect(toIDEDisplayName(env.terminal)).toBe('Antigravity')
    expect(isVSCodeIde(env.terminal)).toBe(true)
  } finally {
    if (originalTermProgram === undefined) {
      delete process.env.TERM_PROGRAM
    } else {
      process.env.TERM_PROGRAM = originalTermProgram
    }
    if (originalAskpass === undefined) {
      delete process.env.VSCODE_GIT_ASKPASS_MAIN
    } else {
      process.env.VSCODE_GIT_ASKPASS_MAIN = originalAskpass
    }
  }
})
