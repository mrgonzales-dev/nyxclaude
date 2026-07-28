import type { Command } from '../../commands.js'

const agents = {
  type: 'local-jsx',
  name: 'agents',
  description: 'Manage agent configurations',
  // NYXCLAUDE: hidden (not relevant to nyxclaude)
  isEnabled: () => false,
  isHidden: true,
  load: () => import('./agents.js'),
} satisfies Command

export default agents
