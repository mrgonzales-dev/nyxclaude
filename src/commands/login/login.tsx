// NYXCLAUDE: OAuth login removed — API key only. Stub for backward compat.
import * as React from 'react'
import { Text } from '../../ink.js'
import type { LocalJSXCommandContext } from '../../commands.js'
import type { LocalJSXCommandOnDone } from '../../types/command.js'

export function Login(_props: {
  context: LocalJSXCommandContext
  onDone: LocalJSXCommandOnDone
}): React.ReactNode {
  return React.createElement(Text, null, 'OAuth disabled — use /provider to configure an API key.')
}

export default Login
