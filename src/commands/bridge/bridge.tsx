// NYX: bridge deleted, stubbed
import type * as React from 'react'
import type { ToolUseContext } from '../../Tool.js'
import type { LocalJSXCommandContext, LocalJSXCommandOnDone } from '../../types/command.js'

export async function call(
  onDone: LocalJSXCommandOnDone,
  _context: ToolUseContext & LocalJSXCommandContext,
  _args: string,
): Promise<React.ReactNode> {
  onDone('Remote Control is not available in this build.')
  return null
}
