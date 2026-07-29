// Interactive REPL prompts run with no turn cap by default. An explicit
// maxTurns prop (from --max-turns, SDK, agent definition, or session resume)
// still overrides and re-enables the cap; query.ts treats undefined as
// "no limit" via `maxTurns ?? Infinity`.
export function resolveReplMaxTurns(maxTurns?: number): number | undefined {
  return maxTurns
}
