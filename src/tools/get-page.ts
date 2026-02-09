import { ConfluenceClient } from '../services/confluence-client.js'
import { GetPageInput, GetPageOutput } from '../types/tools.js'

export async function getPage(
  confluenceClient: ConfluenceClient,
  input: GetPageInput
): Promise<GetPageOutput> {
  if (!input.pageId || input.pageId.trim().length === 0) {
    throw new Error('Page ID is required')
  }

  const page = await confluenceClient.getPage(input.pageId)

  return {
    id: page.id,
    title: page.title,
    content: page.body?.storage.value || '',
    version: page.version?.number || 1,
  }
}
