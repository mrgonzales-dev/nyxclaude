// NYX: AgentTool deleted, stubbed
export type AgentColorName = string
export const AGENT_COLORS: AgentColorName[] = ['cyan', 'blue', 'green', 'yellow', 'magenta', 'red']
export const AGENT_COLOR_TO_THEME_COLOR: Record<AgentColorName, string> = {
  cyan: 'cyan',
  blue: 'blue',
  green: 'green',
  yellow: 'yellow',
  magenta: 'magenta',
  red: 'red',
}
export function getAgentColor(_agentId: string): AgentColorName {
  return 'cyan'
}
export function setAgentColor(_agentId: string, _color: AgentColorName): void {}
