// NYX: bridge deleted, stubbed
import { useCallback } from 'react'
import type { Command } from '../commands.js'
import type { Message } from '../types/message.js'

export const BRIDGE_FAILURE_DISMISS_MS = 10_000

export function useReplBridge(
  _messages: Message[],
  _setMessages: (action: React.SetStateAction<Message[]>) => void,
  _abortControllerRef: React.RefObject<AbortController | null>,
  _commands: readonly Command[],
  _mainLoopModel: string,
): {
  sendBridgeResult: () => void
} {
  const sendBridgeResult = useCallback(() => {}, [])
  return {
    sendBridgeResult,
  }
}
