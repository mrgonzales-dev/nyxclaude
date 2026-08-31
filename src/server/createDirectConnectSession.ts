export class DirectConnectError extends Error {
  override readonly name = 'DirectConnectError'
}
export async function createDirectConnectSession(_opts: unknown): Promise<never> {
  throw new DirectConnectError('Direct connect is not available in the terminal-only harness.')
}
