import { FILE_EDIT_TOOL_NAME } from '../FileEditTool/constants.js'

export const PROMPT = `Manage a task list for the current session. Use proactively for any task with 3+ steps.

When to use: multi-step tasks, multiple tasks from user, complex features, large codebase exploration.
When NOT to use: single trivial task, purely informational questions.

Rules:
- Mark one task in_progress BEFORE starting it (only one at a time)
- Mark completed IMMEDIATELY when done (don't batch)
- Keep in_progress if blocked; add a new task describing the blocker
- Each task needs: content (imperative, e.g. "Fix auth bug") + activeForm (continuous, e.g. "Fixing auth bug")
- Remove irrelevant tasks; add follow-up tasks as discovered`

export const DESCRIPTION =
  'Update the session todo list. Use for 3+ step tasks. One task in_progress at a time. Provide content + activeForm for each.'
