import memoize from 'lodash-es/memoize.js'
import { basename } from 'path'
import type { SettingSource } from '../../utils/settings/constants.js'
import { z } from 'zod/v4'
import type { ToolUseContext } from '../../Tool.js'
import { logForDebugging } from '../../utils/debug.js'
import {
  EFFORT_LEVELS,
  type EffortValue,
  parseFrontmatterEffortValue,
} from '../../utils/effort.js'
import { parsePositiveIntFromFrontmatter } from '../../utils/frontmatterParser.js'
import { lazySchema } from '../../utils/lazySchema.js'
import { logError } from '../../utils/log.js'
import {
  loadMarkdownFilesForSubdir,
  parseAgentToolsFromFrontmatter,
  parseSlashCommandToolsFromFrontmatter,
} from '../../utils/markdownConfigLoader.js'
import {
  PERMISSION_MODES,
  type PermissionMode,
} from '../../utils/permissions/PermissionMode.js'
import {
  AGENT_COLORS,
  type AgentColorName,
  setAgentColor,
} from './agentColorManager.js'
import { getBuiltInAgents } from './builtInAgents.js'

// Zod schemas for JSON agent validation
const AgentJsonSchema = lazySchema(() =>
  z.object({
    description: z.string().min(1, 'Description cannot be empty'),
    tools: z.array(z.string()).optional(),
    disallowedTools: z.array(z.string()).optional(),
    prompt: z.string().min(1, 'Prompt cannot be empty'),
    model: z
      .string()
      .trim()
      .min(1, 'Model cannot be empty')
      .transform(m => (m.toLowerCase() === 'inherit' ? 'inherit' : m))
      .optional(),
    effort: z
      .union([z.enum(EFFORT_LEVELS), z.number().int()])
      .optional()
      .transform(parseFrontmatterEffortValue),
    permissionMode: z.enum(PERMISSION_MODES).optional(),
    maxTurns: z.number().int().positive().optional(),
    maxSteps: z.number().int().positive().optional(),
    skills: z.array(z.string()).optional(),
    initialPrompt: z.string().optional(),
    background: z.boolean().optional(),
  }),
)

const AgentsJsonSchema = lazySchema(() =>
  z.record(z.string(), AgentJsonSchema()),
)

// Base type with common fields for all agents
export type BaseAgentDefinition = {
  agentType: string
  whenToUse: string
  tools?: string[]
  disallowedTools?: string[]
  skills?: string[]
  color?: AgentColorName
  model?: string
  effort?: EffortValue
  permissionMode?: PermissionMode
  maxTurns?: number
  maxSteps?: number
  filename?: string
  baseDir?: string
  criticalSystemReminder_EXPERIMENTAL?: string
  background?: boolean
  initialPrompt?: string
  omitClaudeMd?: boolean
}

// Built-in agents - dynamic prompts only, no static systemPrompt field
export type BuiltInAgentDefinition = BaseAgentDefinition & {
  source: 'built-in'
  baseDir: 'built-in'
  callback?: () => void
  getSystemPrompt: (params: {
    toolUseContext: Pick<ToolUseContext, 'options'>
  }) => string
}

// Custom agents from user/project/policy settings - prompt stored via closure
export type CustomAgentDefinition = BaseAgentDefinition & {
  getSystemPrompt: () => string
  source: SettingSource
  filename?: string
  baseDir?: string
}

export type SdkAgentDefinition = BaseAgentDefinition & {
  getSystemPrompt: () => string
  source: 'sdk'
}

// Union type for all agent types
export type AgentDefinition =
  | BuiltInAgentDefinition
  | CustomAgentDefinition
  | SdkAgentDefinition

// Type guards for runtime type checking
export function isBuiltInAgent(
  agent: AgentDefinition,
): agent is BuiltInAgentDefinition {
  return agent.source === 'built-in'
}

export function isCustomAgent(
  agent: AgentDefinition,
): agent is CustomAgentDefinition {
  return agent.source !== 'built-in' && agent.source !== 'sdk'
}

export function isPluginAgent(_agent: AgentDefinition): _agent is never {
  return false
}

export type AgentDefinitionsResult = {
  activeAgents: AgentDefinition[]
  allAgents: AgentDefinition[]
  failedFiles?: Array<{ path: string; error: string }>
  allowedAgentTypes?: string[]
}

export function getActiveAgentsFromList(
  allAgents: AgentDefinition[],
): AgentDefinition[] {
  const builtInAgents = allAgents.filter(a => a.source === 'built-in')
  const userAgents = allAgents.filter(a => a.source === 'userSettings')
  const projectAgents = allAgents.filter(a => a.source === 'projectSettings')
  const managedAgents = allAgents.filter(a => a.source === 'policySettings')
  const flagAgents = allAgents.filter(a => a.source === 'flagSettings')
  const sdkAgents = allAgents.filter(a => a.source === 'sdk')

  const agentGroups = [
    builtInAgents,
    userAgents,
    projectAgents,
    flagAgents,
    sdkAgents,
    managedAgents,
  ]

  const agentMap = new Map<string, AgentDefinition>()

  for (const agents of agentGroups) {
    for (const agent of agents) {
      agentMap.set(agent.agentType, agent)
    }
  }

  return Array.from(agentMap.values())
}

/**
 * Checks if an agent's required MCP servers are available.
 * Returns true if no requirements or all requirements are met.
 */
export function hasRequiredMcpServers(
  _agent: AgentDefinition,
  _availableServers: string[],
): boolean {
  return true
}

/**
 * Filters agents based on MCP server requirements.
 */
export function filterAgentsByMcpRequirements(
  agents: AgentDefinition[],
  _availableServers?: string[],
): AgentDefinition[] {
  return agents
}

export const getAgentDefinitionsWithOverrides = memoize(
  async (cwd: string): Promise<AgentDefinitionsResult> => {
    try {
      const markdownFiles = await loadMarkdownFilesForSubdir('agents', cwd)

      const failedFiles: Array<{ path: string; error: string }> = []
      const customAgents = markdownFiles
        .map(({ filePath, baseDir, frontmatter, content, source }) => {
          const agent = parseAgentFromMarkdown(
            filePath,
            baseDir,
            frontmatter,
            content,
            source,
          )
          if (!agent) {
            if (!frontmatter['name']) {
              return null
            }
            const errorMsg = getParseError(frontmatter)
            failedFiles.push({ path: filePath, error: errorMsg })
            logForDebugging(
              `Failed to parse agent from ${filePath}: ${errorMsg}`,
            )
            return null
          }
          return agent
        })
        .filter(agent => agent !== null)

      const builtInAgents = getBuiltInAgents()

      const allAgentsList: AgentDefinition[] = [
        ...builtInAgents,
        ...customAgents,
      ]

      const activeAgents = getActiveAgentsFromList(allAgentsList)

      // Initialize colors for all active agents
      for (const agent of activeAgents) {
        if (agent.color) {
          setAgentColor(agent.agentType, agent.color)
        }
      }

      return {
        activeAgents,
        allAgents: allAgentsList,
        failedFiles: failedFiles.length > 0 ? failedFiles : undefined,
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      logForDebugging(`Error loading agent definitions: ${errorMessage}`)
      logError(error)
      const builtInAgents = getBuiltInAgents()
      return {
        activeAgents: builtInAgents,
        allAgents: builtInAgents,
        failedFiles: [{ path: 'unknown', error: errorMessage }],
      }
    }
  },
)

export function clearAgentDefinitionsCache(): void {
  getAgentDefinitionsWithOverrides.cache.clear?.()
}

/**
 * Helper to determine the specific parsing error for an agent file
 */
function getParseError(frontmatter: Record<string, unknown>): string {
  const agentType = frontmatter['name']
  const description = frontmatter['description']

  if (!agentType || typeof agentType !== 'string') {
    return 'Missing required "name" field in frontmatter'
  }

  if (!description || typeof description !== 'string') {
    return 'Missing required "description" field in frontmatter'
  }

  return 'Unknown parsing error'
}

/**
 * Parses agent definition from JSON data
 */
export function parseAgentFromJson(
  name: string,
  definition: unknown,
  source: SettingSource = 'flagSettings',
): CustomAgentDefinition | null {
  try {
    const parsed = AgentJsonSchema().parse(definition)

    let tools = parseAgentToolsFromFrontmatter(parsed.tools)

    const systemPrompt = parsed.prompt
    const agentDef: CustomAgentDefinition = {
      agentType: name,
      whenToUse: parsed.description,
      ...(tools !== undefined ? { tools } : {}),
      ...(parsed.disallowedTools !== undefined
        ? { disallowedTools: parseAgentToolsFromFrontmatter(parsed.disallowedTools) }
        : {}),
      ...(parsed.skills !== undefined ? { skills: parsed.skills } : {}),
      ...(parsed.initialPrompt !== undefined
        ? { initialPrompt: parsed.initialPrompt }
        : {}),
      getSystemPrompt: () => systemPrompt,
      source,
      ...(parsed.model !== undefined ? { model: parsed.model } : {}),
      ...(parsed.effort !== undefined ? { effort: parsed.effort } : {}),
      ...(parsed.permissionMode !== undefined
        ? { permissionMode: parsed.permissionMode }
        : {}),
      ...(parsed.maxTurns !== undefined ? { maxTurns: parsed.maxTurns } : {}),
      ...(parsed.maxSteps !== undefined ? { maxSteps: parsed.maxSteps } : {}),
      ...(parsed.background !== undefined ? { background: parsed.background } : {}),
    }
    return agentDef
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    logForDebugging(`Error parsing agent '${name}' from JSON: ${errorMessage}`)
    logError(error)
    return null
  }
}

/**
 * Parses multiple agents from a JSON object
 */
export function parseAgentsFromJson(
  json: string,
  source: SettingSource = 'flagSettings',
): CustomAgentDefinition[] {
  try {
    const parsed = JSON.parse(json)
    const result = AgentsJsonSchema().parse(parsed)
    const agents: CustomAgentDefinition[] = []
    for (const [name, definition] of Object.entries(result)) {
      const agent = parseAgentFromJson(name, definition, source)
      if (agent) {
        agents.push(agent)
      }
    }
    return agents
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    logForDebugging(`Error parsing agents from JSON: ${errorMessage}`)
    logError(error)
    return []
  }
}

/**
 * Parses agent definition from markdown file data
 */
export function parseAgentFromMarkdown(
  filePath: string,
  baseDir: string,
  frontmatter: Record<string, unknown>,
  content: string,
  source: SettingSource,
): CustomAgentDefinition | null {
  try {
    const agentType = frontmatter['name']
    let whenToUse = frontmatter['description'] as string

    if (!agentType || typeof agentType !== 'string') {
      return null
    }
    if (!whenToUse || typeof whenToUse !== 'string') {
      logForDebugging(
        `Agent file ${filePath} is missing required 'description' in frontmatter`,
      )
      return null
    }

    // Unescape newlines in whenToUse that were escaped for YAML parsing
    whenToUse = whenToUse.replace(/\\n/g, '\n')

    const color = frontmatter['color'] as AgentColorName | undefined
    const modelRaw = frontmatter['model']
    let model: string | undefined
    if (typeof modelRaw === 'string' && modelRaw.trim().length > 0) {
      const trimmed = modelRaw.trim()
      model = trimmed.toLowerCase() === 'inherit' ? 'inherit' : trimmed
    }

    // Parse background flag
    const backgroundRaw = frontmatter['background']
    if (
      backgroundRaw !== undefined &&
      backgroundRaw !== 'true' &&
      backgroundRaw !== 'false' &&
      backgroundRaw !== true &&
      backgroundRaw !== false
    ) {
      logForDebugging(
        `Agent file ${filePath} has invalid background value '${backgroundRaw}'. Must be 'true', 'false', or omitted.`,
      )
    }
    const background =
      backgroundRaw === 'true' || backgroundRaw === true ? true : undefined

    // Parse effort from frontmatter
    const effortRaw = frontmatter['effort']
    const parsedEffort =
      effortRaw !== undefined ? parseFrontmatterEffortValue(effortRaw) : undefined

    if (effortRaw !== undefined && parsedEffort === undefined) {
      logForDebugging(
        String(effortRaw).toLowerCase() === 'ultracode'
          ? `Agent file ${filePath} requested effort 'ultracode', a session-only mode not supported in frontmatter; ignoring.`
          : `Agent file ${filePath} has invalid effort '${effortRaw}'. Valid options: ${EFFORT_LEVELS.filter(l => l !== 'ultracode').join(', ')} or an integer`,
      )
    }

    // Parse permissionMode from frontmatter
    const permissionModeRaw = frontmatter['permissionMode'] as
      | string
      | undefined
    const isValidPermissionMode =
      permissionModeRaw &&
      (PERMISSION_MODES as readonly string[]).includes(permissionModeRaw)

    if (permissionModeRaw && !isValidPermissionMode) {
      const errorMsg = `Agent file ${filePath} has invalid permissionMode '${permissionModeRaw}'. Valid options: ${PERMISSION_MODES.join(', ')}`
      logForDebugging(errorMsg)
    }

    // Parse maxTurns from frontmatter
    const maxTurnsRaw = frontmatter['maxTurns']
    const maxTurns = parsePositiveIntFromFrontmatter(maxTurnsRaw)
    if (maxTurnsRaw !== undefined && maxTurns === undefined) {
      logForDebugging(
        `Agent file ${filePath} has invalid maxTurns '${maxTurnsRaw}'. Must be a positive integer.`,
      )
    }

    // Parse maxSteps from frontmatter
    const maxStepsRaw = frontmatter['maxSteps']
    const maxSteps = parsePositiveIntFromFrontmatter(maxStepsRaw)
    if (maxStepsRaw !== undefined && maxSteps === undefined) {
      logForDebugging(
        `Agent file ${filePath} has invalid maxSteps '${maxStepsRaw}'. Must be a positive integer.`,
      )
    }

    // Extract filename without extension
    const filename = basename(filePath, '.md')

    // Parse tools from frontmatter
    const tools = parseAgentToolsFromFrontmatter(frontmatter['tools'])

    // Parse disallowedTools from frontmatter
    const disallowedToolsRaw = frontmatter['disallowedTools']
    const disallowedTools =
      disallowedToolsRaw !== undefined
        ? parseAgentToolsFromFrontmatter(disallowedToolsRaw)
        : undefined

    // Parse skills from frontmatter
    const skills = parseSlashCommandToolsFromFrontmatter(frontmatter['skills'])

    const initialPromptRaw = frontmatter['initialPrompt']
    const initialPrompt =
      typeof initialPromptRaw === 'string' && initialPromptRaw.trim()
        ? initialPromptRaw
        : undefined

    const systemPrompt = content.trim()
    const agentDef: CustomAgentDefinition = {
      baseDir,
      agentType: agentType,
      whenToUse: whenToUse,
      ...(tools !== undefined ? { tools } : {}),
      ...(disallowedTools !== undefined ? { disallowedTools } : {}),
      ...(skills !== undefined ? { skills } : {}),
      ...(initialPrompt !== undefined ? { initialPrompt } : {}),
      getSystemPrompt: () => systemPrompt,
      source,
      filename,
      ...(color && typeof color === 'string' && AGENT_COLORS.includes(color)
        ? { color }
        : {}),
      ...(model !== undefined ? { model } : {}),
      ...(parsedEffort !== undefined ? { effort: parsedEffort } : {}),
      ...(isValidPermissionMode
        ? { permissionMode: permissionModeRaw as PermissionMode }
        : {}),
      ...(maxTurns !== undefined ? { maxTurns } : {}),
      ...(maxSteps !== undefined ? { maxSteps } : {}),
      ...(background ? { background } : {}),
    }
    return agentDef
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    logForDebugging(`Error parsing agent from ${filePath}: ${errorMessage}`)
    logError(error)
    return null
  }
}
