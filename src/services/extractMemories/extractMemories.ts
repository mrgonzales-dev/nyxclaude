// NYXCLAUDE: Memory system removed — stub for backward compat.
import type { ToolUseContext } from '../../Tool.js'
import type { Message } from '../../types/message.js'

export function createAutoMemCanUseTool(_context: ToolUseContext) {
  return async function _noopCanUseTool(): Promise<Message[]> {
    return []
  }
}
