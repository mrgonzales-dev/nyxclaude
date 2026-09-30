import { describe, test, expect } from 'bun:test'
import { DiagnosticTrackingService } from './diagnosticTracking.js'
import type { Diagnostic, DiagnosticFile } from './diagnosticTracking.js'

function diagnostic(overrides: Partial<Diagnostic> = {}): Diagnostic {
  return {
    message: 'test diagnostic',
    severity: 'Error',
    range: {
      start: { line: 0, character: 0 },
      end: { line: 0, character: 5 },
    },
    ...overrides,
  }
}

describe('DiagnosticTrackingService', () => {
  describe('getSeveritySymbol', () => {
    test('returns a symbol for each severity', () => {
      for (const severity of ['Error', 'Warning', 'Info', 'Hint'] as const) {
        expect(
          DiagnosticTrackingService.getSeveritySymbol(severity),
        ).toBeTruthy()
      }
    })
  })

  describe('formatDiagnosticsSummary', () => {
    test('formats files with diagnostics', () => {
      const files: DiagnosticFile[] = [
        {
          uri: 'file:///repo/src/foo.ts',
          diagnostics: [
            diagnostic({ message: 'Cannot find name', code: 'TS2304' }),
          ],
        },
      ]

      const result = DiagnosticTrackingService.formatDiagnosticsSummary(files)
      expect(result).toContain('foo.ts')
      expect(result).toContain('Cannot find name')
      expect(result).toContain('[Line 1:1]')
      expect(result).toContain('[TS2304]')
    })

    test('returns empty string for no files', () => {
      expect(DiagnosticTrackingService.formatDiagnosticsSummary([])).toBe('')
    })

    test('truncates output beyond the max length', () => {
      const files: DiagnosticFile[] = [
        {
          uri: 'file:///repo/big.ts',
          diagnostics: [diagnostic({ message: 'x'.repeat(5000) })],
        },
      ]

      const result = DiagnosticTrackingService.formatDiagnosticsSummary(files)
      expect(result.endsWith('…[truncated]')).toBe(true)
      expect(result.length).toBeLessThanOrEqual(4000)
    })
  })
})
