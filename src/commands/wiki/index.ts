import type { Command } from '../../commands.js'

const wiki = {
  type: 'local-jsx',
  name: 'wiki',
  description: 'Initialize and inspect the Nyxclaude project wiki',
  argumentHint: '[init|status|scan|ingest <path>]',
  immediate: true,
  load: () => import('./wiki.js'),
} satisfies Command

export default wiki
