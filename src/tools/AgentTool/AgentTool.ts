import { buildTool, type ToolDef, toolMatchesName } from '../../Tool.js'
import type {
  Message as MessageType,
  NormalizedUserMessage,
} from '../../types/message.js'
import { getQuerySourceForAgent } from '../../utils/promptCategory.js'
import { z } from 'zod/v4'
import { enhanceSystemPromptWithEnvDetails } from '../../constants/prompts.js'
import { assembleToolPool } from '../../tools.js'
import { asAgentId } from '../../types/ids.js'
import { runWithAgentContext } from '../../utils/agentContext.js'
import { logForDebugging } from '../../utils/debug.js'
import { isEnvTruthy } from '../../utils/envUtils.js'
import { AbortError, errorMessage, toError } from '../../utils/errors.js'
import type { CacheSafeParams } from '../../utils/forkedAgent.js'
import { lazySchema } from '../../utils/lazySchema.js'
import { logError } from '../../utils/log.js'
import {
  createUserMessage,
  extractTextContent,
  isSyntheticMessage,
  normalizeMessages,
} from '../../utils/messages.js'
import { getAgentModel } from '../../utils/model/agent.js'
import { isModelAllowed } from '../../utils/model/modelAllowlist.js'
import type { PermissionResult } from '../../utils/permissions/PermissionResult.js'
import { filterDeniedAgents } from '../../utils/permissions/permissions.js'
import { getInitialSettings } from '../../utils/settings/settings.js'
import { asSystemPrompt } from '../../utils/systemPromptType.js'
import { getTaskOutputPath } from '../../utils/task/diskOutput.js'
import { createAgentId } from '../../utils/uuid.js'
import { FILE_READ_TOOL_NAME } from '../FileReadTool/prompt.js'
import { BASH_TOOL_NAME } from '../BashTool/toolName.js'
import { setAgentColor } from './agentColorManager.js'
import {
  agentToolResultSchema,
  finalizeAgentTool,
  getLastToolUseName,
} from './agentToolUtils.js'
import { GENERAL_PURPOSE_AGENT } from './built-in/generalPurposeAgent.js'
import {
  AGENT_TOOL_NAME,
  LEGACY_AGENT_TOOL_NAME,
  ONE_SHOT_BUILTIN_AGENT_TYPES,
} from './constants.js'
import { isForkSubagentEnabled } from './forkSubagent.js'
import type { AgentDefinition } from './loadAgentsDir.js'
import { isBuiltInAgent } from './loadAgentsDir.js'
import { getPrompt } from './prompt.js'
import { runAgent } from './runAgent.js'
import {
  completeAgentTask as completeAsyncAgent,
  createActivityDescriptionResolver,
  createProgressTracker,
  enqueueAgentNotification,
  failAgentTask as failAsyncAgent,
  getProgressUpdate,
  getTokenCountFromTracker,
  isLocalAgentTask,
  killAsyncAgent,
  registerAgentForeground,
  registerAsyncAgent,
  unregisterAgentForeground,
  updateAgentProgress as updateAsyncAgentProgress,
  updateProgressFromMessage,
} from '../../tasks/LocalAgentTask/LocalAgentTask.js'
import type { AgentToolProgress } from '../../types/tools.js'
import {
  renderToolResultMessage,
  renderToolUseErrorMessage,
  renderToolUseMessage,
  renderToolUseProgressMessage,
  renderToolUseRejectedMessage,
  renderToolUseTag,
  userFacingName,
  userFacingNameBackgroundColor,
} from './UI.js'

// Check if background tasks are disabled at module load time
const isBackgroundTasksDisabled = isEnvTruthy(
  process.env.CLAUDE_CODE_DISABLE_BACKGROUND_TASKS,
)

// Base input schema
const baseInputSchema = lazySchema(() =>
  z.object({
    description: z
      .string()
      .describe('A short (3-5 word) description of the task'),
    prompt: z.string().describe('The task for the agent to perform'),
    subagent_type: z
      .string()
      .optional()
      .describe(
        'The type of specialized agent to use for this task',
      ),
    model: z
      .string()
      .trim()
      .min(1, 'Model cannot be empty')
      .optional()
      .describe(
        "Optional model override for this agent. Accepts aliases such as sonnet, opus, haiku, inherit, or a provider-supported model ID. Takes precedence over the agent definition's model frontmatter. If omitted, uses the agent definition's model, or inherits from the parent.",
      ),
    run_in_background: z
      .boolean()
      .optional()
      .describe(
        'Set to true to run this agent in the background. You will be notified when it completes.',
      ),
  }),
)

export const inputSchema = lazySchema(() => {
  const schema = baseInputSchema()
  return isBackgroundTasksDisabled || isForkSubagentEnabled()
    ? schema.omit({ run_in_background: true })
    : schema
})

type InputSchema = ReturnType<typeof inputSchema>
type AgentToolInput = z.infer<ReturnType<typeof baseInputSchema>>

// Output schema
export const outputSchema = lazySchema(() => {
  const syncOutputSchema = agentToolResultSchema().extend({
    status: z.literal('completed'),
    prompt: z.string(),
  })
  const asyncOutputSchema = z.object({
    status: z.literal('async_launched'),
    agentId: z.string().describe('The ID of the async agent'),
    description: z.string().describe('The description of the task'),
    prompt: z.string().describe('The prompt for the agent'),
    outputFile: z
      .string()
      .describe('Path to the output file for checking agent progress'),
    canReadOutputFile: z
      .boolean()
      .optional()
      .describe(
        'Whether the calling agent has Read/Bash tools to check progress',
      ),
  })
  return z.union([syncOutputSchema, asyncOutputSchema])
})
type OutputSchema = ReturnType<typeof outputSchema>
type Output = z.input<OutputSchema>

export type Progress = AgentToolProgress

export const AgentTool = buildTool({
  async prompt({ agents, tools, getToolPermissionContext, allowedAgentTypes }) {
    const toolPermissionContext = await getToolPermissionContext()
    const filteredAgents = filterDeniedAgents(
      agents,
      toolPermissionContext,
      AGENT_TOOL_NAME,
    )
    return await getPrompt(filteredAgents, false, allowedAgentTypes)
  },
  name: AGENT_TOOL_NAME,
  searchHint: 'delegate work to a subagent',
  aliases: [LEGACY_AGENT_TOOL_NAME],
  maxResultSizeChars: 100_000,
  async description() {
    return 'Launch a new agent'
  },
  get inputSchema(): InputSchema {
    return inputSchema()
  },
  get outputSchema(): OutputSchema {
    return outputSchema()
  },
  async call(
    {
      prompt,
      subagent_type,
      description,
      model: modelParam,
      run_in_background,
    }: AgentToolInput,
    toolUseContext,
    canUseTool,
    assistantMessage,
    onProgress?,
  ) {
    const startTime = Date.now()
    const model = modelParam

    const appState = toolUseContext.getAppState()
    const permissionMode = appState.toolPermissionContext.mode
    const rootSetAppState =
      toolUseContext.setAppStateForTasks ?? toolUseContext.setAppState

    // Resolve agent type: explicit subagent_type, or fork path, or default general-purpose
    const effectiveType =
      subagent_type ??
      (isForkSubagentEnabled() ? undefined : GENERAL_PURPOSE_AGENT.agentType)
    const isForkPath = effectiveType === undefined

    let selectedAgent: AgentDefinition
    if (isForkPath) {
      // Fork path: use parent's context — no separate agent definition needed
      // But we need a minimal agent definition for the fork
      throw new Error(
        'Fork subagent path is not yet supported in this build. Specify a subagent_type.',
      )
    } else {
      const allAgents = toolUseContext.options.agentDefinitions.activeAgents
      const { allowedAgentTypes } = toolUseContext.options.agentDefinitions
      const agents = filterDeniedAgents(
        allowedAgentTypes
          ? allAgents.filter(a => allowedAgentTypes.includes(a.agentType))
          : allAgents,
        appState.toolPermissionContext,
        AGENT_TOOL_NAME,
      )
      const found = agents.find(agent => agent.agentType === effectiveType)
      if (!found) {
        const agentExistsButDenied = allAgents.find(
          agent => agent.agentType === effectiveType,
        )
        if (agentExistsButDenied) {
          throw new Error(
            `Agent type '${effectiveType}' has been denied by permission rule.`,
          )
        }
        throw new Error(
          `Agent type '${effectiveType}' not found. Available agents: ${agents.map(a => a.agentType).join(', ')}`,
        )
      }
      selectedAgent = found
    }

    // Initialize color for this agent
    if (selectedAgent.color) {
      setAgentColor(selectedAgent.agentType, selectedAgent.color)
    }

    const forcePlanModeSync =
      permissionMode === 'plan' ||
      toolUseContext.getAppState().toolPermissionContext.mode === 'plan'

    const shouldRunAsync =
      (forcePlanModeSync ? false : run_in_background === true) &&
      !isBackgroundTasksDisabled

    // Resolve model
    const effectiveAgentModel = getAgentModel(
      selectedAgent.model,
      toolUseContext.options.mainLoopModel,
      model,
      permissionMode,
    )

    if (!isModelAllowed(effectiveAgentModel)) {
      throw new Error(
        `Model '${effectiveAgentModel}' is not available. Your organization restricts model selection.`,
      )
    }

    // Build prompt messages
    let promptMessages: MessageType[] = []
    let enhancedSystemPrompt: string[] | undefined
    const additionalWorkingDirectories = Array.from(
      appState.toolPermissionContext.additionalWorkingDirectories.keys(),
    )

    if (!isForkPath) {
      try {
        const agentPrompt = selectedAgent.getSystemPrompt({ toolUseContext })
        enhancedSystemPrompt = await enhanceSystemPromptWithEnvDetails(
          [agentPrompt],
          effectiveAgentModel,
          additionalWorkingDirectories,
        )
      } catch (error) {
        logForDebugging(
          `Failed to get system prompt for agent ${selectedAgent.agentType}: ${errorMessage(error)}`,
        )
      }
      promptMessages = [createUserMessage({ content: prompt })]
    }

    const metadata = {
      prompt,
      resolvedAgentModel: effectiveAgentModel,
      isBuiltInAgent: isBuiltInAgent(selectedAgent),
      startTime,
      agentType: selectedAgent.agentType,
      isAsync: shouldRunAsync,
    }

    // Assemble worker tool pool
    const workerPermissionContext = {
      ...appState.toolPermissionContext,
      mode: selectedAgent.permissionMode ?? 'acceptEdits',
    }
    const workerTools = assembleToolPool(
      workerPermissionContext,
      appState.mcp.tools,
    )

    const earlyAgentId = createAgentId()

    const runAgentParams: Parameters<typeof runAgent>[0] = {
      agentDefinition: selectedAgent,
      promptMessages,
      toolUseContext,
      canUseTool,
      isAsync: shouldRunAsync,
      querySource:
        toolUseContext.options.querySource ??
        getQuerySourceForAgent(
          selectedAgent.agentType,
          isBuiltInAgent(selectedAgent),
        ),
      model: isForkPath ? undefined : model,
      override:
        enhancedSystemPrompt && !isForkPath
          ? { systemPrompt: asSystemPrompt(enhancedSystemPrompt) }
          : undefined,
      availableTools: isForkPath ? toolUseContext.options.tools : workerTools,
      forkContextMessages: isForkPath ? toolUseContext.messages : undefined,
      useExactTools: isForkPath ? true : undefined,
      description,
    }

    if (shouldRunAsync) {
      const asyncAgentId = earlyAgentId
      const agentBackgroundTask = registerAsyncAgent({
        agentId: asyncAgentId,
        description,
        prompt,
        selectedAgent,
        setAppState: rootSetAppState,
        toolUseId: toolUseContext.toolUseId!,
      })

      void (async () => {
        try {
          const agentMessages: MessageType[] = []
          for await (const message of runAgent({
            ...runAgentParams,
            override: {
              ...runAgentParams.override,
              agentId: asAgentId(agentBackgroundTask.agentId),
              abortController: agentBackgroundTask.abortController!,
            },
            onCacheSafeParams: () => {},
          })) {
            agentMessages.push(message)
            // Update progress
            updateProgressFromMessage(
              createProgressTracker(),
              message,
              createActivityDescriptionResolver(toolUseContext.options.tools),
              toolUseContext.options.tools,
            )
          }
          const agentResult = finalizeAgentTool(
            agentMessages,
            asAgentId(agentBackgroundTask.agentId),
            metadata,
          )
          completeAsyncAgent(agentResult, rootSetAppState)
          enqueueAgentNotification({
            taskId: agentBackgroundTask.agentId,
            description,
            status: 'completed',
            setAppState: rootSetAppState,
            toolUseId: toolUseContext.toolUseId!,
            finalMessage: extractTextContent(
              agentResult.content.map(c => ({ type: 'text' as const, text: c.text })),
              '\n',
            ),
          })
        } catch (error) {
          if (error instanceof AbortError) {
            killAsyncAgent(agentBackgroundTask.agentId, rootSetAppState)
            enqueueAgentNotification({
              taskId: agentBackgroundTask.agentId,
              description,
              status: 'killed',
              setAppState: rootSetAppState,
              toolUseId: toolUseContext.toolUseId!,
            })
            return
          }
          const errMsg = errorMessage(error)
          failAsyncAgent(agentBackgroundTask.agentId, errMsg, rootSetAppState)
          enqueueAgentNotification({
            taskId: agentBackgroundTask.agentId,
            description,
            status: 'failed',
            error: errMsg,
            setAppState: rootSetAppState,
            toolUseId: toolUseContext.toolUseId!,
          })
        }
      })()

      const canReadOutputFile = toolUseContext.options.tools.some(
        t =>
          toolMatchesName(t, FILE_READ_TOOL_NAME) ||
          toolMatchesName(t, BASH_TOOL_NAME),
      )

      return {
        data: {
          status: 'async_launched' as const,
          agentId: agentBackgroundTask.agentId,
          description: description!,
          prompt,
          outputFile: getTaskOutputPath(agentBackgroundTask.agentId),
          canReadOutputFile,
        },
      }
    } else {
      // Sync agent execution
      const syncAgentId = asAgentId(earlyAgentId)

      return runWithAgentContext(
        {
          agentId: syncAgentId,
          agentType: 'subagent' as const,
          subagentName: selectedAgent.agentType,
          isBuiltIn: isBuiltInAgent(selectedAgent),
          invokingRequestId: assistantMessage?.requestId,
          invocationKind: 'spawn' as const,
          invocationEmitted: false,
        },
        async () => {
          const agentMessages: MessageType[] = []
          const agentStartTime = Date.now()
          const syncTracker = createProgressTracker()
          const syncResolveActivity = createActivityDescriptionResolver(
            toolUseContext.options.tools,
          )

          // Yield initial progress message
          if (promptMessages.length > 0) {
            const normalizedPromptMessages = normalizeMessages(promptMessages)
            const normalizedFirstMessage = normalizedPromptMessages.find(
              (m): m is NormalizedUserMessage => m.type === 'user',
            )
            if (normalizedFirstMessage && onProgress) {
              onProgress({
                toolUseID: `agent_${assistantMessage.message.id}`,
                data: {
                  message: normalizedFirstMessage,
                  type: 'agent_progress',
                  prompt,
                  agentId: syncAgentId,
                },
              })
            }
          }

          // Register as foreground task (for backgrounding support)
          let foregroundTaskId: string | undefined
          if (!isBackgroundTasksDisabled) {
            const registration = registerAgentForeground({
              agentId: syncAgentId,
              description: description!,
              prompt,
              selectedAgent,
              setAppState: rootSetAppState,
              toolUseId: toolUseContext.toolUseId!,
            })
            foregroundTaskId = registration.taskId
          }

          let syncAgentError: Error | undefined
          let wasAborted = false
          let wasBackgrounded = false

          try {
            for await (const message of runAgent({
              ...runAgentParams,
              override: {
                ...runAgentParams.override,
                agentId: syncAgentId,
              },
            })) {
              agentMessages.push(message)
              updateProgressFromMessage(
                syncTracker,
                message,
                syncResolveActivity,
                toolUseContext.options.tools,
              )

              if (onProgress) {
                const progress = getProgressUpdate(syncTracker)
                onProgress({
                  toolUseID: `agent_${assistantMessage.message.id}`,
                  data: {
                    type: 'agent_progress',
                    message,
                    prompt,
                    agentId: syncAgentId,
                    progress,
                  },
                })
              }
            }
          } catch (error) {
            if (error instanceof AbortError) {
              wasAborted = true
              throw error
            }
            logError(error)
            syncAgentError = toError(error)
          } finally {
            if (foregroundTaskId) {
              unregisterAgentForeground(foregroundTaskId, rootSetAppState)
            }
          }

          // Check for synthetic (cancelled) messages
          const lastMessage = agentMessages.findLast(
            _ => _.type !== 'system' && _.type !== 'progress',
          )
          if (lastMessage && isSyntheticMessage(lastMessage)) {
            throw new AbortError()
          }

          // If an error occurred, try to return partial results
          if (syncAgentError) {
            const hasAssistantMessages = agentMessages.some(
              msg => msg.type === 'assistant',
            )
            if (!hasAssistantMessages) {
              throw syncAgentError
            }
            logForDebugging(
              `Sync agent recovering from error with ${agentMessages.length} messages`,
            )
          }

          const agentResult = finalizeAgentTool(
            agentMessages,
            syncAgentId,
            metadata,
          )
          return {
            data: {
              status: 'completed' as const,
              prompt,
              ...agentResult,
            },
          }
        },
      )
    }
  },
  isReadOnly() {
    return true
  },
  toAutoClassifierInput(input) {
    const i = input as AgentToolInput
    const tags = [i.subagent_type].filter(
      (t): t is string => t !== undefined,
    )
    const prefix = tags.length > 0 ? `(${tags.join(', ')}): ` : ': '
    return `${prefix}${i.prompt}`
  },
  isConcurrencySafe() {
    return true
  },
  userFacingName,
  userFacingNameBackgroundColor,
  getActivityDescription(input) {
    return input?.description ?? 'Running task'
  },
  async checkPermissions(input, _context): Promise<PermissionResult> {
    return {
      behavior: 'allow',
      updatedInput: input,
    }
  },
  mapToolResultToToolResultBlockParam(data, toolUseID) {
    if (data.status === 'async_launched') {
      const prefix = `Agent '${data.agentId}' running. Output: ${data.outputFile}.`
      const instructions = data.canReadOutputFile
        ? `Do not duplicate this agent's work — avoid working with the same files or topics it is using. Briefly tell the user what you launched and end your response — agent results will arrive in a subsequent message.\nIf asked, you can check progress before completion by using ${FILE_READ_TOOL_NAME} or ${BASH_TOOL_NAME} tail on the output file.`
        : `Briefly tell the user what you launched and end your response. Do not generate any other text — agent results will arrive in a subsequent message.`
      const text = `${prefix}\n${instructions}`
      return {
        tool_use_id: toolUseID,
        type: 'tool_result',
        content: [{ type: 'text', text }],
      }
    }
    if (data.status === 'completed') {
      const contentOrMarker =
        data.content.length > 0
          ? data.content
          : [{ type: 'text' as const, text: '(Subagent completed but returned no output.)' }]
      // One-shot built-ins (Explore, Plan) skip the usage trailer
      if (
        data.agentType &&
        ONE_SHOT_BUILTIN_AGENT_TYPES.includes(data.agentType)
      ) {
        return {
          tool_use_id: toolUseID,
          type: 'tool_result',
          content: contentOrMarker,
        }
      }
      return {
        tool_use_id: toolUseID,
        type: 'tool_result',
        content: [
          ...contentOrMarker,
          {
            type: 'text',
            text: `agentId: ${data.agentId}
<usage>total_tokens: ${data.totalTokens}
tool_uses: ${data.totalToolUseCount}
duration_ms: ${data.totalDurationMs}</usage>`,
          },
        ],
      }
    }
    throw new Error(
      `Unexpected agent tool result status: ${(data as { status: string }).status}`,
    )
  },
  renderToolResultMessage,
  renderToolUseMessage,
  renderToolUseTag,
  renderToolUseProgressMessage,
  renderToolUseRejectedMessage,
  renderToolUseErrorMessage,
} satisfies ToolDef<InputSchema, Output, Progress>)
