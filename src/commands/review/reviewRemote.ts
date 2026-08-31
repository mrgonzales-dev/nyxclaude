// ponytail: Remote review removed — Anthropic subscription feature.
export function confirmOverage(): void {}
export type OverageGate = { kind: 'not-enabled' }
export async function checkOverageGate(): Promise<OverageGate> {
  return { kind: 'not-enabled' }
}
export async function launchRemoteReview(_args: string, _context: unknown, _billingNote?: string): Promise<null> {
  return null
}
