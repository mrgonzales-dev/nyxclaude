// ponytail: Rate limit mocking removed — Anthropic internal testing feature.
export function processRateLimitHeaders(_headers: unknown): void {}
export function shouldProcessRateLimits(_isSubscriber: boolean): boolean { return false }
export function checkMockRateLimitError(_error: unknown): unknown | null { return null }
export function isMockRateLimitError(_error: unknown): boolean { return false }
export function shouldProcessMockLimits(): boolean { return false }
