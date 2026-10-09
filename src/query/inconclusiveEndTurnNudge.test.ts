import { expect, test } from 'bun:test'
import { z } from 'zod/v4'

import { query, type QueryParams } from '../query.js'
import { buildTool, type Tools } from '../Tool.js'
import type { QueryDeps } from './deps.js'
import {
  createAssistantMessage,
  createUserMessage,
} from '../utils/messages.js'
import { asSystemPrompt } from '../utils/systemPromptType.js'
import { EMPTY_RESPONSE_ERROR_TEXT } from '../services/api/openaiShim.js'

const echoTool = buildTool({
  name: 'Echo',
  inputSchema: z.object({ text: z.string() }),
  maxResultSizeChars: Infinity,
  async description() {
    return 'Echo input text'
  },
  async prompt() {
    return ''
  },
  async call(input) {
    return { data: `echo:${input.text}` }
  },
  mapToolResultToToolResultBlockParam(content, toolUseID) {
    return {
      type: 'tool_result',
      tool_use_id: toolUseID,
      content: String(content),
    }
  },
  renderToolUseMessage() {
    return null
  },
  renderToolResultMessage() {
    return null
  },
})

const toolUseMessage = createAssistantMessage({
  content: [
    {
      type: 'tool_use',
      id: 'toolu_echo',
      name: 'Echo',
      input: { text: 'ping' },
    },
  ],
})

const NUDGE_TEXT = 'state that explicitly'

function makeToolUseContext(tools: Tools = []): QueryParams['toolUseContext'] {
  const abortController = new AbortController()
  let inProgressToolUseIDs = new Set<string>()

  return {
    abortController,
    getAppState: () => ({
      fastMode: false,
      mcp: { tools: {}, clients: [] },
      toolPermissionContext: { mode: 'default' },
      sessionHooks: new Map(),
      mainLoopModel: 'gpt-4o',
      effortValue: undefined,
      advisorModel: undefined,
    }),
    options: {
      commands: [],
      debug: false,
      thinkingConfig: { type: 'disabled' },
      tools,
      verbose: false,
      mcpClients: [],
      mcpResources: {},
      isNonInteractiveSession: false,
      agentDefinitions: { activeAgents: [], allowedAgentTypes: undefined },
      appendSystemPrompt: undefined,
      providerOverride: undefined,
      mainLoopModel: 'gpt-4o',
    },
    addNotification: () => {},
    messages: [],
    setInProgressToolUseIDs: updater => {
      inProgressToolUseIDs = updater(inProgressToolUseIDs)
    },
    setResponseLength: () => {},
    updateFileHistoryState: () => {},
    updateAttributionState: () => {},
  } as unknown as QueryParams['toolUseContext']
}

function makeParams(
  callModel: QueryDeps['callModel'],
  tools: Tools = [],
  querySource: QueryParams['querySource'] = 'sdk',
): QueryParams {
  return {
    messages: [createUserMessage({ content: 'hello' })],
    systemPrompt: asSystemPrompt([]),
    userContext: {},
    systemContext: {},
    canUseTool: async () => ({ behavior: 'allow' }),
    toolUseContext: makeToolUseContext(tools),
    querySource,
    deps: {
      callModel,
      microcompact: async messages => ({ messages }),
      autocompact: async () => ({
        compactionResult: null,
        consecutiveFailures: undefined,
      }),
      uuid: () => '00000000-0000-4000-8000-000000000000',
    } as unknown as QueryDeps,
  }
}

// The nudge is meta — appended to the request messages, not yielded. Assert
// on what the model was sent rather than on the output stream.
function countNudges(requests: QueryParams['messages'][]): number {
  return requests.filter(messages =>
    messages.some(
      message =>
        message.type === 'user' &&
        message.isMeta === true &&
        typeof message.message.content === 'string' &&
        message.message.content.includes(NUDGE_TEXT),
    ),
  ).length
}

async function collect(params: QueryParams): Promise<unknown[]> {
  const previousSimple = process.env.NYXCLAUDE_SIMPLE
  process.env.NYXCLAUDE_SIMPLE = '1'
  const messages: unknown[] = []
  try {
    for await (const message of query(params)) {
      messages.push(message)
    }
  } finally {
    if (previousSimple === undefined) {
      delete process.env.NYXCLAUDE_SIMPLE
    } else {
      process.env.NYXCLAUDE_SIMPLE = previousSimple
    }
  }
  return messages
}

test('nudges a text-only end_turn with inconclusive prose after tool use', async () => {
  const requests: QueryParams['messages'][] = []
  let callCount = 0
  const callModel: QueryDeps['callModel'] = async function* ({ messages }) {
    requests.push(messages)
    callCount += 1
    if (callCount === 1) {
      yield toolUseMessage
      return
    }
    if (callCount === 2) {
      // Transitional prose matching no continuation signal — the stall shape.
      yield createAssistantMessage({
        content: 'The executor lives in src/app/exec.go.',
      })
      return
    }
    yield createAssistantMessage({ content: 'done' })
  }

  await collect(makeParams(callModel, [echoTool]))

  expect(callCount).toBe(3)
  expect(countNudges(requests)).toBe(1)
})

test('does not nudge a conclusive text-only end_turn after tool use', async () => {
  const requests: QueryParams['messages'][] = []
  let callCount = 0
  const callModel: QueryDeps['callModel'] = async function* ({ messages }) {
    requests.push(messages)
    callCount += 1
    if (callCount === 1) {
      yield toolUseMessage
      return
    }
    yield createAssistantMessage({ content: 'All set, let me know if you need changes.' })
  }

  await collect(makeParams(callModel, [echoTool]))

  expect(callCount).toBe(2)
  expect(countNudges(requests)).toBe(0)
})

test('nudges a thinking-only end_turn even before any tool use', async () => {
  const requests: QueryParams['messages'][] = []
  let callCount = 0
  const callModel: QueryDeps['callModel'] = async function* ({ messages }) {
    requests.push(messages)
    callCount += 1
    if (callCount === 1) {
      yield createAssistantMessage({
        content: [{ type: 'thinking', thinking: 'hmm' }],
      })
      return
    }
    yield createAssistantMessage({ content: 'done' })
  }

  await collect(makeParams(callModel))

  expect(callCount).toBe(2)
  expect(countNudges(requests)).toBe(1)
})

test('does not nudge subagent query sources', async () => {
  const requests: QueryParams['messages'][] = []
  let callCount = 0
  const callModel: QueryDeps['callModel'] = async function* ({ messages }) {
    requests.push(messages)
    callCount += 1
    if (callCount === 1) {
      yield toolUseMessage
      return
    }
    yield createAssistantMessage({
      content: 'The executor lives in src/app/exec.go.',
    })
  }

  await collect(makeParams(callModel, [echoTool], 'agent:test'))

  expect(callCount).toBe(2)
  expect(countNudges(requests)).toBe(0)
})

test('caps inconclusive nudges at 3 per stall site', async () => {
  const requests: QueryParams['messages'][] = []
  let callCount = 0
  const callModel: QueryDeps['callModel'] = async function* ({ messages }) {
    requests.push(messages)
    callCount += 1
    if (callCount === 1) {
      yield toolUseMessage
      return
    }
    yield createAssistantMessage({
      content: 'The executor lives in src/app/exec.go.',
    })
  }

  await collect(makeParams(callModel, [echoTool]))

  // 1 tool-use call + 4 inconclusive responses; only the first 3 are nudged.
  expect(callCount).toBe(5)
  expect(countNudges(requests)).toBe(3)
})

test('does not nudge a done-declaration followed by an option menu', async () => {
  // Observed loop: a verbose finish (done-declaration + trailing numbered
  // option menu) has no completion marker in the last 120 chars, so the
  // old logic nudged "state that explicitly" and the model re-stated
  // "the task is finished" — 3 more times, until the cap.
  const requests: QueryParams['messages'][] = []
  let callCount = 0
  const callModel: QueryDeps['callModel'] = async function* ({ messages }) {
    requests.push(messages)
    callCount += 1
    if (callCount === 1) {
      yield toolUseMessage
      return
    }
    yield createAssistantMessage({
      content:
        'The task is finished.\n\n' +
        'Both files match the pre-guard commit.\n\n' +
        'To move forward, pick one:\n' +
        '1. Restore the guarded version from the /tmp backups.\n' +
        '2. Design a new guard before input.\n' +
        '3. Leave both files as they are now.',
    })
  }

  await collect(makeParams(callModel, [echoTool]))

  expect(callCount).toBe(2)
  expect(countNudges(requests)).toBe(0)
})

test('does not nudge a done-declaration buried in a verbose tail', async () => {
  // Declaration >120 chars from the end — exercises the 500-char
  // FINALITY_DECLARATIONS window rather than the handoff signals.
  const requests: QueryParams['messages'][] = []
  let callCount = 0
  const callModel: QueryDeps['callModel'] = async function* ({ messages }) {
    requests.push(messages)
    callCount += 1
    if (callCount === 1) {
      yield toolUseMessage
      return
    }
    yield createAssistantMessage({
      content:
        'The task is finished. ' +
        'Both blade files equal the pre-guard commit byte-for-byte, ' +
        'and no guard symbol remains in either view. ' +
        'Verification ran twice with identical results. ' +
        'Backups remain in /tmp for reference purposes only now.',
    })
  }

  await collect(makeParams(callModel, [echoTool]))

  expect(callCount).toBe(2)
  expect(countNudges(requests)).toBe(0)
})

test('does not stack inconclusive nudges on the empty-response error shape', async () => {
  const requests: QueryParams['messages'][] = []
  let callCount = 0
  const callModel: QueryDeps['callModel'] = async function* ({ messages }) {
    requests.push(messages)
    callCount += 1
    yield createAssistantMessage({ content: EMPTY_RESPONSE_ERROR_TEXT })
  }

  await collect(makeParams(callModel))

  // 3 auto-proceeds then halt — the inconclusive path must not pile on.
  expect(callCount).toBe(4)
  expect(countNudges(requests)).toBe(0)
})
