import { isEnvTruthy } from '../../utils/envUtils.js'

export function isForkSubagentEnabled(): boolean {
  return isEnvTruthy(process.env.NYXCLAUDE_FORK_SUBAGENT)
}
