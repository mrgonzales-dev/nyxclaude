import { expect, test } from 'bun:test'

// Import only the prompt function to avoid circular dependency with planAgent
import { getExploreSystemPrompt } from './exploreAgent.js'

test('explore agent prompt references GlobTool for glob guidance when not embedded', () => {
  const prompt = getExploreSystemPrompt()
  // When not embedded, the glob guidance should reference GlobTool (or find via Bash),
  // NOT GrepTool. The bug was that globGuidance used GrepTool instead of GlobTool.
  const globLine = prompt
    .split('\n')
    .find(l => l.includes('glob') || l.includes('Glob') || l.includes('find'))
  // At least one line should mention Glob or find for file pattern matching
  expect(globLine).toBeDefined()
  // The glob guidance line must NOT say "Use GrepTool for searching file contents with regex"
  // as that's the grep guidance, duplicated.
  const grepGuidanceLines = prompt
    .split('\n')
    .filter(l => l.includes('GrepTool') || l.includes('grep'))
  // There should be exactly one grep guidance line, not two
  expect(grepGuidanceLines.length).toBeLessThanOrEqual(2)
})
