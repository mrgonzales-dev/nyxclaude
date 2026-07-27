import { isAgentSwarmsEnabled } from '../../utils/agentSwarmsEnabled.js'

export const DESCRIPTION = 'Create a new task in the task list'

export function getPrompt(): string {
  const teammateTips = isAgentSwarmsEnabled()
    ? '- Include enough detail for another agent to complete the task\n'
    : ''

  return `Create tasks in the task list. Use for 3+ step tasks, multiple tasks, or complex features.

When to use: multi-step tasks, multiple user requests, complex features, plan mode.
When NOT to use: single trivial task, informational questions.

Fields:
- subject: brief imperative title (e.g., "Fix auth bug")
- description: what needs to be done
- activeForm (optional): present continuous form for spinner (e.g., "Fixing auth bug")

Tasks are created with status 'pending'. Use TaskUpdate to mark in_progress/completed.
${teammateTips}Check existing tasks first to avoid duplicates.`
}
