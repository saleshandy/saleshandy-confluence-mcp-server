import { Tool } from '@modelcontextprotocol/sdk/types.js'
import { ConfluenceClient } from '../services/confluence-client.js'
import { SwaggerParserService } from '../services/swagger-parser.js'
import { DocGenerator } from '../services/doc-generator.js'
import { listSpaces } from './list-spaces.js'
import { searchPages } from './search-pages.js'
import { getPage } from './get-page.js'
import { createApiDoc } from './create-api-doc.js'
import { updateApiDoc } from './update-api-doc.js'
import { syncSwaggerToConfluence } from './sync-swagger.js'
import { deletePage } from './delete-page.js'

export function defineTools(): Tool[] {
  return [
    {
      name: 'list_spaces',
      description: 'List all available Confluence spaces',
      inputSchema: {
        type: 'object' as const,
        properties: {},
        required: [],
      },
    },
    {
      name: 'search_pages',
      description: 'Search for existing pages in Confluence',
      inputSchema: {
        type: 'object' as const,
        properties: {
          query: {
            type: 'string',
            description: 'Search query term',
          },
          spaceKey: {
            type: 'string',
            description: 'Optional: limit search to a specific space key',
          },
        },
        required: ['query'],
      },
    },
    {
      name: 'get_page',
      description: 'Get the content of an existing Confluence page',
      inputSchema: {
        type: 'object' as const,
        properties: {
          pageId: {
            type: 'string',
            description: 'The Confluence page ID',
          },
        },
        required: ['pageId'],
      },
    },
    {
      name: 'create_api_doc',
      description: 'Create a new API documentation page from a Swagger/OpenAPI specification',
      inputSchema: {
        type: 'object' as const,
        properties: {
          swaggerSource: {
            type: 'string',
            description: 'URL or file path to the Swagger/OpenAPI specification',
          },
          spaceKey: {
            type: 'string',
            description: 'Target Confluence space key',
          },
          parentPageId: {
            type: 'string',
            description: 'Optional: parent page ID for nesting',
          },
          title: {
            type: 'string',
            description: 'Optional: custom page title (defaults to API title)',
          },
          filterTags: {
            type: 'array',
            items: { type: 'string' },
            description: 'Optional: only include endpoints with these tags',
          },
          filterPaths: {
            type: 'array',
            items: { type: 'string' },
            description: 'Optional: only include endpoints matching these path patterns',
          },
        },
        required: ['swaggerSource', 'spaceKey'],
      },
    },
    {
      name: 'update_api_doc',
      description: 'Update an existing API documentation page with new Swagger/OpenAPI spec',
      inputSchema: {
        type: 'object' as const,
        properties: {
          pageId: {
            type: 'string',
            description: 'Existing Confluence page ID to update',
          },
          swaggerSource: {
            type: 'string',
            description: 'URL or file path to the Swagger/OpenAPI specification',
          },
          filterTags: {
            type: 'array',
            items: { type: 'string' },
            description: 'Optional: only include endpoints with these tags',
          },
          filterPaths: {
            type: 'array',
            items: { type: 'string' },
            description: 'Optional: only include endpoints matching these path patterns',
          },
        },
        required: ['pageId', 'swaggerSource'],
      },
    },
    {
      name: 'sync_swagger_to_confluence',
      description: 'Sync a Swagger/OpenAPI spec to Confluence, optionally creating nested pages',
      inputSchema: {
        type: 'object' as const,
        properties: {
          swaggerSource: {
            type: 'string',
            description: 'URL or file path to the Swagger/OpenAPI specification',
          },
          spaceKey: {
            type: 'string',
            description: 'Target Confluence space key',
          },
          parentPageId: {
            type: 'string',
            description: 'Optional: parent page ID for organizing documentation',
          },
          groupBy: {
            type: 'string',
            enum: ['tag', 'path', 'single'],
            description: 'How to organize pages: tag (separate pages per tag), path (separate pages per path), or single (all on one page)',
          },
        },
        required: ['swaggerSource', 'spaceKey'],
      },
    },
    {
      name: 'delete_page',
      description: 'Delete a Confluence page',
      inputSchema: {
        type: 'object' as const,
        properties: {
          pageId: {
            type: 'string',
            description: 'The Confluence page ID to delete',
          },
        },
        required: ['pageId'],
      },
    },
  ]
}

export async function executeTool(
  name: string,
  input: Record<string, unknown>,
  confluenceClient: ConfluenceClient,
  swaggerParser: SwaggerParserService,
  docGenerator: DocGenerator
): Promise<unknown> {
  switch (name) {
    case 'list_spaces':
      return await listSpaces(confluenceClient, input as any)
    case 'search_pages':
      return await searchPages(confluenceClient, input as any)
    case 'get_page':
      return await getPage(confluenceClient, input as any)
    case 'create_api_doc':
      return await createApiDoc(confluenceClient, swaggerParser, docGenerator, input as any)
    case 'update_api_doc':
      return await updateApiDoc(confluenceClient, swaggerParser, docGenerator, input as any)
    case 'sync_swagger_to_confluence':
      return await syncSwaggerToConfluence(confluenceClient, swaggerParser, docGenerator, input as any)
    case 'delete_page':
      return await deletePage(confluenceClient, input as any)
    default:
      throw new Error(`Unknown tool: ${name}`)
  }
}
