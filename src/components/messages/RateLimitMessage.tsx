// ponytail: Rate limit message removed — Anthropic subscription feature.
import * as React from 'react'
import { Text } from '../../ink.js'
export function getUpsellMessage(_opts: unknown): string | null { return null }
export function RateLimitMessage(_props: { text?: string; onOpenRateLimitOptions?: () => void }): React.ReactNode {
  return <Text dimColor>Rate limit reached. Wait and try again.</Text>
}
