import { ConfluenceClient } from '../services/confluence-client.js'
import { DeletePageInput, DeletePageOutput } from '../types/tools.js'

export async function deletePage(
  confluenceClient: ConfluenceClient,
  input: DeletePageInput
): Promise<DeletePageOutput> {
  if (!input.pageId || input.pageId.trim().length === 0) {
    throw new Error('Page ID is required')
  }

  await confluenceClient.deletePage(input.pageId)

  return {
    success: true,
    pageId: input.pageId,
  }
}
