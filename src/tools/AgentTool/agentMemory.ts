// NYX: AgentTool deleted, stubbed
export type AgentMemoryScope = 'individual' | 'team' | 'none'
export function getMemoryScopeDisplay(_scope: AgentMemoryScope): string {
  return ''
}
export function getAgentMemoryDir(_agentId?: string): string {
  return ''
}
export function isAgentMemoryPath(_path: string): boolean {
  return false
}
export function loadAgentMemoryPrompt(_agentId?: string): Promise<string> {
  return Promise.resolve('')
}
