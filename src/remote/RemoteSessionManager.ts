export type RemoteSessionConfig = {
  sessionId: string
  hasInitialPrompt?: boolean
  viewerOnly?: boolean
}
export function createRemoteSessionConfig(
  sessionId: string,
  _getAccessToken: () => string,
  _orgUUID: string,
  hasInitialPrompt?: boolean,
  viewerOnly?: boolean,
): RemoteSessionConfig {
  return { sessionId, hasInitialPrompt, viewerOnly }
}
