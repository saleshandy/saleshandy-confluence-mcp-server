export interface SwaggerSpec {
  swagger?: string
  openapi?: string
  info: {
    title: string
    description?: string
    version: string
  }
  servers?: Array<{
    url: string
    description?: string
  }>
  basePath?: string
  host?: string
  schemes?: string[]
  paths: Record<string, PathItem>
  components?: {
    schemas?: Record<string, unknown>
    securitySchemes?: Record<string, unknown>
  }
  definitions?: Record<string, unknown>
  securityDefinitions?: Record<string, unknown>
  tags?: Array<{
    name: string
    description?: string
  }>
}

export interface PathItem {
  get?: Operation
  post?: Operation
  put?: Operation
  delete?: Operation
  patch?: Operation
  head?: Operation
  options?: Operation
  trace?: Operation
  parameters?: Parameter[]
}

export interface Operation {
  tags?: string[]
  summary?: string
  description?: string
  operationId?: string
  parameters?: Parameter[]
  requestBody?: RequestBody
  responses: Record<string, Response>
  security?: Array<Record<string, string[]>>
  deprecated?: boolean
}

export interface Parameter {
  name: string
  in: string
  description?: string
  required?: boolean
  schema?: unknown
  type?: string
  format?: string
  items?: unknown
}

export interface RequestBody {
  description?: string
  content: Record<string, MediaType>
  required?: boolean
}

export interface MediaType {
  schema?: unknown
  example?: unknown
}

export interface Response {
  description: string
  content?: Record<string, MediaType>
  schema?: unknown
}

export interface ParsedEndpoint {
  path: string
  method: string
  tags: string[]
  summary: string
  description: string
  parameters: Parameter[]
  requestBody?: RequestBody
  responses: Record<string, Response>
  operationId?: string
}

export interface ParsedSwagger {
  title: string
  description?: string
  version: string
  baseUrl?: string
  endpoints: ParsedEndpoint[]
  tags: Array<{
    name: string
    description?: string
  }>
}
