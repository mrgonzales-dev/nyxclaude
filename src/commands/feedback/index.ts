import type { Command } from '../../commands.js'
const feedback = {
  aliases: ['bug'],
  type: 'local-jsx',
  name: 'feedback',
  description: `Submit feedback about Nyxclaude`,
  argumentHint: '[report]',
  // NYXCLAUDE: hidden (stubbed/disabled)
  isEnabled: () => false,
  isHidden: true,
  load: () => import('./feedback.js'),
} satisfies Command

export default feedback
