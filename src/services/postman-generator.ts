import { ParsedSwagger, ParsedEndpoint } from '../types/swagger.js'
import {
  PostmanCollection,
  PostmanItem,
  PostmanRequest,
  PostmanHeader,
  PostmanUrl,
  PostmanBody,
  PostmanVariable,
} from '../types/postman.js'

export class PostmanGenerator {
  generate(swagger: ParsedSwagger, baseUrl?: string): PostmanCollection {
    const finalBaseUrl = baseUrl || swagger.baseUrl || 'https://pyxis.lifeisgoodforlearner.com/api/edge'

    const items: PostmanItem[] = swagger.endpoints.map((endpoint) =>
      this.createRequestItem(endpoint, finalBaseUrl)
    )

    return {
      info: {
        name: swagger.title,
        description: swagger.description,
        schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
      },
      item: items,
      variable: this.createVariables(finalBaseUrl),
      auth: {
        type: 'bearer',
        bearer: [
          {
            key: 'token',
            value: '<your_api_token>',
            type: 'string',
          },
        ],
      },
    }
  }

  private createRequestItem(endpoint: ParsedEndpoint, baseUrl: string): PostmanItem {
    const pathWithVars = this.replacePathVariables(endpoint.path)
    const url = this.buildUrl(baseUrl, pathWithVars, endpoint)

    return {
      name: `${endpoint.method} ${endpoint.path}`,
      description: endpoint.description || endpoint.summary || '',
      request: {
        method: endpoint.method,
        header: this.createHeaders(),
        body: endpoint.requestBody ? this.createBody(endpoint.requestBody) : undefined,
        url,
        auth: {
          type: 'bearer',
          bearer: [
            {
              key: 'token',
              value: '{{api_token}}',
              type: 'string',
            },
          ],
        },
      },
    }
  }

  private replacePathVariables(path: string): string {
    return path.replace(/{([^}]+)}/g, ':$1')
  }

  private buildUrl(
    baseUrl: string,
    pathWithVars: string,
    endpoint: ParsedEndpoint
  ): PostmanUrl {
    const queryParams = endpoint.parameters
      ?.filter((p) => p.in === 'query')
      .map((p) => ({
        key: p.name,
        value: this.getParamExampleValue(p),
        disabled: false,
      })) || []

    // Replace path variables with {{variable}} format
    let path = endpoint.path.replace(/{([^}]+)}/g, '{{$1}}')

    const rawUrl = queryParams.length > 0
      ? `${baseUrl}${path}?${queryParams.map((p) => `${p.key}={{${p.key}}}`).join('&')}`
      : `${baseUrl}${path}`

    return {
      raw: rawUrl,
      protocol: baseUrl.split('://')[0],
      host: [baseUrl.split('://')[1]?.split('/')[0] || 'api.example.com'],
      path: path.split('/').filter((p) => p),
      query: queryParams,
    }
  }

  private createHeaders(): PostmanHeader[] {
    return [
      {
        key: 'Content-Type',
        value: 'application/json',
        type: 'text',
      },
      {
        key: 'Accept',
        value: 'application/json',
        type: 'text',
      },
    ]
  }

  private createBody(requestBody: any): PostmanBody | undefined {
    if (!requestBody || !requestBody.content) return undefined

    const jsonContent = requestBody.content['application/json']
    if (!jsonContent || !jsonContent.schema) return undefined

    const schema = jsonContent.schema
    const exampleObj = jsonContent.example || this.generateSchemaExample(schema)

    return {
      mode: 'raw',
      raw: JSON.stringify(exampleObj, null, 2),
      options: {
        raw: {
          language: 'json',
        },
      },
    }
  }

  private generateSchemaExample(schema: any): Record<string, any> {
    if (!schema) return {}

    const example: Record<string, any> = {}

    if (schema.properties) {
      for (const [key, prop] of Object.entries(schema.properties)) {
        example[key] = this.getExampleForSchema(prop as any, key)
      }
    }

    return example
  }

  private getExampleForSchema(schema: any, fieldName: string): any {
    if (schema.example !== undefined) return schema.example
    if (schema.enum) return schema.enum[0]

    switch (schema.type) {
      case 'string':
        return `<${fieldName}>`
      case 'number':
      case 'integer':
        return 1
      case 'boolean':
        return false
      case 'array':
        return [this.getExampleForSchema(schema.items || { type: 'string' }, 'item')]
      case 'object':
        return schema.properties ? this.generateSchemaExample(schema) : {}
      default:
        return `<${fieldName}>`
    }
  }

  private getParamExampleValue(param: any): string {
    if (param.example !== undefined) return String(param.example)
    const schema = param.schema || {}
    if (schema.enum) return String(schema.enum[0])
    if (schema.type === 'number' || schema.type === 'integer') return '1'
    return `<${param.name}>`
  }

  private createVariables(baseUrl: string): PostmanVariable[] {
    return [
      {
        key: 'baseUrl',
        value: baseUrl,
        type: 'string',
      },
      {
        key: 'api_token',
        value: '<your_api_token>',
        type: 'string',
      },
    ]
  }
}
