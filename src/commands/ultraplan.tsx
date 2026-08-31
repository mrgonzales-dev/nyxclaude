// ponytail: Ultraplan command removed — feature flag ULTRAPLAN is false.
import type { Command } from '../commands.js'

export const CCR_TERMS_URL = ''
export function buildUltraplanPrompt(_blurb: string, _seedPlan?: string): string { return '' }
export async function stopUltraplan(_taskId: string, _sessionId: string, _setAppState: unknown): Promise<void> {}
export async function launchUltraplan(_opts: unknown): Promise<void> {}

const ultraplan: Command = {
  type: 'local-jsx',
  name: 'ultraplan',
  aliases: ['up'],
  description: 'Ultraplan (disabled — feature not available)',
  isEnabled: () => false,
  isHidden: true,
  load: async () => ({ default: () => null }),
} satisfies Command

export default ultraplan
