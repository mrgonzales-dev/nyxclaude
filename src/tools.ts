// biome-ignore-all assist/source/organizeImports: internal-only import markers must not be reordered
import { toolMatchesName, type Tool, type Tools } from './Tool.js'
import { AgentTool } from './tools/AgentTool/AgentTool.js'
import { BashTool } from './tools/BashTool/BashTool.js'
import { FileEditTool } from './tools/FileEditTool/FileEditTool.js'
import { FileReadTool } from './tools/FileReadTool/FileReadTool.js'
import { FileWriteTool } from './tools/FileWriteTool/FileWriteTool.js'
import { GlobTool } from './tools/GlobTool/GlobTool.js'
import { GrepTool } from './tools/GrepTool/GrepTool.js'
import { TaskCreateTool } from './tools/TaskCreateTool/TaskCreateTool.js'
import { TaskGetTool } from './tools/TaskGetTool/TaskGetTool.js'
import { TaskListTool } from './tools/TaskListTool/TaskListTool.js'
import { TaskUpdateTool } from './tools/TaskUpdateTool/TaskUpdateTool.js'
import { TodoWriteTool } from './tools/TodoWriteTool/TodoWriteTool.js'
import { WebFetchTool } from './tools/WebFetchTool/WebFetchTool.js'
import uniqBy from 'lodash-es/uniqBy.js'
import {
  type ToolPermissionContext,
} from './Tool.js'
import { getDenyRuleForTool } from './utils/permissions/permissions.js'
import { hasEmbeddedSearchTools } from './utils/embeddedTools.js'

// NYXCLAUDE: REPL tool constants stubbed (REPLTool deleted)
const REPL_TOOL_NAME = ''
const REPL_ONLY_TOOLS: string[] = []
export { REPL_ONLY_TOOLS }

// NYXCLAUDE: SyntheticOutputTool deleted, stub
const SYNTHETIC_OUTPUT_TOOL_NAME = ''

// NYXCLAUDE: AgentTool deleted, re-export from constants for compatibility
export { ALL_AGENT_DISALLOWED_TOOLS } from './constants/tools.js'

// NYXCLAUDE: filterToolsByDenyRules - simple implementation
export function filterToolsByDenyRules(tools: Tools, _permissionContext: ToolPermissionContext): Tools {
  return tools
}

/**
 * Predefined tool presets that can be used with --tools flag
 */
export const TOOL_PRESETS = ['default'] as const

export type ToolPreset = (typeof TOOL_PRESETS)[number]

export function parseToolPreset(preset: string): ToolPreset | null {
  const presetString = preset.toLowerCase()
  if (!TOOL_PRESETS.includes(presetString as ToolPreset)) {
    return null
  }
  return presetString as ToolPreset
}

/**
 * Get the list of tool names for a given preset
 * Filters out tools that are disabled via isEnabled() check
 * @param preset The preset name
 * @returns Array of tool names
 */
export function getToolsForDefaultPreset(): string[] {
  const tools = getAllBaseTools()
  const isEnabled = tools.map(tool => tool.isEnabled())
  return tools.filter((_, i) => isEnabled[i]).map(tool => tool.name)
}

/**
 * Get the complete exhaustive list of all tools that could be available
 * in the current environment (respecting process.env flags).
 * This is the source of truth for ALL tools.
 */
export function getAllBaseTools(): Tools {
  return [
    AgentTool,
    BashTool,
    ...(hasEmbeddedSearchTools() ? [] : [GlobTool, GrepTool]),
    FileReadTool,
    FileEditTool,
    FileWriteTool,
    TaskCreateTool,
    TaskListTool,
    TaskGetTool,
    TaskUpdateTool,
    TodoWriteTool,
    WebFetchTool,
  ].filter(Boolean)
}

/**
 * Filters out tools that are blanket-denied by the permission context.
 * A tool is filtered out if there's a deny rule matching its name with no
 * ruleContent (i.e., a blanket deny for that tool).
 *
 * Uses the same matcher as the runtime permission check (step 1a), so MCP
 * server-prefix rules like `mcp__server` strip all tools from that server
 * prefix.
 */
export function getTools(
  permissionContext: ToolPermissionContext,
  _mode?: string,
): Tools {
  // NYXCLAUDE: filter by isEnabled() so mutually exclusive tools
  // (TodoWrite vs TaskCreate/TaskUpdate) don't both show up.
  return getAllBaseTools().filter(tool => {
    if (!tool.isEnabled()) return false
    const denyRule = getDenyRuleForTool(permissionContext, tool)
    if (!denyRule) return true
    // If the deny rule has content (e.g. "Bash(git *)"), it only denies
    // specific sub-patterns, not the whole tool — keep the tool.
    if (denyRule.ruleValue.ruleContent) return true
    // Blanket deny for this tool name
    return !toolMatchesName(tool, denyRule.ruleValue.toolName)
  })
}

/**
 * Assembles the full tool pool from built-in tools and any dynamically
 * registered tools (e.g., MCP tools).
 * Accepts a permission context (used by REPL/SDK callers) and optional MCP tools.
 */
export function assembleToolPool(
  permissionContext: ToolPermissionContext,
  _mcpTools?: Tools,
): Tools {
  // NYXCLAUDE: MCP tools removed, just return filtered builtin tools
  const builtinTools = getTools(permissionContext)
  return uniqBy(builtinTools, tool => tool.name)
}
