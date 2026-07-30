import type { ToolResultBlockParam } from '@anthropic-ai/sdk/resources/index.mjs'
import * as React from 'react'
import { FallbackToolUseErrorMessage } from '../../components/FallbackToolUseErrorMessage.js'
import { MessageResponse } from '../../components/MessageResponse.js'
import { Text } from '../../ink.js'
import type { ProgressMessage } from '../../types/message.js'
import type { AgentToolProgress } from '../../types/tools.js'
import type { Theme } from '../../utils/theme.js'
import type { AgentToolResult } from './agentToolUtils.js'

type AgentToolInput = {
  description?: string
  prompt?: string
  subagent_type?: string
  model?: string
  run_in_background?: boolean
}

export function userFacingName(
  input: Partial<AgentToolInput> | undefined,
): string {
  if (input?.subagent_type) {
    return input.subagent_type
  }
  return 'Agent'
}

export function userFacingNameBackgroundColor(
  _input: Partial<AgentToolInput> | undefined,
): keyof Theme | undefined {
  return undefined
}

export function renderToolUseMessage(
  input: Partial<AgentToolInput>,
  _options: { verbose: boolean },
): React.ReactNode {
  if (!input?.description) {
    return null
  }
  return input.description
}

export function renderToolUseTag(
  _input: Partial<AgentToolInput>,
): React.ReactNode {
  return null
}

export function renderToolUseProgressMessage(
  progressMessagesForMessage: ProgressMessage<AgentToolProgress>[],
  _options: {
    tools: unknown
    verbose: boolean
    terminalSize?: { columns: number; rows: number }
    inProgressToolCallCount?: number
    isTranscriptMode?: boolean
  },
): React.ReactNode {
  const lastProgress = progressMessagesForMessage.at(-1)
  if (!lastProgress?.data) {
    return (
      <MessageResponse height={1}>
        <Text dimColor>Running…</Text>
      </MessageResponse>
    )
  }
  const data = lastProgress.data as Record<string, unknown>
  const activity =
    typeof data === 'object' && data !== null && 'activity' in data
      ? (data.activity as string | undefined)
      : undefined
  return (
    <MessageResponse height={1}>
      <Text dimColor>{activity ?? 'Working…'}</Text>
    </MessageResponse>
  )
}

export function renderToolResultMessage(
  content: any,
  _progressMessagesForMessage: ProgressMessage<AgentToolProgress>[],
  options: {
    style?: 'condensed'
    theme: string
    tools: unknown
    verbose: boolean
    isTranscriptMode?: boolean
    isBriefOnly?: boolean
    input?: unknown
  },
): React.ReactNode {
  const { verbose } = options

  // For async-launched agents
  if (content.status === 'async_launched') {
    return (
      <MessageResponse height={1}>
        <Text dimColor>Agent running in background</Text>
      </MessageResponse>
    )
  }

  // For completed agents
  const textContent = content.content
    ?.filter(c => c.type === 'text')
    .map(c => c.text)
    .join('\n')

  if (!textContent) {
    return (
      <MessageResponse height={1}>
        <Text dimColor>Agent completed</Text>
      </MessageResponse>
    )
  }

  if (verbose) {
    return <Text>{textContent}</Text>
  }

  // Non-verbose: show first line or truncated
  const firstLine = textContent.split('\n')[0]
  const truncated =
    firstLine.length > 200 ? firstLine.slice(0, 200) + '…' : firstLine
  return (
    <MessageResponse>
      <Text>{truncated}</Text>
    </MessageResponse>
  )
}

export function renderToolUseRejectedMessage(
  _input: AgentToolInput,
  _options: {
    columns: number
    messages: unknown[]
    style?: 'condensed'
    theme: string
    tools: unknown
    verbose: boolean
    progressMessagesForMessage: ProgressMessage<AgentToolProgress>[]
    isTranscriptMode?: boolean
  },
): React.ReactNode {
  return (
    <MessageResponse height={1}>
      <Text color="red">Agent task rejected</Text>
    </MessageResponse>
  )
}

export function renderToolUseErrorMessage(
  result: ToolResultBlockParam['content'],
  options: {
    progressMessagesForMessage: ProgressMessage<AgentToolProgress>[]
    tools: unknown
    verbose: boolean
  },
): React.ReactNode {
  return (
    <FallbackToolUseErrorMessage result={result} verbose={options.verbose} />
  )
}
