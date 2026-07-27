// NYX: firecrawl deleted, stubbed
export async function firecrawlScrape(_url: string, _options?: any): Promise<{ markdown?: string }> {
  return { markdown: '' }
}
export async function firecrawlSearch(_query: string, _options?: any): Promise<{ web?: { url: string; title?: string; description?: string }[] }> {
  return { web: [] }
}
