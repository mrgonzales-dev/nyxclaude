/**
 * Provider-neutral re-export of API types and error classes.
 *
 * This module is the single import point for all API-related types and errors.
 * Internally it currently delegates to @anthropic-ai/sdk, but every other file
 * in the codebase imports from here — not from the SDK directly.  This makes
 * the SDK a swappable implementation detail rather than a pervasive dependency.
 */

// --- Error classes (runtime) ---
export {
  APIConnectionError,
  APIConnectionTimeoutError,
  APIError,
  APIUserAbortError,
  AuthenticationError,
  NotFoundError,
} from '@anthropic-ai/sdk'

// --- Client (runtime, used only by services/api/client.ts) ---
export { default as Anthropic } from '@anthropic-ai/sdk'
export type { ClientOptions } from '@anthropic-ai/sdk'

// --- Message content block types ---
export type {
  Base64ImageSource,
  ContentBlock,
  ContentBlockParam,
  ImageBlockParam,
  RedactedThinkingBlock,
  RedactedThinkingBlockParam,
  TextBlockParam,
  ThinkingBlock,
  ThinkingBlockParam,
  ToolResultBlockParam,
  ToolUseBlock,
  ToolUseBlockParam,
} from '@anthropic-ai/sdk/resources/index.mjs'

// --- Beta message types ---
export type {
  BetaContentBlock,
  BetaContentBlockParam,
  BetaImageBlockParam,
  BetaJSONOutputFormat,
  BetaMessage,
  BetaMessageDeltaUsage,
  BetaMessageParam,
  BetaMessageStreamParams,
  BetaOutputConfig,
  BetaRawMessageStreamEvent,
  BetaRedactedThinkingBlock,
  BetaRequestDocumentBlock,
  BetaStopReason,
  BetaThinkingBlock,
  BetaTool,
  BetaToolChoiceAuto,
  BetaToolChoiceTool,
  BetaToolResultBlockParam,
  BetaToolUnion,
  BetaToolUseBlock,
  BetaUsage,
  BetaWebSearchTool20250305,
} from '@anthropic-ai/sdk/resources/beta/messages/messages.mjs'

// --- Aliases ---
export type { BetaMessageParam as MessageParam } from '@anthropic-ai/sdk/resources/beta/messages/messages.mjs'

// --- Streaming type ---
export type { Stream } from '@anthropic-ai/sdk/streaming.mjs'
