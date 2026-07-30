import type { BuiltInAgentDefinition } from './loadAgentsDir.js'
import { EXPLORE_AGENT } from './built-in/exploreAgent.js'
import { GENERAL_PURPOSE_AGENT } from './built-in/generalPurposeAgent.js'
import { PLAN_AGENT } from './built-in/planAgent.js'

export function getBuiltInAgents(): BuiltInAgentDefinition[] {
  return [EXPLORE_AGENT, GENERAL_PURPOSE_AGENT, PLAN_AGENT]
}

export function areExplorePlanAgentsEnabled(): boolean {
  return true
}
