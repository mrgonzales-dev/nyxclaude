// ponytail: Usage settings panel removed — Anthropic subscription UI.
// All underlying services (utilization, extra usage, overage, clinepass, codex)
// are stubbed. This panel would show nothing useful.
import * as React from 'react'
import { Text } from '../../ink.js'
export function Usage(): React.ReactNode {
  return <Text dimColor>Usage tracking not available. Set ANTHROPIC_API_KEY to use the API.</Text>
}
