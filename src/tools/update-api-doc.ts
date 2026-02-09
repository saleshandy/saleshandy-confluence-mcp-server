import { ConfluenceClient } from '../services/confluence-client.js'
import { SwaggerParserService } from '../services/swagger-parser.js'
import { DocGenerator } from '../services/doc-generator.js'
import { UpdateApiDocInput, UpdateApiDocOutput } from '../types/tools.js'

export async function updateApiDoc(
  confluenceClient: ConfluenceClient,
  swaggerParser: SwaggerParserService,
  docGenerator: DocGenerator,
  input: UpdateApiDocInput
): Promise<UpdateApiDocOutput> {
  if (!input.pageId || input.pageId.trim().length === 0) {
    throw new Error('Page ID is required')
  }

  if (!input.swaggerSource || input.swaggerSource.trim().length === 0) {
    throw new Error('Swagger source is required')
  }

  // Get existing page
  const existingPage = await confluenceClient.getPage(input.pageId)

  // Parse swagger spec
  let swagger = input.swaggerSource.startsWith('http')
    ? await swaggerParser.parseFromUrl(input.swaggerSource)
    : await swaggerParser.parseFromFile(input.swaggerSource)

  // Filter by tags or paths if specified
  let endpoints = swagger.endpoints
  if (input.filterTags && input.filterTags.length > 0) {
    endpoints = swaggerParser.filterEndpointsByTags(endpoints, input.filterTags)
  }
  if (input.filterPaths && input.filterPaths.length > 0) {
    endpoints = swaggerParser.filterEndpointsByPaths(endpoints, input.filterPaths)
  }

  // Group by tag
  const groupedEndpoints = swaggerParser.groupEndpointsByTag(endpoints)

  // Generate documentation
  const content = docGenerator.generateFullDocumentation(
    { ...swagger, endpoints },
    groupedEndpoints
  )

  // Update page
  const updatedPage = await confluenceClient.updatePage({
    id: input.pageId,
    spaceKey: existingPage.spaceKey || '',
    title: existingPage.title,
    type: 'page',
    version: {
      number: (existingPage.version?.number || 0) + 1,
    },
    body: {
      storage: {
        value: content,
        representation: 'storage',
      },
    },
  })

  return {
    pageId: updatedPage.id,
    title: updatedPage.title,
    url: updatedPage.links?.webui || '',
    version: updatedPage.version?.number || 1,
  }
}
