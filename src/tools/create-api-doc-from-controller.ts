import { ConfluenceClient } from '../services/confluence-client.js'
import { ControllerParserService } from '../services/controller-parser.js'
import { PostmanGenerator } from '../services/postman-generator.js'
import { DocGenerator } from '../services/doc-generator.js'
import { SwaggerParserService } from '../services/swagger-parser.js'
import { CreateApiDocFromControllerInput, CreateApiDocFromControllerOutput } from '../types/tools.js'

export async function createApiDocFromController(
  confluenceClient: ConfluenceClient,
  controllerParser: ControllerParserService,
  postmanGenerator: PostmanGenerator,
  docGenerator: DocGenerator,
  swaggerParser: SwaggerParserService,
  input: CreateApiDocFromControllerInput
): Promise<CreateApiDocFromControllerOutput> {
  if (!input.controllerPath || input.controllerPath.trim().length === 0) {
    throw new Error('Controller path is required')
  }

  if (!input.spaceKey || input.spaceKey.trim().length === 0) {
    throw new Error('Space key is required')
  }

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
