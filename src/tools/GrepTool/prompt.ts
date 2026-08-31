import { AGENT_TOOL_NAME } from '../AgentTool/constants.js'
import { BASH_TOOL_NAME } from '../BashTool/toolName.js'

export const GREP_TOOL_NAME = 'Grep'

export function getDescription(): string {
  return `A powerful search tool built on fff (Fast File Finder). ALWAYS use ${GREP_TOOL_NAME} for search tasks (never \`grep\`/\`rg\` via ${BASH_TOOL_NAME}); supports full regex, glob/type filters, and content/files_with_matches/count output modes. Use ${AGENT_TOOL_NAME} for open-ended multi-round searches.`

}
