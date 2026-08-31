// ponytail: Mock rate limits removed — Anthropic internal testing feature.
export type MockHeaderKey = string
export type MockScenario = string
export function setMockHeader(_key: MockHeaderKey, _value: string): void {}
export function addExceededLimit(_scenario: MockScenario): void {}
export function setMockEarlyWarning(_scenario: MockScenario): void {}
export function getMockSubscriptionType(): string | null { return null }
export function shouldUseMockSubscription(): boolean { return false }
export function clearMockRateLimits(): void {}
