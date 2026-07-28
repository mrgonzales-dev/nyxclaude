// NYXCLAUDE: Chrome integration removed — stubbed.
import type * as React from 'react';

export type ChromeToolName = string

export function renderChromeToolResultMessage(
  _output: unknown,
  _toolName: ChromeToolName,
  _verbose: boolean,
): React.ReactNode {
  return null
}

export function getClaudeInChromeMCPToolOverrides(_toolName: string): {
  suppressToolUseMessage: boolean
  suppressToolResultMessage: boolean
} {
  return { suppressToolUseMessage: false, suppressToolResultMessage: false }
}
