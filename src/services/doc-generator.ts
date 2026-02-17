import { ParsedSwagger, ParsedEndpoint } from '../types/swagger.js'

interface SchemaProperty {
  name: string
  type: string
  required: boolean
  description: string
  example?: string
}

interface ResolvedRequestBody {
  description?: string
  properties: SchemaProperty[]
  jsonExample: string
}

export class DocGenerator {
  private schemas: Record<string, any> = {}
  private baseUrl = ''

  setSchemas(schemas: Record<string, any>) {
    this.schemas = schemas
  }

  setBaseUrl(baseUrl: string) {
    this.baseUrl = baseUrl
  }

  generateFullDocumentation(
    swagger: ParsedSwagger,
    groupedEndpoints: Map<string, ParsedEndpoint[]>,
    postmanJson?: string
  ): string {
    let html = '<h1>' + this.escapeHtml(swagger.title) + '</h1>\n'

    if (swagger.description) {
      html += '<p>' + this.escapeHtml(swagger.description) + '</p>\n'
    }

    html += this.generateOverview(swagger)

    for (const [groupName, endpoints] of groupedEndpoints.entries()) {
      html += `\n<h2>${this.escapeHtml(groupName)}</h2>\n`
      for (const endpoint of endpoints) {
        html += this.generateEndpointDocumentation(endpoint)
      }
    }

    if (postmanJson) {
      html += this.generatePostmanSection(postmanJson)
    }

    return html
  }

  private generateOverview(swagger: ParsedSwagger): string {
    let html = '<h2>API Overview</h2>\n'
    html += `<p><strong>Version:</strong> ${swagger.version}</p>\n`
    const displayBaseUrl = swagger.baseUrl || this.baseUrl || 'https://pyxis.lifeisgoodforlearner.com/api/edge'
    html += `<p><strong>Base URL:</strong> <code>${this.escapeHtml(displayBaseUrl)}</code></p>\n`
    return html
  }

  private generateEndpointDocumentation(endpoint: ParsedEndpoint): string {
    const resolvedBody = this.resolveRequestBody(endpoint.requestBody)
    const curlExample = this.generateCurlExample(endpoint, resolvedBody)

    let html = '<ac:structured-macro ac:name="panel">\n'
    html += '  <ac:parameter ac:name="bgColor">#f0f0f0</ac:parameter>\n'
    html += `  <ac:parameter ac:name="title">${endpoint.method} ${endpoint.path}</ac:parameter>\n`
    html += '  <ac:rich-text-body>\n'
    html += `    <p><strong>${this.escapeHtml(endpoint.summary || endpoint.path)}</strong></p>\n`

    if (endpoint.description) {
      html += `    <p>${this.escapeHtml(endpoint.description)}</p>\n`
    }

    // Parameters table
    if (endpoint.parameters && endpoint.parameters.length > 0) {
      html += '    <h4>Parameters</h4>\n'
      html += '    <table>\n'
      html += '      <tr><th>Name</th><th>In</th><th>Type</th><th>Required</th><th>Description</th></tr>\n'
      for (const param of endpoint.parameters) {
        const paramType = param.type || this.getSchemaType(param.schema) || 'string'
        html += `      <tr><td><code>${this.escapeHtml(param.name)}</code></td>`
        html += `<td>${param.in}</td>`
        html += `<td>${paramType}</td>`
        html += `<td>${param.required ? 'Yes' : 'No'}</td>`
        html += `<td>${this.escapeHtml(param.description || '')}</td></tr>\n`
      }
      html += '    </table>\n'
    }

    // Request Body table
    if (resolvedBody && resolvedBody.properties.length > 0) {
      html += '    <h4>Request Body</h4>\n'
      if (resolvedBody.description) {
        html += `    <p>${this.escapeHtml(resolvedBody.description)}</p>\n`
      }
      html += '    <table>\n'
      html += '      <tr><th>Field</th><th>Type</th><th>Required</th><th>Description</th><th>Example</th></tr>\n'
      for (const prop of resolvedBody.properties) {
        html += `      <tr><td><code>${this.escapeHtml(prop.name)}</code></td>`
        html += `<td>${this.escapeHtml(prop.type)}</td>`
        html += `<td>${prop.required ? 'Yes' : 'No'}</td>`
        html += `<td>${this.escapeHtml(prop.description)}</td>`
        html += `<td>${prop.example !== undefined ? '<code>' + this.escapeHtml(String(prop.example)) + '</code>' : '-'}</td></tr>\n`
      }
      html += '    </table>\n'
    }

    // cURL example
    html += '    <h4>cURL Example</h4>\n'
    html += '    <ac:structured-macro ac:name="code">\n'
    html += '      <ac:parameter ac:name="language">bash</ac:parameter>\n'
    html += '      <ac:plain-text-body><![CDATA[' + curlExample + ']]></ac:plain-text-body>\n'
    html += '    </ac:structured-macro>\n'

    // Responses table
    html += '    <h4>Responses</h4>\n'
    html += '    <table>\n'
    html += '      <tr><th>Code</th><th>Description</th></tr>\n'
    for (const [code, response] of Object.entries(endpoint.responses)) {
      html += `      <tr><td><code>${code}</code></td><td>${this.escapeHtml(response.description)}</td></tr>\n`
    }
    html += '    </table>\n'

    html += '  </ac:rich-text-body>\n'
    html += '</ac:structured-macro>\n'

    return html
  }

  private resolveRequestBody(requestBody?: any): ResolvedRequestBody | null {
    if (!requestBody) return null

    const content = requestBody.content
    if (!content) return null

    const jsonContent = content['application/json']
    if (!jsonContent || !jsonContent.schema) return null

    const schema = this.resolveRef(jsonContent.schema)
    if (!schema || !schema.properties) return null

    const requiredFields: string[] = schema.required || []
    const properties: SchemaProperty[] = []
    const exampleObj: Record<string, any> = {}

    for (const [name, propSchema] of Object.entries(schema.properties as Record<string, any>)) {
      const resolved = this.resolveRef(propSchema)
      const type = this.getSchemaType(resolved)
      const isRequired = requiredFields.includes(name)

      properties.push({
        name,
        type,
        required: isRequired,
        description: resolved.description || '',
        example: resolved.example !== undefined ? String(resolved.example) : undefined,
      })

      // Build example object for cURL
      if (resolved.example !== undefined) {
        exampleObj[name] = resolved.example
      } else {
        exampleObj[name] = this.getExampleValue(resolved, name)
      }
    }

    return {
      description: requestBody.description,
      properties,
      jsonExample: JSON.stringify(exampleObj, null, 2),
    }
  }

  private resolveRef(schema: any): any {
    if (!schema) return schema
    if (schema.$ref) {
      const refPath = schema.$ref.replace('#/components/schemas/', '')
      const resolved = this.schemas[refPath]
      return resolved ? this.resolveRef(resolved) : schema
    }
    return schema
  }

  private getSchemaType(schema: any): string {
    if (!schema) return 'string'
    if (schema.$ref) {
      const refName = schema.$ref.replace('#/components/schemas/', '')
      const resolved = this.schemas[refName]
      if (resolved) return this.getSchemaType(resolved)
      return refName
    }
    if (schema.enum) {
      return schema.enum.map((v: any) => `"${v}"`).join(' | ')
    }
    if (schema.type === 'array') {
      const itemType = schema.items ? this.getSchemaType(schema.items) : 'any'
      return `${itemType}[]`
    }
    return schema.type || 'object'
  }

  private getExampleValue(schema: any, fieldName: string): any {
    if (schema.example !== undefined) return schema.example
    if (schema.enum) return schema.enum[0]
    switch (schema.type) {
      case 'string': return `<${fieldName}>`
      case 'number':
      case 'integer': return 1
      case 'boolean': return false
      case 'array':
        return schema.items?.example !== undefined ? [schema.items.example] : [1, 2, 3]
      case 'object': return {}
      default: return `<${fieldName}>`
    }
  }

  private generateCurlExample(endpoint: ParsedEndpoint, resolvedBody: ResolvedRequestBody | null): string {
    const baseUrl = this.baseUrl || 'https://pyxis.lifeisgoodforlearner.com/api/edge'
    let path = endpoint.path

    // Build query string from parameters
    const queryParams: string[] = []
    if (endpoint.parameters) {
      for (const param of endpoint.parameters) {
        if (param.in === 'query') {
          const val = this.getParamExampleValue(param)
          queryParams.push(`${param.name}=${val}`)
        } else if (param.in === 'path') {
          path = path.replace(`{${param.name}}`, this.getParamExampleValue(param))
        }
      }
    }

    const fullUrl = queryParams.length > 0
      ? `${baseUrl}${path}?${queryParams.join('&')}`
      : `${baseUrl}${path}`

    let curl = `curl --request ${endpoint.method} \\\n`
    curl += `  --url '${fullUrl}' \\\n`
    curl += `  --header 'Authorization: Bearer <your_token>' \\\n`
    curl += `  --header 'Content-Type: application/json'`

    if (resolvedBody) {
      curl += ` \\\n  --data '${resolvedBody.jsonExample}'`
    }

    return curl
  }

  private getParamExampleValue(param: any): string {
    if (param.example !== undefined) return String(param.example)
    const schema = this.resolveRef(param.schema)
    if (schema?.enum) return String(schema.enum[0])
    if (schema?.type === 'number' || schema?.type === 'integer') return '1'
    return `<${param.name}>`
  }

  private generatePostmanSection(postmanJson: string): string {
    let html = '\n<h2>Postman Collection</h2>\n'
    html += '<p>Copy the JSON below to import this API collection into Postman:</p>\n'
    html += '<ac:structured-macro ac:name="expand">\n'
    html += '  <ac:parameter ac:name="title">Show Postman Collection JSON</ac:parameter>\n'
    html += '  <ac:rich-text-body>\n'
    html += '    <ac:structured-macro ac:name="code">\n'
    html += '      <ac:parameter ac:name="language">json</ac:parameter>\n'
    html += '      <ac:parameter ac:name="linenumbers">true</ac:parameter>\n'
    html += '      <ac:plain-text-body><![CDATA['
    html += postmanJson
    html += ']]></ac:plain-text-body>\n'
    html += '    </ac:structured-macro>\n'
    html += '  </ac:rich-text-body>\n'
    html += '</ac:structured-macro>\n'

    return html
  }

  private escapeHtml(text: string): string {
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    }
    return text.replace(/[&<>"']/g, (char) => map[char])
  }
}
