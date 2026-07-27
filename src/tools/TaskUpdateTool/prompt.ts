export const DESCRIPTION = 'Update a task in the task list'

export const PROMPT = `Update a task in the task list.

When to use:
- Mark task in_progress BEFORE starting work
- Mark completed when FULLY done (not partial, not failing)
- Mark deleted when task is irrelevant or was created in error
- If blocked, keep in_progress and create a new task for the blocker

Never mark completed if: tests failing, implementation partial, or unresolved errors.

Fields:
- taskId: the task ID to update
- status: pending → in_progress → completed (or deleted)
- subject: change title
- description: change description
- activeForm: present continuous form for spinner (e.g., "Running tests")
- owner: assign to an agent
- addBlocks/addBlockedBy: set task dependencies

Examples: {"taskId":"1","status":"in_progress"} or {"taskId":"1","status":"completed"}`
