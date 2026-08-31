export const REPO_MAP_TOOL_NAME = 'RepoMap'

export function getDescription(): string {
  return `Builds a repo map: a ranked summary of files by importance. Use to understand project structure without reading every file. Parameters: max_tokens (optional, default auto-detects).`
}
