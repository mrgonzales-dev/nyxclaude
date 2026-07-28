import type { QuerySource } from '../../constants/querySource.js'
import type { ToolUseContext } from '../../Tool.js'
import type { Message } from '../../types/message.js'
import { isEnvTruthy } from '../../utils/envUtils.js'
import { logForDebugging } from '../../utils/debug.js'
import { createSystemMessage, createUserMessage } from '../../utils/messages.js'
import {
  getTaskListId,
  listTasks,
  type Task,
} from '../../utils/tasks.js'
import {
  evaluateMonitor as evaluateMonitorDefault,
  type MonitorDecision,
  type MonitorModelCaller,
} from './evaluator.js'

// -- constants -------------------------------------------------------------

/**
 * Hard cap on consecutive monitor rejections. After this many rejections the
 * monitor yields and lets the turn complete, regardless of task state.
 * Prevents pathological infinite loops even if the no-progress guard fails.
 */
export const MAX_MONITOR_REJECTIONS = 5

/**
 * Minimum number of incomplete tasks required for the monitor to even fire.
 * If everything is already completed there is nothing to verify — skip the
 * LLM call entirely (zero cost).
 */
const MIN_INCOMPLETE_TASKS_TO_FIRE = 1

// -- types -----------------------------------------------------------------

export type MonitorEvaluationDeps = {
  evaluateMonitor?: typeof evaluateMonitorDefault
  modelCaller?: MonitorModelCaller
}

export type MonitorState = {
  /** Consecutive rejections in the current turn. Reset on a successful stop. */
  rejectionCount: number
  /**
   * Snapshot of incomplete task IDs at the last rejection. Used for the
   * no-progress guard: if two consecutive rejections see the exact same set
   * of incomplete tasks, the agent made no progress and continuing won't help.
   */
  lastIncompleteTaskIds: string[]
}

export function createMonitorState(): MonitorState {
  return {
    rejectionCount: 0,
    lastIncompleteTaskIds: [],
  }
}

// -- guards ----------------------------------------------------------------

/**
 * Kill switch: CLAUDE_CODE_DISABLE_MONITOR=1 turns the monitor off entirely.
 * Always-on by default, but this gives users an escape hatch if the monitor
 * misbehaves in their environment.
 */
export function isMonitorDisabled(): boolean {
  return isEnvTruthy(process.env.CLAUDE_CODE_DISABLE_MONITOR)
}

function isMainThreadMonitorSource(
  querySource: QuerySource,
  toolUseContext: ToolUseContext,
): boolean {
  if (toolUseContext.agentId) return false
  if (typeof querySource !== 'string') return false
  return querySource === 'sdk' || querySource.startsWith('repl_main_thread')
}

function hasPendingInteractiveDialog(
  toolUseContext: ToolUseContext,
): boolean {
  const state = toolUseContext.getAppState()
  return Boolean(
    state.elicitation?.queue?.length ||
      state.pendingWorkerRequest ||
      state.pendingSandboxRequest ||
      state.activeOverlays?.size,
  )
}

/**
 * The no-progress guard: returns true if the current set of incomplete task
 * IDs is identical to the set seen at the last rejection. This means the
 * agent stopped again without completing any task — continuing would just
 * produce the same stop, so we let it terminate.
 */
export function hasNoProgressSinceLastRejection(
  currentIncompleteIds: string[],
  lastIncompleteTaskIds: string[],
): boolean {
  if (lastIncompleteTaskIds.length === 0) return false
  if (currentIncompleteIds.length !== lastIncompleteTaskIds.length) return false
  const currentSet = new Set(currentIncompleteIds)
  return lastIncompleteTaskIds.every(id => currentSet.has(id))
}

// -- main entry ------------------------------------------------------------

/**
 * Runs the monitor after a turn ends. Returns blocking messages that, when
 * non-empty, force the query loop to continue. Yields system messages for
 * UI visibility.
 *
 * Safeguards (in evaluation order):
 * 1. Kill switch (CLAUDE_CODE_DISABLE_MONITOR) — no-op entirely.
 * 2. Main-thread only — subagents bypass the monitor.
 * 3. Abort-aware — bails immediately if the signal fired.
 * 4. Fast-path skip — no LLM call when all tasks are completed or there are
 *    no tasks.
 * 5. Hard cap — after MAX_MONITOR_REJECTIONS rejections, allow the stop.
 * 6. No-progress — if the same incomplete task IDs persist across two
 *    consecutive rejections, allow the stop.
 */
export async function* evaluateMonitorAfterTurn({
  messagesForQuery,
  assistantMessages,
  toolUseContext,
  querySource,
  monitorState,
  deps = {},
}: {
  messagesForQuery: Message[]
  assistantMessages: Message[]
  toolUseContext: ToolUseContext
  querySource: QuerySource
  monitorState: MonitorState
  deps?: MonitorEvaluationDeps
}): AsyncGenerator<Message, Message[]> {
  // Guard 1: kill switch
  if (isMonitorDisabled()) return []

  // Guard 2: main thread only
  if (!isMainThreadMonitorSource(querySource, toolUseContext)) return []

  // Guard 3: abort
  if (toolUseContext.abortController.signal.aborted) return []

  // Guard 4: pending interactive dialog
  if (hasPendingInteractiveDialog(toolUseContext)) return []

  const evaluateMonitor = deps.evaluateMonitor ?? evaluateMonitorDefault

  // Fetch the task list. If tasks aren't enabled or the list is empty, skip.
  let tasks: Task[]
  try {
    const taskListId = getTaskListId()
    tasks = await listTasks(taskListId)
  } catch {
    // Can't read tasks — don't block the stop.
    return []
  }

  if (tasks.length === 0) return []

  const incompleteTasks = tasks.filter(
    t => t.status === 'pending' || t.status === 'in_progress',
  )

  // Fast-path: all tasks completed → valid stop, no LLM call needed.
  if (incompleteTasks.length < MIN_INCOMPLETE_TASKS_TO_FIRE) {
    return []
  }

  const incompleteTaskIds = incompleteTasks.map(t => t.id)

  // Guard 5: hard cap
  if (monitorState.rejectionCount >= MAX_MONITOR_REJECTIONS) {
    logForDebugging(
      `Monitor: hard cap reached (${monitorState.rejectionCount}/${MAX_MONITOR_REJECTIONS}); allowing stop despite ${incompleteTasks.length} incomplete tasks.`,
    )
    yield createSystemMessage(
      `Monitor: allowing stop after ${MAX_MONITOR_REJECTIONS} rejections. ` +
        `${incompleteTasks.length} task(s) still incomplete: ` +
        incompleteTasks.map(t => `#${t.id} ${t.subject}`).join(', ') +
        '.',
      'warning',
    )
    return []
  }

  // Guard 6: no-progress
  if (
    hasNoProgressSinceLastRejection(
      incompleteTaskIds,
      monitorState.lastIncompleteTaskIds,
    )
  ) {
    logForDebugging(
      `Monitor: no-progress detected (same ${incompleteTaskIds.length} incomplete tasks as last rejection); allowing stop.`,
    )
    yield createSystemMessage(
      `Monitor: no progress since last check — allowing stop. ` +
        `${incompleteTasks.length} task(s) still incomplete: ` +
        incompleteTasks.map(t => `#${t.id} ${t.subject}`).join(', ') +
        '.',
      'warning',
    )
    return []
  }

  // -- Run the monitor LLM -------------------------------------------------
  const model = toolUseContext.options.mainLoopModel
  if (!model) {
    // No model resolved — can't run the monitor. Allow the stop.
    return []
  }

  let decision: MonitorDecision
  try {
    decision = await evaluateMonitor({
      tasks,
      messages: [...messagesForQuery, ...assistantMessages],
      signal: toolUseContext.abortController.signal,
      isNonInteractiveSession:
        toolUseContext.options.isNonInteractiveSession ?? false,
      model,
      ...(deps.modelCaller ? { modelCaller: deps.modelCaller } : {}),
    })
  } catch {
    // Evaluator threw — allow the stop (safety default).
    return []
  }

  // Abort may have fired during the LLM call.
  if (toolUseContext.abortController.signal.aborted) return []

  // Update state for the next iteration.
  monitorState.rejectionCount += 1
  monitorState.lastIncompleteTaskIds = incompleteTaskIds

  if (decision.valid_stop) {
    // Monitor agrees the stop is valid. Reset rejection count so a future
    // turn starts fresh.
    monitorState.rejectionCount = 0
    monitorState.lastIncompleteTaskIds = []
    return []
  }

  // -- Stop rejected: build blocking messages ------------------------------
  logForDebugging(
    `Monitor: stop rejected (${monitorState.rejectionCount}/${MAX_MONITOR_REJECTIONS}). ` +
      `Reason: ${decision.reason}. ` +
      `Incomplete: ${decision.incomplete_task_ids.join(', ') || '(none listed)'}`,
  )

  yield createSystemMessage(
    `Monitor: stop rejected — ${decision.reason}`,
    'warning',
  )

  const instruction =
    decision.next_instruction ??
    `The monitor determined the task is not complete. ` +
      `Pending/in-progress tasks: ` +
      incompleteTasks.map(t => `#${t.id} ${t.subject}`).join(', ') +
      `. Continue working on these tasks before stopping.`

  return [
    createUserMessage({
      content: instruction,
      isMeta: true,
    }),
  ]
}
