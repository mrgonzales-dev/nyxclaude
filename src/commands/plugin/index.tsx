import type { Command } from '../../commands.js';
const plugin = {
  type: 'local-jsx',
  name: 'plugin',
  aliases: ['plugins', 'marketplace'],
  description: 'Manage Nyxclaude plugins',
  // NYXCLAUDE: hidden (stubbed/disabled)
  isEnabled: () => false,
  isHidden: true,
  immediate: true,
  load: () => import('./plugin.js')
} satisfies Command;
export default plugin;
