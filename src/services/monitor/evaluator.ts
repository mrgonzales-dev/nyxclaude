import { queryWithModel } from '../api/claude.js'
import type { BetaJSONOutputFormat } from '@anthropic-ai/sdk/resources/beta/messages/messages.mjs'
import { asSystemPrompt, type SystemPrompt } from '../../utils/systemPromptType.js'
import type { Task } from '../../utils/tasks.js'

// -- types -----------------------------------------------------------------

export type MonitorDecision = {
  valid_stop: boolean
  reason: string
  incomplete_task_ids: string[]
  next_instruction: string | null
}

export type MonitorModelRequest = {
  systemPrompt: SystemPrompt
  userPrompt: string
  signal: AbortSignal
  isNonInteractiveSession: boolean
  model: string
}

export type MonitorModelCaller = (request: MonitorModelRequest) => Promise<string>

// -- prompt ----------------------------------------------------------------

const MONITOR_SYSTEM_PROMPT = `You are a monitor. Your sole existence is to verify whether a coding agent's decision to stop is valid.

The agent has just announced it is finished with its task. You must independently verify this by checking:
1. The task list — are there any tasks still pending or in_progress?
2. The recent conversation — did the agent actually complete the work it claimed, or did it stop prematurely?

You are NOT the agent. You do not perform work. You only judge whether the stop is justified.

Return strict JSON only:
{
  "valid_stop": boolean,
  "reason": string,
  "incomplete_task_ids": string[],
  "next_instruction": string | null
}

Rules:
- "valid_stop": true only if every task in the task list is "completed" AND the recent conversation shows the work was actually finished (e.g. tests run, files written, build verified).
- "valid_stop": false if any task is still "pending" or "in_progress", OR if the agent clearly stopped before finishing claimed work.
- "incomplete_task_ids": list the IDs of tasks that are not completed. Empty array if all are done.
- "reason": concise justification for your verdict.
- "next_instruction": if the stop is invalid, a short directive telling the agent what to do next. null if the stop is valid.
- Do not ask questions. Do not speculate. Base your verdict only on the provided task list and conversation.`

const MONITOR_OUTPUT_FORMAT: BetaJSONOutputFormat = {
  type: 'json_schema',
  schema: {
    type: 'object',
    properties: {
      valid_stop: { type: 'boolean' },
      reason: { type: 'string' },
      incomplete_task_ids: {
        type: 'array',
        items: { type: 'string' },
      },
      next_instruction: {
        anyOf: [{ type: 'string' }, { type: 'null' }],
      },
    },
    required: [
      'valid_stop',
      'reason',
      'incomplete_task_ids',
      'next_instruction',
    ],
    additionalProperties: false,
  },
}

// -- context formatting ----------------------------------------------------

const MAX_CONTEXT_CHARS = 12_000
const MAX_PROMPT_CHARS = 16_000
const MAX_MESSAGE_CHARS = 1_200
const RECENT_MESSAGE_LIMIT = 20

function truncateText(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text
  return text.slice(0, maxChars - 15).trimEnd() + '... [truncated]'
}

function contentToText(content: unknown): string {
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return ''

  const parts: string[] = []
  for (const block of content) {
    if (!block || typeof block !== 'object') continue
    const record = block as Record<string, unknown>
    if (record.type === 'text' && typeof record.text === 'string') {
      parts.push(record.text)
    } else if (record.type === 'tool_result') {
      const raw = record.content
      const text =
        typeof raw === 'string'
          ? raw
          : Array.isArray(raw)
            ? raw
                .map(item =>
                  item &&
                  typeof item === 'object' &&
                  (item as Record<string, unknown>).type === 'text' &&
                    typeof (item as Record<string, unknown>).text === 'string'
                    ? ((item as Record<string, unknown>).text as string)
                    : '',
                )
                .filter(Boolean)
                .join('\n')
            : ''
      if (text) parts.push(`Tool result: ${text}`)
    } else if (record.type === 'tool_use' && typeof record.name === 'string') {
      parts.push(`Tool use: ${record.name}`)
    }
  }
  return parts.join('\n')
}

function messageRole(message: Record<string, unknown>): string | null {
  if (message.type === 'assistant') return 'assistant'
  if (message.type === 'user') return 'user'
  if (message.type === 'system' && message.subtype === 'local_command') {
    return 'local-command'
  }
  if (message.type === 'tool_use_summary') return 'tool-summary'
  return null
}

function messageText(message: Record<string, unknown>): string {
  if (message.type === 'system' && typeof message.content === 'string') {
    return message.content
  }
  if (
    message.type === 'tool_use_summary' &&
    typeof message.summary === 'string'
  ) {
    return message.summary
  }
  const nested = message.message
  if (!nested || typeof nested !== 'object') return ''
  return contentToText((nested as Record<string, unknown>).content)
}

function recentContext(messages: unknown[]): string {
  const lines: string[] = []
  let total = 0
  const recent = messages.slice(-RECENT_MESSAGE_LIMIT).reverse()

  for (const item of recent) {
    if (!item || typeof item !== 'object') continue
    const record = item as Record<string, unknown>
    const role = messageRole(record)
    if (!role) continue

    const text = truncateText(messageText(record).trim(), MAX_MESSAGE_CHARS)
    if (!text) continue

    const line = `${role}: ${text}`
    if (total + line.length > MAX_CONTEXT_CHARS) break
    lines.push(line)
    total += line.length
  }

  return lines.reverse().join('\n\n')
}

function formatTaskList(tasks: Task[]): string {
  if (tasks.length === 0) return '(no tasks)'
  const lines = tasks.map(t => {
    const parts = [`#${t.id} [${t.status}] ${t.subject}`]
    if (t.description) parts.push(`  description: ${truncateText(t.description, 200)}`)
    return parts.join('\n')
  })
  return lines.join('\n')
}

export function buildMonitorPrompt({
  tasks,
  messages,
}: {
  tasks: Task[]
  messages: unknown[]
}): string {
  const prompt = [
    `Task list:\n${formatTaskList(tasks)}`,
    `Recent conversation:\n${recentContext(messages) || '(no recent text)'}`,
    'The agent claims it is finished. Evaluate whether this stop is valid. Return strict JSON now.',
  ].join('\n\n')

  return truncateText(prompt, MAX_PROMPT_CHARS)
}

// -- JSON parsing ----------------------------------------------------------

function stripJsonFence(raw: string): string {
  let text = raw.trim()
  if (text.startsWith('```')) {
    text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
  }
  const first = text.indexOf('{')
  const last = text.lastIndexOf('}')
  if (first !== -1 && last !== -1 && last > first) {
    return text.slice(first, last + 1)
  }
  return text
}

export function parseMonitorDecision(raw: string): MonitorDecision | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(stripJsonFence(raw))
  } catch {
    return null
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return null
  }
  const obj = parsed as Record<string, unknown>
  if (typeof obj.valid_stop !== 'boolean') return null
  if (typeof obj.reason !== 'string') return null
  if (!Array.isArray(obj.incomplete_task_ids)) return null
  if (
    obj.next_instruction !== null &&
    typeof obj.next_instruction !== 'string'
  ) {
    return null
  }

  const incompleteTaskIds = obj.incomplete_task_ids.filter(
    (id): id is string => typeof id === 'string',
  )

  return {
    valid_stop: obj.valid_stop,
    reason: truncateText(obj.reason.trim() || 'No reason provided.', 1_000),
    incomplete_task_ids: incompleteTaskIds,
    next_instruction:
      typeof obj.next_instruction === 'string'
        ? truncateText(obj.next_instruction.trim(), 1_000) || null
        : null,
  }
}

// -- evaluator -------------------------------------------------------------

const defaultModelCaller: MonitorModelCaller = async request => {
  const response = await queryWithModel({
    systemPrompt: request.systemPrompt,
    userPrompt: request.userPrompt,
    outputFormat: MONITOR_OUTPUT_FORMAT,
    signal: request.signal,
    options: {
      querySource: 'monitor_evaluation',
      enablePromptCaching: false,
      agents: [],
      isNonInteractiveSession: request.isNonInteractiveSession,
      hasAppendSystemPrompt: false,
      mcpTools: [],
      model: request.model,
    },
  })

  return response.message.content
    .filter((block: { type: string }) => block.type === 'text')
    .map((block: { type: string; text?: string }) => block.text ?? '')
    .join('')
    .trim()
}

export async function evaluateMonitor({
  tasks,
  messages,
  signal,
  isNonInteractiveSession,
  model,
  modelCaller = defaultModelCaller,
}: {
  tasks: Task[]
  messages: unknown[]
  signal: AbortSignal
  isNonInteractiveSession: boolean
  model: string
  modelCaller?: MonitorModelCaller
}): Promise<MonitorDecision> {
  const request: MonitorModelRequest = {
    systemPrompt: asSystemPrompt([MONITOR_SYSTEM_PROMPT]),
    userPrompt: buildMonitorPrompt({ tasks, messages }),
    signal,
    isNonInteractiveSession,
    model,
  }

  try {
    for (let attempt = 0; attempt < 2; attempt++) {
      const raw = await modelCaller(request)
      const parsed = parseMonitorDecision(raw)
      if (parsed) return parsed
    }
    // Malformed twice — treat as valid stop so we don't block on a broken
    // evaluator. Better to let the agent stop than to loop on garbage JSON.
    return {
      valid_stop: true,
      reason:
        'Monitor evaluator returned malformed JSON; allowing stop as a safety default.',
      incomplete_task_ids: [],
      next_instruction: null,
    }
  } catch {
    // On error, allow the stop — same safety default.
    return {
      valid_stop: true,
      reason: 'Monitor evaluator failed; allowing stop as a safety default.',
      incomplete_task_ids: [],
      next_instruction: null,
    }
  }
}
