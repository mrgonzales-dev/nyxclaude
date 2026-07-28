import type { Command } from '../../commands.js'

const mobile = {
  type: 'local-jsx',
  name: 'mobile',
  aliases: ['ios', 'android'],
  description: 'Show QR code to download the Nyxclaude mobile app',
  // NYX-AGENT: hidden (stubbed/disabled)
  isEnabled: () => false,
  isHidden: true,
  load: () => import('./mobile.js'),
} satisfies Command

export default mobile
