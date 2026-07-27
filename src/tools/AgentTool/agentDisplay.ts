// NYX: AgentTool deleted, stubbed
export type ResolvedAgent = any
export const AGENT_SOURCE_GROUPS: { label: string; sources: string[] }[] = []
export function compareAgentsByName(_a: ResolvedAgent, _b: ResolvedAgent): number {
  return 0
}
export function getOverrideSourceLabel(_source: string): string {
  return ''
}
export function resolveAgentModelDisplay(_agent: ResolvedAgent): string {
  return ''
}
export function resolveAgentOverrides(_agent: any): ResolvedAgent {
  return {} as ResolvedAgent
}
