import { isPDFSupported } from '../../utils/pdfUtils.js'
import { BASH_TOOL_NAME } from '../BashTool/toolName.js'
import { FILE_READ_TOOL_NAME } from './constants.js'
export { FILE_READ_TOOL_NAME } from './constants.js'

export const FILE_UNCHANGED_STUB =
  'File unchanged since last read. The content from the earlier Read tool_result in this conversation is still current — refer to that instead of re-reading.'

export const MAX_LINES_TO_READ = 2000

export const DESCRIPTION = 'Read a file from the local filesystem.'

export const LINE_FORMAT_INSTRUCTION =
  '- Results are returned using cat -n format, with line numbers starting at 1'

export const OFFSET_INSTRUCTION_DEFAULT =
  "- You can optionally specify a line offset and limit (especially handy for long files), but it's recommended to read the whole file by not providing these parameters"

export const OFFSET_INSTRUCTION_TARGETED =
  '- When you already know which part of the file you need, only read that part. This can be important for larger files.'

/**
 * Renders the Read tool prompt template.  The caller (FileReadTool) supplies
 * the runtime-computed parts.
 */
export function renderPromptTemplate(
  lineFormat: string,
  maxSizeInstruction: string,
  offsetInstruction: string,
): string {
  return `Read a file from the filesystem. Provide an absolute path.
Reads up to ${MAX_LINES_TO_READ} lines by default. ${maxSizeInstruction}
${offsetInstruction}
${lineFormat}
- Supports images (PNG, JPG), PDFs${isPDFSupported() ? ' (use pages param for 10+ pages)' : ''}, and Jupyter notebooks (.ipynb).
- Use ${BASH_TOOL_NAME} with ls to list directories, not this tool.`
}
