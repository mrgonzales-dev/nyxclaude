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

  test('imperative confirmation requests are conclusive', () => {
    // The reported incident: "Confirm and I'll write it." was judged a stall,
    // the hidden "continue" nudge overrode the model's own confirmation gate.
    expect(isInconclusiveEndTurnText("Confirm and I'll write it.")).toBe(false)
    expect(isInconclusiveEndTurnText('Once you confirm, I will apply the migration.')).toBe(false)
    expect(isInconclusiveEndTurnText('Once confirmed, I\'ll proceed.')).toBe(false)
    expect(isInconclusiveEndTurnText("I'll start once you approve.")).toBe(false)
    expect(isInconclusiveEndTurnText('Awaiting your approval.')).toBe(false)
    expect(isInconclusiveEndTurnText('I need your confirmation first.')).toBe(false)
    expect(isInconclusiveEndTurnText('Say the word and I will proceed.')).toBe(false)
    expect(isInconclusiveEndTurnText('Say yes to proceed.')).toBe(false)
    expect(isInconclusiveEndTurnText('Give me the go-ahead.')).toBe(false)
    expect(isInconclusiveEndTurnText('Want me to proceed with option 1.')).toBe(false)
    expect(isInconclusiveEndTurnText('Shall I merge the branches.')).toBe(false)
    expect(isInconclusiveEndTurnText("Reply with 'yes' to confirm.")).toBe(false)
    expect(isInconclusiveEndTurnText("Let me know when you're ready.")).toBe(false)
  })

  test('awaiting/waiting-for handoffs are conclusive', () => {
    // The reported duplication incident: the model ended turns with
    // "Awaiting your review." / "Awaiting your directive." — the handoff
    // list only covered instructions/input, so each ending was judged a
    // stall and the hidden "continue" nudge produced a duplicate answer.
    expect(isInconclusiveEndTurnText('Awaiting your review.')).toBe(false)
    expect(isInconclusiveEndTurnText('Awaiting your feedback.')).toBe(false)
    expect(isInconclusiveEndTurnText('Awaiting your directive.')).toBe(false)
    expect(isInconclusiveEndTurnText('Awaiting your call.')).toBe(false)
    expect(isInconclusiveEndTurnText('Awaiting your reply.')).toBe(false)
    expect(isInconclusiveEndTurnText('Waiting on your go-ahead.')).toBe(false)
    expect(isInconclusiveEndTurnText('Waiting for your review.')).toBe(false)
    // Handoff clause preceding a transition word must still win — the
    // continuation analyzer sees "proceeding to the next step" in the tail.
    expect(
      isInconclusiveEndTurnText(
        'The task is finished. Commit 8884df8 is pushed to master. The migration file contents are above for your review — awaiting your feedback before proceeding to the next step.',
      ),
    ).toBe(false)
    expect(
      analyzeContinuationIntent(
        'the task is finished. commit 8884df8 is pushed to master. the migration file contents are above for your review — awaiting your feedback before proceeding to the next step.',
      ).shouldNudge,
    ).toBe(false)
  })

  test('self-directed confirm narration mid-work is still inconclusive', () => {
    // Past-tense/modal "confirmed ... I'll" is work narration declaring
    // intent — exactly the stall shape the nudge exists to rescue.
    expect(
      isInconclusiveEndTurnText("To confirm the schema I'll rerun the query."),
    ).toBe(true)
    expect(isInconclusiveEndTurnText("I'll confirm the diff is clean.")).toBe(true)
    expect(
      isInconclusiveEndTurnText(
        "I've confirmed the schema is valid, and I'll write the migration next.",
      ),
    ).toBe(true)
    expect(
      isInconclusiveEndTurnText(
        "I can confirm the tests pass, and I'll fix the remaining two.",
      ),
    ).toBe(true)
    expect(
      isInconclusiveEndTurnText("Confirmed the diagnosis — I'll continue with the next file."),
    ).toBe(true)
    expect(
      isInconclusiveEndTurnText("I'll confirm the diff is clean, then I'll proceed."),
    ).toBe(true)
  })

  test('descriptive say-when/say-yes text is still inconclusive', () => {
    expect(
      isInconclusiveEndTurnText('The docs say when retries happen.'),
    ).toBe(true)
    expect(
      isInconclusiveEndTurnText('The script will say yes to all prompts.'),
    ).toBe(true)
  })

  test('exact echo of the synthetic tool-results placeholder is conclusive', () => {
    // Some models parrot the shim's '[Tool results received]' alternation
    // filler. An exact echo is harness noise — end the turn rather than
    // nudging it into work.
    expect(isInconclusiveEndTurnText('[Tool results received]')).toBe(false)
    expect(isInconclusiveEndTurnText('  [Tool results received]\n')).toBe(false)
    expect(isInconclusiveEndTurnText('[Tool results received].')).toBe(false)
  })
})

describe('analyzeContinuationIntent', () => {
  test('confirmation requests never nudge, even without terminal punctuation', () => {
    // Without a final '.', "i'll write" matches a continuation signal — the
    // handoff tail must override it.
    expect(analyzeContinuationIntent("Confirm and I'll write it").shouldNudge).toBe(false)
    expect(analyzeContinuationIntent("Say the word and I'll start writing").shouldNudge).toBe(false)
    expect(analyzeContinuationIntent('Awaiting your approval').shouldNudge).toBe(false)
  })

  test('truncated handoff text still nudges as possible truncation', () => {
    // Structural cut-off wins over the handoff tail — the model was cut off.
    expect(
      analyzeContinuationIntent("Confirm and I'll write it, starting with").shouldNudge,
    ).toBe(true)
  })

  test('plain transitional text still nudges', () => {
    expect(analyzeContinuationIntent('Now creating the migration').shouldNudge).toBe(true)
    expect(analyzeContinuationIntent('Next I will apply the changes').shouldNudge).toBe(true)
  })
})
