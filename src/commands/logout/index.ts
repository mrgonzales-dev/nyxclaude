import type { Command } from '../../commands.js'
import { isEnvTruthy } from '../../utils/envUtils.js'

export default {
  type: 'local-jsx',
  name: 'logout',
  description: 'Sign out from your Anthropic account',
  // NYXCLAUDE: hidden (stubbed/disabled)
  isEnabled: () => false,
  isHidden: true,
  load: () => import('./logout.js'),
} satisfies Command
