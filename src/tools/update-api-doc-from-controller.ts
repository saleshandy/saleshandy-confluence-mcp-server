import { ConfluenceClient } from '../services/confluence-client.js'
import { ControllerParserService } from '../services/controller-parser.js'
import { PostmanGenerator } from '../services/postman-generator.js'
import { DocGenerator } from '../services/doc-generator.js'
import { SwaggerParserService } from '../services/swagger-parser.js'
import { UpdateApiDocFromControllerInput, UpdateApiDocFromControllerOutput } from '../types/tools.js'

export async function updateApiDocFromController(
  confluenceClient: ConfluenceClient,
  controllerParser: ControllerParserService,
  postmanGenerator: PostmanGenerator,
  docGenerator: DocGenerator,
  swaggerParser: SwaggerParserService,
  input: UpdateApiDocFromControllerInput
): Promise<UpdateApiDocFromControllerOutput> {
  if (!input.pageId || input.pageId.trim().length === 0) {
    throw new Error('Page ID is required')
  }

  if (!input.controllerPath || input.controllerPath.trim().length === 0) {
    throw new Error('Controller path is required')
  }

  // Get existing page to preserve metadata
  const existingPage = await confluenceClient.getPage(input.pageId)

  // Parse controller(s)
  let swagger = input.controllerPath.endsWith('.controller.ts')
    ? await controllerParser.parseFromFile(input.controllerPath)
    : await controllerParser.parseFromDirectory(input.controllerPath)

  // Set base URL for Postman if provided
  if (input.baseUrl) {
    swagger.baseUrl = input.baseUrl
  }

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

  // Generate Postman collection
  const postmanJson = JSON.stringify(postmanGenerator.generate(swagger, input.baseUrl), null, 2)

  // Generate documentation with Postman
  const content = docGenerator.generateFullDocumentation(
    { ...swagger, endpoints },
    groupedEndpoints,
    postmanJson
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
