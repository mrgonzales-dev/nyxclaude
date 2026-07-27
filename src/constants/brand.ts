/**
 * NYX-AGENT brand identity — single source of truth for the product name,
 * tagline, accent color, and wordmark art used across the TUI.
 *
 * The accent is cyan. Theme entries derived from it MUST stay
 * in `rgb(r,g,b)` form (never hex): the spinner's shimmer/stall interpolation
 * parses theme values with `parseRGB`, which only matches `rgb(...)` strings.
 */

export const BRAND_NAME = 'nyx-agent'

export const BRAND_TAGLINE = 'AI harness · omniroute'

/** cyan (#00bcb4) in the rgb() form required by theme consumers. */
export const BRAND_ACCENT_RGB = 'rgb(0,188,180)'

/**
 * NYX wordmark — 6 rows of ANSI Shadow ASCII art.
 * Generated with figlet, font: ANSI Shadow.
 */
export const WORDMARK = [
  '███╗   ██╗██╗   ██╗██╗  ██╗',
  '████╗  ██║╚██╗ ██╔╝╚██╗██╔╝',
  '██╔██╗ ██║ ╚████╔╝  ╚███╔╝',
  '██║╚██╗██║  ╚██╔╝   ██╔██╗',
  '██║ ╚████║   ██║   ██╔╝ ██╗',
  '╚═╝  ╚═══╝   ╚═╝   ╚═╝  ╚═╝',
] as const

/** Rendered width of the wordmark. */
export const WORDMARK_WIDTH = WORDMARK[0].length
