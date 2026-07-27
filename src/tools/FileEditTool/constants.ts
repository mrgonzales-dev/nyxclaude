// In its own file to avoid circular dependencies
export const FILE_EDIT_TOOL_NAME = 'Edit'

// Permission pattern for granting session-level access to the project's .nyxclaude/ folder
export const CLAUDE_FOLDER_PERMISSION_PATTERN = '/.nyxclaude/**'

// Permission pattern for granting session-level access to the global ~/.nyxclaude/ folder
export const GLOBAL_CLAUDE_FOLDER_PERMISSION_PATTERN = '~/.nyxclaude/**'

export const FILE_UNEXPECTEDLY_MODIFIED_ERROR =
  'File has been unexpectedly modified. Read it again before attempting to write it.'
