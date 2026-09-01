import type { UUID } from 'crypto'
import { logForDebugging } from '../../utils/debug.js'
import { getSystemContext, getUserContext } from '../../context.js'
import type { CanUseToolFn } from '../../hooks/useCanUseTool.js'
import { query } from '../../query.js'
import type { Terminal } from '../../query/transitions.js'
import type { Tool, Tools, ToolUseContext } from '../../Tool.js'
import { killShellTasksForAgent } from '../../tasks/LocalShellTask/killShellTasks.js'
import type { AgentId } from '../../types/ids.js'
import type {
  AssistantMessage,
  Message,
  ProgressMessage,
  StreamEvent,
  RequestStartEvent,
  SystemCompactBoundaryMessage,
  TombstoneMessage,
  ToolUseSummaryMessage,
  UserMessage,
} from '../../types/message.js'
import { AbortError } from '../../utils/errors.js'
import {
  cloneFileStateCache,
  createFileStateCacheWithSizeLimit,
  READ_FILE_STATE_CACHE_SIZE,
} from '../../utils/fileStateCache.js'
import {
  type CacheSafeParams,
  createSubagentContext,
} from '../../utils/forkedAgent.js'
import { createUserMessage } from '../../utils/messages.js'
import { getAgentModel } from '../../utils/model/agent.js'
import { isModelAllowed } from '../../utils/model/modelAllowlist.js'
import {
  resolveAgentRunModelRouting,
  shouldEnforceModelAllowlist,
} from '../../services/api/agentRouting.js'
import { getInitialSettings } from '../../utils/settings/settings.js'
import {
  recordSidechainTranscript,
  writeAgentMetadata,
} from '../../utils/sessionStorage.js'
import {
  asSystemPrompt,
  type SystemPrompt,
} from '../../utils/systemPromptType.js'
import { createAgentId } from '../../utils/uuid.js'
import { resolveAgentTools } from './agentToolUtils.js'
import { type AgentDefinition, isBuiltInAgent } from './loadAgentsDir.js'
import {
  DEFAULT_AGENT_PROMPT,
  enhanceSystemPromptWithEnvDetails,
} from '../../constants/prompts.js'
import type { QuerySource } from '../../constants/querySource.js'

type QueryMessage =
  | StreamEvent
  | RequestStartEvent
  | Message
  | ToolUseSummaryMessage
  | TombstoneMessage

/**
 * Type guard to check if a message from query() is a recordable Message type.
 */
function isRecordableMessage(
  msg: QueryMessage,
): msg is
  | AssistantMessage
  | UserMessage
  | ProgressMessage
  | SystemCompactBoundaryMessage {
  return (
    msg.type === 'assistant' ||
    msg.type === 'user' ||
    msg.type === 'progress' ||
    (msg.type === 'system' &&
      'subtype' in msg &&
      msg.subtype === 'compact_boundary')
  )
}

async function getAgentSystemPrompt(
  agentDefinition: AgentDefinition,
  toolUseContext: Pick<ToolUseContext, 'options'>,
  effectiveModel: string,
  additionalWorkingDirectories: string[],
  resolvedTools: readonly Tool[],
): Promise<string[]> {
  const enabledToolNames = new Set(resolvedTools.map(t => t.name))
  try {
    const agentPrompt = agentDefinition.getSystemPrompt({ toolUseContext })
    const prompts = [agentPrompt]

    return await enhanceSystemPromptWithEnvDetails(
      prompts,
      effectiveModel,
      additionalWorkingDirectories,
      enabledToolNames,
    )
  } catch (_error) {
    return enhanceSystemPromptWithEnvDetails(
      [DEFAULT_AGENT_PROMPT],
      effectiveModel,
      additionalWorkingDirectories,
      enabledToolNames,
    )
  }
}

export async function* runAgent({
  agentDefinition,
  promptMessages,
  toolUseContext,
  canUseTool,
  isAsync,
  canShowPermissionPrompts,
  forkContextMessages,
  querySource,
  override,
  model,
  maxTurns,
  maxSteps,
  preserveToolUseResults,
  availableTools,
  allowedTools,
  onCacheSafeParams,
  useExactTools,
  description,
  onQueryProgress,
}: {
  agentDefinition: AgentDefinition
  promptMessages: Message[]
  toolUseContext: ToolUseContext
  canUseTool: CanUseToolFn
  isAsync: boolean
  canShowPermissionPrompts?: boolean
  forkContextMessages?: Message[]
  querySource: QuerySource
  override?: {
    userContext?: { [k: string]: string }
    systemContext?: { [k: string]: string }
    systemPrompt?: SystemPrompt
    abortController?: AbortController
    agentId?: AgentId
  }
  model?: string
  maxTurns?: number
  maxSteps?: number
  preserveToolUseResults?: boolean
  availableTools: Tools
  allowedTools?: string[]
  onCacheSafeParams?: (params: CacheSafeParams) => void
  contentReplacementState?: import('../../utils/toolResultStorage.js').ContentReplacementState
  useExactTools?: boolean
  worktreePath?: string
  description?: string
  transcriptSubdir?: string
  onQueryProgress?: () => void
  agentName?: string
  routingSubagentType?: string
}): AsyncGenerator<Message, void> {
  const appState = toolUseContext.getAppState()
  const permissionMode = appState.toolPermissionContext.mode
  const rootSetAppState =
    toolUseContext.setAppStateForTasks ?? toolUseContext.setAppState

  const resolvedAgentModel = getAgentModel(
    agentDefinition.model,
    toolUseContext.options.mainLoopModel,
    model,
    permissionMode,
  )

  const settings = getInitialSettings()

  const { mainLoopModel: effectiveModel, providerOverride } =
    resolveAgentRunModelRouting({
      resolvedAgentModel,
      parentModel: toolUseContext.options.mainLoopModel,
      toolSpecifiedModel: model,
      agentName: undefined,
      subagentType: agentDefinition.agentType,
      agentDefinitionModel: agentDefinition.model,
      settings,
      permissionMode,
    })

  if (
    shouldEnforceModelAllowlist(
      resolvedAgentModel,
      effectiveModel,
      providerOverride !== undefined,
    ) &&
    !isModelAllowed(effectiveModel)
  ) {
    throw new Error(
      `Model '${effectiveModel}' is not available. Your organization restricts model selection.`,
    )
  }

  const agentId = override?.agentId ? override.agentId : createAgentId()

  // Handle message forking for context sharing
  // A forked agent inherits the parent's conversation context (and MCP state);
  // a fresh subagent starts with an isolated, empty MCP context so that parent
  // server instructions and resource lists don't leak into the subagent.
  const isForkPath = forkContextMessages !== undefined
  const contextMessages: Message[] = forkContextMessages
    ? filterIncompleteToolCalls(forkContextMessages)
    : []
  const initialMessages: Message[] = [...contextMessages, ...promptMessages]

  const agentReadFileState =
    isForkPath
      ? cloneFileStateCache(toolUseContext.readFileState)
      : createFileStateCacheWithSizeLimit(READ_FILE_STATE_CACHE_SIZE)

  const [baseUserContext, baseSystemContext] = await Promise.all([
    override?.userContext ?? getUserContext(),
    override?.systemContext ?? getSystemContext(),
  ])

  // Read-only agents (Explore, Plan) don't need agentsMd or gitStatus
  const shouldOmitAgentsMd = agentDefinition.omitAgentsMd && !override?.userContext
  const { agentsMd: _omittedAgentsMd, ...userContextNoAgentsMd } =
    baseUserContext
  const resolvedUserContext = shouldOmitAgentsMd
    ? userContextNoAgentsMd
    : baseUserContext

  const { gitStatus: _omittedGitStatus, ...systemContextNoGit } =
    baseSystemContext
  const resolvedSystemContext =
    agentDefinition.agentType === 'Explore' ||
    agentDefinition.agentType === 'Plan'
      ? systemContextNoGit
      : baseSystemContext

  // Override permission mode if agent defines one
  const agentPermissionMode = agentDefinition.permissionMode
  const agentGetAppState = () => {
    const state = toolUseContext.getAppState()
    let toolPermissionContext = state.toolPermissionContext

    if (
      agentPermissionMode &&
      state.toolPermissionContext.mode !== 'bypassPermissions' &&
      state.toolPermissionContext.mode !== 'fullAccess' &&
      state.toolPermissionContext.mode !== 'acceptEdits'
    ) {
      toolPermissionContext = {
        ...toolPermissionContext,
        mode: agentPermissionMode,
      }
    }

    const shouldAvoidPrompts =
      canShowPermissionPrompts !== undefined
        ? !canShowPermissionPrompts
        : isAsync
    if (shouldAvoidPrompts) {
      toolPermissionContext = {
        ...toolPermissionContext,
        shouldAvoidPermissionPrompts: true,
      }
    }

    if (allowedTools !== undefined) {
      toolPermissionContext = {
        ...toolPermissionContext,
        alwaysAllowRules: {
          cliArg: state.toolPermissionContext.alwaysAllowRules.cliArg,
          session: [...allowedTools],
        },
      }
    }

    const effortValue =
      agentDefinition.effort !== undefined
        ? agentDefinition.effort
        : state.effortValue

    const modelStateChanged =
      state.mainLoopModel !== effectiveModel ||
      state.mainLoopModelForSession !== effectiveModel

    if (
      toolPermissionContext === state.toolPermissionContext &&
      effortValue === state.effortValue &&
      !modelStateChanged
    ) {
      return state
    }
    return {
      ...state,
      mainLoopModel: effectiveModel,
      mainLoopModelForSession: effectiveModel,
      toolPermissionContext,
      effortValue,
    }
  }

  const resolvedTools = useExactTools
    ? availableTools
    : resolveAgentTools(agentDefinition, availableTools, isAsync).resolvedTools

  const additionalWorkingDirectories = Array.from(
    appState.toolPermissionContext.additionalWorkingDirectories.keys(),
  )

  const agentSystemPrompt = override?.systemPrompt
    ? override.systemPrompt
    : asSystemPrompt(
        await getAgentSystemPrompt(
          agentDefinition,
          toolUseContext,
          effectiveModel,
          additionalWorkingDirectories,
          resolvedTools,
        ),
      )

  // Determine abortController
  const agentAbortController = override?.abortController
    ? override.abortController
    : isAsync
      ? new AbortController()
      : toolUseContext.abortController

  // Build agent-specific options
  const agentOptions: ToolUseContext['options'] = {
    isNonInteractiveSession: useExactTools
      ? toolUseContext.options.isNonInteractiveSession
      : isAsync
        ? true
        : (toolUseContext.options.isNonInteractiveSession ?? false),
    appendSystemPrompt: toolUseContext.options.appendSystemPrompt,
    tools: resolvedTools,
    commands: [],
    debug: toolUseContext.options.debug,
    verbose: toolUseContext.options.verbose,
    mainLoopModel: effectiveModel,
    providerOverride: providerOverride ?? undefined,
    thinkingConfig: useExactTools
      ? toolUseContext.options.thinkingConfig
      : { type: 'disabled' as const },
    mcpClients: isForkPath ? toolUseContext.options.mcpClients : [],
    mcpResources: isForkPath ? toolUseContext.options.mcpResources : {},
    agentDefinitions: toolUseContext.options.agentDefinitions,
    ...(useExactTools && { querySource }),
  }

  // Create subagent context
  const agentToolUseContext = createSubagentContext(toolUseContext, {
    options: agentOptions,
    agentId,
    agentType: agentDefinition.agentType,
    messages: initialMessages,
    readFileState: agentReadFileState,
    abortController: agentAbortController,
    getAppState: agentGetAppState,
    ...(!isAsync && toolUseContext.queryLifecycle
      ? { queryLifecycle: toolUseContext.queryLifecycle }
      : {}),
    shareSetAppState: !isAsync,
    shareSetResponseLength: true,
    criticalSystemReminder_EXPERIMENTAL:
      agentDefinition.criticalSystemReminder_EXPERIMENTAL,
  })

  if (preserveToolUseResults) {
    agentToolUseContext.preserveToolUseResults = true
  }

  if (onCacheSafeParams) {
    onCacheSafeParams({
      systemPrompt: agentSystemPrompt,
      userContext: resolvedUserContext,
      systemContext: resolvedSystemContext,
      toolUseContext: agentToolUseContext,
      forkContextMessages: initialMessages,
    })
  }

  // Record initial messages (fire-and-forget)
  void recordSidechainTranscript(initialMessages, agentId).catch(_err =>
    logForDebugging(`Failed to record sidechain transcript: ${_err}`),
  )
  void writeAgentMetadata(agentId, {
    agentType: agentDefinition.agentType,
    ...(description && { description }),
  }).catch(_err => logForDebugging(`Failed to write agent metadata: ${_err}`))

  let lastRecordedUuid: UUID | null = initialMessages.at(-1)?.uuid ?? null

  try {
    let queryTerminal: Terminal | undefined
    const configuredMaxSteps =
      Number.isSafeInteger(maxSteps) && maxSteps! > 0
        ? maxSteps
        : Number.isSafeInteger(agentDefinition.maxSteps) &&
            agentDefinition.maxSteps! > 0
          ? agentDefinition.maxSteps
          : undefined
    const queryIterator = query({
      messages: initialMessages,
      systemPrompt: agentSystemPrompt,
      userContext: resolvedUserContext,
      systemContext: resolvedSystemContext,
      canUseTool,
      toolUseContext: agentToolUseContext,
      querySource,
      maxTurns: maxTurns ?? agentDefinition.maxTurns,
      agentStepLimit:
        configuredMaxSteps !== undefined
          ? {
              maxSteps: configuredMaxSteps,
              agentType: agentDefinition.agentType,
            }
          : undefined,
    })[Symbol.asyncIterator]()

    try {
      while (true) {
        const next = await queryIterator.next()
        if (next.done) {
          queryTerminal = next.value
          break
        }

        const message = next.value
        onQueryProgress?.()

        // Forward subagent API request starts to parent's metrics display
        if (
          message.type === 'stream_event' &&
          message.event.type === 'message_start' &&
          message.ttftMs != null
        ) {
          toolUseContext.pushApiMetricsEntry?.(message.ttftMs)
          continue
        }

        // Yield attachment messages without recording them
        if (message.type === 'attachment') {
          if (message.attachment.type === 'max_turns_reached') {
            logForDebugging(
              `[Agent: ${agentDefinition.agentType}] Reached max turns limit (${message.attachment.maxTurns})`,
            )
            break
          }
          yield message
          continue
        }

        if (isRecordableMessage(message)) {
          await recordSidechainTranscript(
            [message],
            agentId,
            lastRecordedUuid,
          ).catch(err =>
            logForDebugging(`Failed to record sidechain transcript: ${err}`),
          )
          if (message.type !== 'progress') {
            lastRecordedUuid = message.uuid
          }
          yield message
        }
      }
    } finally {
      if (queryTerminal === undefined) {
        await queryIterator.return?.(undefined as never)
      }
    }

    if (queryTerminal?.reason === 'agent_step_limit') {
      logForDebugging(
        `[Agent: ${agentDefinition.agentType}] Stopped after reaching maxSteps (${queryTerminal.stepsUsed}/${queryTerminal.maxSteps})`,
      )
    }

    if (agentAbortController.signal.aborted) {
      throw new AbortError()
    }

    // Run callback if provided (only built-in agents have callbacks)
    if (isBuiltInAgent(agentDefinition) && agentDefinition.callback) {
      agentDefinition.callback()
    }
  } finally {
    // Release cloned file state cache memory
    agentToolUseContext.readFileState.clear()
    // Release the cloned fork context messages
    initialMessages.length = 0
    // Clean up this agent's todos entry
    rootSetAppState(prev => {
      if (!(agentId in prev.todos)) return prev
      const { [agentId]: _removed, ...todos } = prev.todos
      return { ...prev, todos }
    })
    // Kill any background bash tasks this agent spawned
    killShellTasksForAgent(agentId, toolUseContext.getAppState, rootSetAppState)
  }
}

/**
 * Filters out assistant messages with incomplete tool calls (tool uses without results).
 * This prevents API errors when sending messages with orphaned tool calls.
 */
export function filterIncompleteToolCalls(messages: Message[]): Message[] {
  const toolUseIdsWithResults = new Set<string>()

  for (const message of messages) {
    if (message?.type === 'user') {
      const userMessage = message as UserMessage
      const content = userMessage.message.content
      if (Array.isArray(content)) {
        for (const block of content) {
          if (block.type === 'tool_result' && block.tool_use_id) {
            toolUseIdsWithResults.add(block.tool_use_id)
          }
        }
      }
    }
  }

  return messages.filter(message => {
    if (message?.type === 'assistant') {
      const assistantMessage = message as AssistantMessage
      const content = assistantMessage.message.content
      if (Array.isArray(content)) {
        const hasIncompleteToolCall = content.some(
          block =>
            block.type === 'tool_use' &&
            block.id &&
            !toolUseIdsWithResults.has(block.id),
        )
        return !hasIncompleteToolCall
      }
    }
    return true
  })
}
