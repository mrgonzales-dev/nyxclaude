// NYXCLAUDE: OAuth auth code listener removed — stub for backward compat.

export class AuthCodeListener {
  constructor(..._args: unknown[]) {}
  async waitForCode(): Promise<string | null> { return null }
  close(): void {}
}
