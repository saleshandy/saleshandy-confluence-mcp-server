import { ConfluenceClient } from '../services/confluence-client.js'
import { ListSpacesInput, ListSpacesOutput } from '../types/tools.js'

export async function listSpaces(
  confluenceClient: ConfluenceClient,
  _input: ListSpacesInput
): Promise<ListSpacesOutput> {
  const spaces = await confluenceClient.listSpaces()

  return {
    spaces: spaces.map((space) => ({
      id: space.id,
      key: space.key,
      name: space.name,
    })),
  }
}
