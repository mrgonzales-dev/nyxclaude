import React, { useEffect } from 'react'
import { Box, Text } from '../ink.js'

// NYXCLAUDE: OAuth removed — API key only. This component is kept as a no-op
// stub so Onboarding and TeleportError imports don't break. It immediately
// calls onDone, skipping the OAuth flow entirely.

export type ConsoleOAuthFlowResult = {
  type: 'api_key'
  apiKey: string
}

export function ConsoleOAuthFlow({
  onDone,
}: {
  onDone: (result?: ConsoleOAuthFlowResult) => void
  mode?: string
  forceLoginMethod?: string
}): React.ReactNode {
  useEffect(() => {
    onDone()
  }, [onDone])
  return (
    <Box>
      <Text>OAuth disabled — use /provider to configure an API key.</Text>
    </Box>
  )
}
