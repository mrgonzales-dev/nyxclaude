// NYXCLAUDE: Memory system fully removed. This file provides stub
// implementations for all the functions/types that other modules import
// from the deleted memdir/, autoDream/, extractMemories/, teamMemorySync/
// directories. Everything returns false/null/empty/no-op.

export function isAutoMemoryEnabled(): boolean { return false }
export function isExtractModeActive(): boolean { return false }
export function getAutoMemPath(): string { return '' }
export function getAutoMemEntrypoint(): string { return '' }
export function hasAutoMemPathOverride(): boolean { return false }
export function isAutoMemPath(_path: string): boolean { return false }
export function getMemoryBaseDir(): string { return '' }
export function isTeamMemFile(_path: string): boolean { return false }

export async function loadMemoryPrompt(): Promise<string | null> { return null }
export function truncateEntrypointContent(content: string): string { return content }

export function memoryFreshnessNote(_path: string): string { return '' }
export function memoryAge(_path: string): number { return 0 }
export function memoryFreshnessText(_age: number): string { return '' }

export async function findRelevantMemories(): Promise<unknown[]> { return [] }

export function initAutoDream(): void {}
export async function executeAutoDream(): Promise<void> {}
export async function buildConsolidationPrompt(): Promise<string> { return '' }
export async function rollbackConsolidationLock(): Promise<void> {}
export async function tryAcquireConsolidationLock(): Promise<boolean> { return false }

export function initExtractMemories(): void {}
export async function drainPendingExtraction(): Promise<void> {}
export async function executeExtractMemories(): Promise<void> {}
export function createAutoMemCanUseTool(): () => Promise<never[]> {
  return async () => []
}

export function checkTeamMemSecrets(_content: string, _path: string): string | null { return null }
export function redactSecrets(content: string): string { return content }

export type DreamTaskState = {
  id: string
  type: 'dream'
  status: 'running' | 'pending' | 'completed' | 'killed'
  description: string
  toolUseId?: string
  startTime: number
  endTime?: number
  totalPausedMs?: number
  outputFile: string
  outputOffset: number
  notified: boolean
}
export const DreamTask = null as unknown
