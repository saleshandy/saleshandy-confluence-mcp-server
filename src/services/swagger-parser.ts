import SwaggerParser from '@apidevtools/swagger-parser'
import axios from 'axios'
import * as fs from 'fs/promises'
import * as path from 'path'
import { SwaggerSpec, ParsedSwagger, ParsedEndpoint, Operation, Parameter } from '../types/swagger.js'

export class SwaggerParserService {
  async parseFromUrl(url: string): Promise<ParsedSwagger> {
    const spec = (await SwaggerParser.validate(url)) as unknown as SwaggerSpec
    return this.parseSpec(spec)
  }

  async parseFromFile(filePath: string): Promise<ParsedSwagger> {
    const absolutePath = path.resolve(filePath)
    const content = await fs.readFile(absolutePath, 'utf-8')
    const spec = JSON.parse(content) as SwaggerSpec
    await SwaggerParser.validate(spec as unknown as string)
    return this.parseSpec(spec)
  }

  async parseFromContent(content: string): Promise<ParsedSwagger> {
    const spec = JSON.parse(content) as SwaggerSpec
    await SwaggerParser.validate(spec as unknown as string)
    return this.parseSpec(spec)
  }

  private parseSpec(spec: SwaggerSpec): ParsedSwagger {
    const endpoints: ParsedEndpoint[] = []

    for (const [path, pathItem] of Object.entries(spec.paths)) {
      if (!pathItem) continue

      for (const [method, operation] of Object.entries(pathItem)) {
        if (method === 'parameters') continue

        const op = operation as Operation
        if (!op.responses) continue

        endpoints.push({
          path,
          method: method.toUpperCase(),
          tags: op.tags || ['default'],
          summary: op.summary || '',
          description: op.description || '',
          parameters: op.parameters || [],
          requestBody: op.requestBody,
          responses: op.responses,
          operationId: op.operationId,
        })
      }
    }

    const baseUrl = this.getBaseUrl(spec)

    return {
      title: spec.info.title,
      description: spec.info.description,
      version: spec.info.version,
      baseUrl,
      endpoints,
      tags: spec.tags || [],
    }
  }

  private getBaseUrl(spec: SwaggerSpec): string {
    if (spec.servers && spec.servers.length > 0) {
      return spec.servers[0].url
    }

    if (spec.schemes && spec.basePath) {
      return `${spec.schemes[0]}://${spec.host}${spec.basePath}`
    }

    return ''
  }

  filterEndpointsByTags(endpoints: ParsedEndpoint[], tags: string[]): ParsedEndpoint[] {
    return endpoints.filter((ep) => ep.tags.some((t) => tags.includes(t)))
  }

  filterEndpointsByPaths(endpoints: ParsedEndpoint[], pathPatterns: string[]): ParsedEndpoint[] {
    return endpoints.filter((ep) =>
      pathPatterns.some((pattern) => {
        const regex = new RegExp(`^${pattern.replace(/\*/g, '.*')}$`)
        return regex.test(ep.path)
      })
    )
  }

  groupEndpointsByTag(endpoints: ParsedEndpoint[]): Map<string, ParsedEndpoint[]> {
    const groups = new Map<string, ParsedEndpoint[]>()

    for (const endpoint of endpoints) {
      for (const tag of endpoint.tags) {
        if (!groups.has(tag)) {
          groups.set(tag, [])
        }
        groups.get(tag)!.push(endpoint)
      }
    }

    return groups
  }

  groupEndpointsByPath(endpoints: ParsedEndpoint[]): Map<string, ParsedEndpoint[]> {
    const groups = new Map<string, ParsedEndpoint[]>()

    for (const endpoint of endpoints) {
      const pathSegments = endpoint.path.split('/').slice(0, 2).join('/')
      if (!groups.has(pathSegments)) {
        groups.set(pathSegments, [])
      }
      groups.get(pathSegments)!.push(endpoint)
    }

    return groups
  }
}
