export const NO_CONTENT_MESSAGE = '(no content)'

// Synthetic assistant message injected between tool results and a following
// user message on chat-completions transports that require strict
// user/assistant alternation (openaiShim/messageConversion.ts). Some models
// echo this verbatim as their own reply; the continuation-nudge logic in
// utils/continuation.ts treats an exact echo as a stop, not a stall.
export const TOOL_RESULTS_RECEIVED_MESSAGE = '[Tool results received]'
