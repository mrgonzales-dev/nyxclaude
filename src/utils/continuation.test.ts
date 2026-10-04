import { describe, expect, test } from 'vitest'
import { isInconclusiveEndTurnText } from './continuation.js'

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
})
