// ponytail: Anthropic Files API removed — not needed for basic terminal harness.
export type File = { id: string; filename: string; content_type: string; size: number }
export type FilesApiConfig = { apiKey: string; baseUrl: string }
export type DownloadResult = { success: boolean; path?: string; error?: string }
export type UploadResult = { success: boolean; fileId?: string; error?: string }

export async function downloadFile(_url: string, _config: FilesApiConfig): Promise<DownloadResult> {
  return { success: false, error: 'Files API not available' }
}
export function buildDownloadPath(_filename: string, _downloadDir: string): string { return '' }
export async function downloadAndSaveFile(_url: string, _filename: string, _downloadDir: string, _config: FilesApiConfig): Promise<DownloadResult> {
  return { success: false, error: 'Files API not available' }
}
export async function downloadSessionFiles(_files: File[], _downloadDir: string, _config: FilesApiConfig): Promise<DownloadResult[]> { return [] }
export async function uploadFile(_filePath: string, _config: FilesApiConfig): Promise<UploadResult> {
  return { success: false, error: 'Files API not available' }
}
export async function uploadSessionFiles(_filePaths: string[], _config: FilesApiConfig): Promise<UploadResult[]> { return [] }
export function parseFileSpecs(_fileSpecs: string[]): File[] { return [] }
