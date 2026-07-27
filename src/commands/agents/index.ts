import type { Command } from '../../commands.js'

const agents = {
  type: 'local-jsx',
  name: 'agents',
  description: 'Manage agent configurations',
  // NYX-AGENT: hidden (not relevant to nyx-agent)
  isEnabled: () => false,
  isHidden: true,
  load: () => import('./agents.js'),
} satisfies Command

export default agents
