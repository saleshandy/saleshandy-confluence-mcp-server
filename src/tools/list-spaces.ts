import { ConfluenceClient } from '../services/confluence-client.js'
import { ListSpacesInput, ListSpacesOutput } from '../types/tools.js'

export async function listSpaces(
  confluenceClient: ConfluenceClient,
  _input: ListSpacesInput
): Promise<ListSpacesOutput> {
  console.error('[ListSpaces Tool] Starting listSpaces...')
  const spaces = await confluenceClient.listSpaces()
  console.error('[ListSpaces Tool] Received spaces:', JSON.stringify(spaces, null, 2))

  const mapped = spaces.map((space) => ({
    id: space.id,
    key: space.key,
    name: space.name,
  }))
  console.error('[ListSpaces Tool] Mapped spaces:', JSON.stringify(mapped, null, 2))

  return {
    spaces: mapped,
  }
}
