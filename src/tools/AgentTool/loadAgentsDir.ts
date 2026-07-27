// NYX: AgentTool deleted, stubbed
export type AgentDefinition = any
export type AgentDefinitionsResult = { activeAgents: AgentDefinition[]; allAgents: AgentDefinition[]; failedFiles?: { path: string; error: string }[] }
export type CustomAgentDefinition = any
export type BuiltInAgentDefinition = any

export function getAgentDefinitionsWithOverrides(_cwd?: string): Promise<AgentDefinitionsResult> {
  return Promise.resolve({ activeAgents: [], allAgents: [] })
}
export function getActiveAgentsFromList(_agents: AgentDefinition[]): AgentDefinition[] {
  return []
}
export function isBuiltInAgent(_agent: AgentDefinition): boolean {
  return false
}
export function isCustomAgent(_agent: AgentDefinition): boolean {
  return false
}
export function isPluginAgent(_agent: AgentDefinition): boolean {
  return false
}
export function parseAgentsFromJson(_json: string): AgentDefinition[] {
  return []
}
export function clearAgentDefinitionsCache(): void {}
export function filterAgentsByMcpRequirements(_agents: AgentDefinition[]): AgentDefinition[] {
  return []
}
