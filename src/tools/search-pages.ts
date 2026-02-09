import { ConfluenceClient } from '../services/confluence-client.js'
import { SearchPagesInput, SearchPagesOutput } from '../types/tools.js'

export async function searchPages(
  confluenceClient: ConfluenceClient,
  input: SearchPagesInput
): Promise<SearchPagesOutput> {
  if (!input.query || input.query.trim().length === 0) {
    throw new Error('Search query is required')
  }

  const pages = await confluenceClient.searchPages(input.query, input.spaceKey)

  return {
    pages: pages.map((page) => ({
      id: page.id,
      title: page.title,
      spaceKey: page.spaceKey,
      url: page.links?.webui,
    })),
  }
}
