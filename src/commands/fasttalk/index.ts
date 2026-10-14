import type { Command } from '../../commands.js'
import { isFastTalkEnabled } from '../../utils/fastTalk.js'

const fasttalk = {
  type: 'local',
  name: 'fasttalk',
  get description() {
    return isFastTalkEnabled()
      ? '● fasttalk ON — replies 1-5 sentences (run /fasttalk to disable)'
      : '○ fasttalk OFF — replies 1-5 sentences when enabled (run /fasttalk to enable)'
  },
  argumentHint: '[on|off]',
  isHidden: false,
  supportsNonInteractive: true,
  load: () => import('./fasttalk.js'),
} satisfies Command

export default fasttalk
