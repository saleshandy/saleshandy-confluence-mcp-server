import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js'
import { ConfluenceClient } from './services/confluence-client.js'
import { SwaggerParserService } from './services/swagger-parser.js'
import { DocGenerator } from './services/doc-generator.js'
import { defineTools, executeTool } from './tools/index.js'

export class ConfluenceApiDocsMcpServer {
  private server: Server
  private confluenceClient: ConfluenceClient
  private swaggerParser: SwaggerParserService
  private docGenerator: DocGenerator

  constructor(baseUrl: string, email: string, apiToken: string) {
    this.confluenceClient = new ConfluenceClient(baseUrl, email, apiToken)
    this.swaggerParser = new SwaggerParserService()
    this.docGenerator = new DocGenerator()

    this.server = new Server(
      {
        name: 'confluence-api-docs',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    )

    this.setupHandlers()
  }

  private setupHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: defineTools(),
      }
    })

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params
      try {
        const result = await executeTool(
          name,
          args as Record<string, unknown>,
          this.confluenceClient,
          this.swaggerParser,
          this.docGenerator
        )
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(result, null, 2),
            },
          ],
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        return {
          content: [
            {
              type: 'text' as const,
              text: `Error: ${errorMessage}`,
            },
          ],
          isError: true,
        }
      }
    })
  }

  async run() {
    const transport = new StdioServerTransport()
    await this.server.connect(transport)
    console.error('Confluence API Docs MCP server started')
  }
}
