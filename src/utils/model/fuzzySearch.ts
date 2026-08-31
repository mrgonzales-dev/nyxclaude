import Fuse from 'fuse.js'

export type FuzzySearchableOption = {
  value: unknown
  label: string
  description?: string
}

const DEFAULT_THRESHOLD = 0.4

export function fuzzySearch<T extends FuzzySearchableOption>(
  options: T[],
  query: string,
): T[] {
  if (!query.trim()) {
    return options
  }

  const fuse = new Fuse(options, {
    keys: ['label', 'description'],
    threshold: DEFAULT_THRESHOLD,
    includeScore: true,
    shouldSort: true,
  })

  const results = fuse.search(query)
  return results.map(result => result.item)
}
