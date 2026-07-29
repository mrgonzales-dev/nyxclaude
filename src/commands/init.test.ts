import { afterEach, beforeEach, expect, mock, test } from 'bun:test'
import {
  acquireSharedMutationLock,
  releaseSharedMutationLock,
} from '../test/sharedMutationLock.js'

const originalClaudeCodeNewInit = process.env.CLAUDE_CODE_NEW_INIT

async function importInitCommand() {
  return (await import(`./init.ts?ts=${Date.now()}-${Math.random()}`)).default
}

beforeEach(async () => {
  await acquireSharedMutationLock('commands/init.test.ts')
})

afterEach(() => {
  try {
    mock.restore()

    if (originalClaudeCodeNewInit === undefined) {
      delete process.env.CLAUDE_CODE_NEW_INIT
    } else {
      process.env.CLAUDE_CODE_NEW_INIT = originalClaudeCodeNewInit
    }
  } finally {
    releaseSharedMutationLock()
  }
})

test('NEW_INIT prompt updates existing root AGENTS.md by default', async () => {
  process.env.CLAUDE_CODE_NEW_INIT = '1'

  mock.module('../projectOnboardingState.js', () => ({
    maybeMarkProjectOnboardingComplete: () => {},
  }))
  mock.module('./initMode.js', () => ({
    isNewInitEnabled: () => true,
  }))

  const command = await importInitCommand()
  const blocks = await command.getPromptForCommand()

  expect(blocks).toHaveLength(1)
  expect(blocks[0]?.type).toBe('text')
  expect(String(blocks[0]?.text)).toContain(
    'update the existing root `AGENTS.md` in place by default',
  )
})
