import type { LocalCommandCall } from '../../types/command.js'
import { isEnvTruthy } from '../../utils/envUtils.js'
import {
  isFastTalkEnabled,
  setFastTalkEnabled,
} from '../../utils/fastTalk.js'

export const call: LocalCommandCall = async args => {
  const normalized = (args ?? '').trim().toLowerCase()
  if (isEnvTruthy(process.env.NYXCLAUDE_FASTTALK)) {
    return {
      type: 'text',
      value: 'fasttalk forced ON by NYXCLAUDE_FASTTALK env — unset it to toggle.',
    }
  }
  if (normalized === 'on' || normalized === 'enable') {
    setFastTalkEnabled(true)
    return {
      type: 'text',
      value: 'fasttalk ON — replies limited to 1-5 sentences. Tasks still run fully via tools.',
    }
  }
  if (normalized === 'off' || normalized === 'disable') {
    setFastTalkEnabled(false)
    return { type: 'text', value: 'fasttalk OFF — normal replies resumed.' }
  }
  if (normalized === 'status') {
    return {
      type: 'text',
      value: isFastTalkEnabled() ? 'fasttalk ON' : 'fasttalk OFF',
    }
  }
  if (normalized === '' || normalized === 'toggle') {
    // Bare /fasttalk toggles, matching user request.
    const next = !isFastTalkEnabled()
    setFastTalkEnabled(next)
    return {
      type: 'text',
      value: next
        ? 'fasttalk ON — replies limited to 1-5 sentences. Tasks still run fully via tools.'
        : 'fasttalk OFF — normal replies resumed.',
    }
  }
  return {
    type: 'text',
    value: `Unknown arg '${args}'. Usage: /fasttalk [on|off]`,
  }
}
