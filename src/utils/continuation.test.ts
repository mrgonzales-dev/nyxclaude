import { describe, expect, test } from 'vitest'
import {
  analyzeContinuationIntent,
  isInconclusiveEndTurnText,
} from './continuation.js'

describe('isInconclusiveEndTurnText', () => {
  test('transitional prose without markers is inconclusive', () => {
    expect(isInconclusiveEndTurnText('Moving on to the executor in src/app/exec.go')).toBe(true)
    expect(isInconclusiveEndTurnText('The next file handles parsing.')).toBe(true)
    expect(isInconclusiveEndTurnText('Here is the result.')).toBe(true)
  })

  test('empty and whitespace-only text is inconclusive', () => {
    expect(isInconclusiveEndTurnText('')).toBe(true)
    expect(isInconclusiveEndTurnText('   \n  ')).toBe(true)
  })

  test('text ending with a question for the user is conclusive', () => {
    expect(isInconclusiveEndTurnText('Which file should I modify?')).toBe(false)
    expect(isInconclusiveEndTurnText('Does this look right so far?  ')).toBe(false)
  })

  test('completion markers in the last 120 chars are conclusive', () => {
    expect(isInconclusiveEndTurnText('The task is complete.')).toBe(false)
    expect(isInconclusiveEndTurnText('All set, let me know if you need changes.')).toBe(false)
    expect(isInconclusiveEndTurnText('I am done.')).toBe(false)
  })

  test('marker words early in a long text do not make it conclusive', () => {
    const tail = 'transitional prose continues ' + 'x'.repeat(150)
    expect(isInconclusiveEndTurnText(`The download is complete. ${tail}`)).toBe(true)
  })

  test('explicit done-declarations buried in a long tail are conclusive', () => {
    const filler = `status table ${'x'.repeat(300)}`
    expect(isInconclusiveEndTurnText(`The task is finished. ${filler}`)).toBe(false)
    expect(isInconclusiveEndTurnText(`This work has been completed. ${filler}`)).toBe(false)
    expect(isInconclusiveEndTurnText(`Nothing else remains to do. ${filler}`)).toBe(false)
  })

  test('a trailing user-choice menu is conclusive', () => {
    expect(
      isInconclusiveEndTurnText(
        'The revert is complete and verified. To move forward, pick one: 1. Restore the backups. 2. Design a new guard. 3. Leave both files as they are now.',
      ),
    ).toBe(false)
    expect(
      isInconclusiveEndTurnText(
        'Both files match the target commit. Choose an option below.',
      ),
    ).toBe(false)
  })

  test('descriptive uses of finality-adjacent phrasing are inconclusive', () => {
    expect(
      isInconclusiveEndTurnText('The changes are completely untested so far.'),
    ).toBe(true)
    expect(
      isInconclusiveEndTurnText('The queue has nothing left after this batch.'),
    ).toBe(true)
    expect(
      isInconclusiveEndTurnText('The server is awaiting input on stdin.'),
    ).toBe(true)
    expect(
      isInconclusiveEndTurnText('git status shows no pending changes in the tree.'),
    ).toBe(true)
  })

  test('self-directed pick-one mid-work is still inconclusive', () => {
    expect(
      isInconclusiveEndTurnText("I'll pick one and go with the executor refactor."),
    ).toBe(true)
    expect(
      isInconclusiveEndTurnText('Step 4: pick one of the targets and process it.'),
    ).toBe(true)
  })

  test('descriptive let-me-know with the model as recipient is inconclusive', () => {
    expect(
      isInconclusiveEndTurnText(
        'The test output will let me know which cases failed. Parsing the log comes after.',
      ),
    ).toBe(true)
  })

  test('the observed nudge-loop transcript shape is conclusive', () => {
    const transcript =
      'Both DTR edit blades equal 26bfda6b3 byte-for-byte. ' +
      'Technical: git diff returns empty, proving the working tree matches the pre-guard commit. ' +
      'Layman: Your change is done. ' +
      'To move forward, pick one: 1. Restore the guarded version from the /tmp backups. ' +
      '2. Design a new guard (tell me where it should sit — before input, after input, or both). ' +
      '3. Leave both files as they are now.'
    expect(isInconclusiveEndTurnText(transcript)).toBe(false)
    // The finality fix is dead code if the continuation analyzer nudges
    // first — it runs upstream of isInconclusiveEndTurnText in query.ts.
    expect(analyzeContinuationIntent(transcript).shouldNudge).toBe(false)
  })
})
