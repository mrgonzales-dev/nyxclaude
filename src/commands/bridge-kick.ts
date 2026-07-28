// NYX: bridge deleted, stubbed
import type { Command } from '../commands.js'
import type { LocalCommandCall } from '../types/command.js'

const call: LocalCommandCall = async () => {
  return {
    type: 'text',
    value: 'Remote Control is not available in this build.',
  }
}

const bridgeKick = {
  type: 'local',
  name: 'bridge-kick',
  description: 'Inject bridge failure states for manual recovery testing',
  // NYXCLAUDE: hidden (stubbed/disabled)
  isEnabled: () => false,
  isHidden: true,
  supportsNonInteractive: false,
  load: () => Promise.resolve({ call }),
} satisfies Command

export default bridgeKick
