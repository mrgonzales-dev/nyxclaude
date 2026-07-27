// biome-ignore-all assist/source/organizeImports: internal-only import markers must not be reordered
import { toolMatchesName, type Tool, type Tools } from './Tool.js'
import { BashTool } from './tools/BashTool/BashTool.js'
import { FileEditTool } from './tools/FileEditTool/FileEditTool.js'
import { FileReadTool } from './tools/FileReadTool/FileReadTool.js'
import { FileWriteTool } from './tools/FileWriteTool/FileWriteTool.js'
// NYX-AGENT: GlobTool unregistered — fff's grep + fileSearch covers path search.
// The GlobTool source files are kept for reference but no longer loaded.
// import { GlobTool } from './tools/GlobTool/GlobTool.js'
import { GrepTool } from './tools/GrepTool/GrepTool.js'
import { TodoWriteTool } from './tools/TodoWriteTool/TodoWriteTool.js'
import uniqBy from 'lodash-es/uniqBy.js'
import {
  type ToolPermissionContext,
} from './Tool.js'
import { getDenyRuleForTool } from './utils/permissions/permissions.js'
import { hasEmbeddedSearchTools } from './utils/embeddedTools.js'

// NYX-AGENT: REPL tool constants stubbed (REPLTool deleted)
const REPL_TOOL_NAME = ''
const REPL_ONLY_TOOLS: string[] = []
export { REPL_ONLY_TOOLS }

// NYX-AGENT: SyntheticOutputTool deleted, stub
const SYNTHETIC_OUTPUT_TOOL_NAME = ''

// NYX-AGENT: AgentTool deleted, re-export from constants for compatibility
export { ALL_AGENT_DISALLOWED_TOOLS } from './constants/tools.js'

// NYX-AGENT: filterToolsByDenyRules - simple implementation
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
    BashTool,
    // NYX-AGENT: GlobTool unregistered (fff covers path search via grep).
    // GrepTool now uses fff in-process with ripgrep fallback.
    ...(hasEmbeddedSearchTools() ? [] : [GrepTool]),
    FileReadTool,
    FileEditTool,
    FileWriteTool,
    TodoWriteTool,
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
  const denyRule = getDenyRuleForTool(permissionContext)
  if (!denyRule) {
    return getAllBaseTools()
  }

  return getAllBaseTools().filter(tool => {
    if (denyRule.ruleContent) {
      return true
    }
    return !toolMatchesName(tool.name, denyRule.tool)
  })
}

/**
 * Assembles the full tool pool from built-in tools and any dynamically
 * registered tools (e.g., MCP tools).
 */
export function assembleToolPool(
  builtinTools: Tools,
  _mcpTools?: Tools,
): Tools {
  // NYX-AGENT: MCP tools removed, just return builtin tools
  return uniqBy(builtinTools, tool => tool.name)
}
