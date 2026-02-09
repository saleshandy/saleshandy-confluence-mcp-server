import { ConfluenceClient } from '../services/confluence-client.js'
import { SwaggerParserService } from '../services/swagger-parser.js'
import { DocGenerator } from '../services/doc-generator.js'
import { CreateApiDocInput, CreateApiDocOutput } from '../types/tools.js'

export async function createApiDoc(
  confluenceClient: ConfluenceClient,
  swaggerParser: SwaggerParserService,
  docGenerator: DocGenerator,
  input: CreateApiDocInput
): Promise<CreateApiDocOutput> {
  if (!input.swaggerSource || input.swaggerSource.trim().length === 0) {
    throw new Error('Swagger source is required')
  }

  if (!input.spaceKey || input.spaceKey.trim().length === 0) {
    throw new Error('Space key is required')
  }

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

  // Create page
  const pageTitle = input.title || `${swagger.title} - API Documentation`
  const page = await confluenceClient.createPage({
    spaceKey: input.spaceKey,
    title: pageTitle,
    type: 'page',
    body: {
      storage: {
        value: content,
        representation: 'storage',
      },
    },
    parentId: input.parentPageId,
  })

  return {
    pageId: page.id,
    title: page.title,
    url: page.links?.webui || '',
  }
}
