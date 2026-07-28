// NYX-AGENT: Chrome integration removed — stubbed to no-op
import type { MCPServerConnection } from '../services/mcp/types.js';
import type { PermissionMode } from '../types/permissions.js';

export function usePromptsFromClaudeInChrome(
  _mcpClients: MCPServerConnection[],
  _permissionMode: PermissionMode,
): void {
  // no-op
}
