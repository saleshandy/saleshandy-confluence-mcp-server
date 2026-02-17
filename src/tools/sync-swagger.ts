import { ConfluenceClient } from '../services/confluence-client.js'
import { SwaggerParserService } from '../services/swagger-parser.js'
import { PostmanGenerator } from '../services/postman-generator.js'
import { DocGenerator } from '../services/doc-generator.js'
import { SyncSwaggerInput, SyncSwaggerOutput } from '../types/tools.js'

export async function syncSwaggerToConfluence(
  confluenceClient: ConfluenceClient,
  swaggerParser: SwaggerParserService,
  postmanGenerator: PostmanGenerator,
  docGenerator: DocGenerator,
  input: SyncSwaggerInput
): Promise<SyncSwaggerOutput> {
  if (!input.swaggerSource || input.swaggerSource.trim().length === 0) {
    throw new Error('Swagger source is required')
  }

  if (!input.spaceKey || input.spaceKey.trim().length === 0) {
    throw new Error('Space key is required')
  }

  const groupBy = input.groupBy || 'tag'

  // Parse swagger spec
  const swagger = input.swaggerSource.startsWith('http')
    ? await swaggerParser.parseFromUrl(input.swaggerSource)
    : await swaggerParser.parseFromFile(input.swaggerSource)

  const pages = []

  // Single page mode
  if (groupBy === 'single') {
    const postmanJson = JSON.stringify(postmanGenerator.generate(swagger), null, 2)
    const content = docGenerator.generateFullDocumentation(
      swagger,
      swaggerParser.groupEndpointsByTag(swagger.endpoints),
      postmanJson
    )

    const pageTitle = `${swagger.title} - API Documentation`
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

    pages.push({
      pageId: page.id,
      title: page.title,
      url: page.links?.webui || '',
      parentId: input.parentPageId,
    })
  } else {
    // Create parent page for grouped mode
    let parentPageId = input.parentPageId

    if (!parentPageId) {
      const parentTitle = `${swagger.title} - API Documentation`
      const parentPage = await confluenceClient.createPage({
        spaceKey: input.spaceKey,
        title: parentTitle,
        type: 'page',
        body: {
          storage: {
            value: `<p>API documentation for ${swagger.title} v${swagger.version}</p>`,
            representation: 'storage',
          },
        },
      })
      parentPageId = parentPage.id
      pages.push({
        pageId: parentPage.id,
        title: parentPage.title,
        url: parentPage.links?.webui || '',
      })
    }

    // Group by tag or path
    const groupedEndpoints =
      groupBy === 'tag'
        ? swaggerParser.groupEndpointsByTag(swagger.endpoints)
        : swaggerParser.groupEndpointsByPath(swagger.endpoints)

    // Create child pages for each group
    for (const [groupName, endpoints] of groupedEndpoints.entries()) {
      const groupPostmanJson = JSON.stringify(
        postmanGenerator.generate({ ...swagger, endpoints }),
        null,
        2
      )
      const groupContent = docGenerator.generateFullDocumentation(
        { ...swagger, endpoints },
        new Map([[groupName, endpoints]]),
        groupPostmanJson
      )

      const childPage = await confluenceClient.createPage({
        spaceKey: input.spaceKey,
        title: groupName,
        type: 'page',
        body: {
          storage: {
            value: groupContent,
            representation: 'storage',
          },
        },
        parentId: parentPageId,
      })

      pages.push({
        pageId: childPage.id,
        title: childPage.title,
        url: childPage.links?.webui || '',
        parentId: parentPageId,
      })
    }
  }

  return { pages }
}
