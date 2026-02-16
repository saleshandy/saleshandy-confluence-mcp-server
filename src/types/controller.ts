export interface ControllerMetadata {
  path: string
  methods: ControllerMethod[]
  tags?: string[]
  description?: string
}

export interface ControllerMethod {
  name: string
  httpMethod: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS'
  path: string
  summary?: string
  description?: string
  parameters: ControllerParameter[]
  requestBody?: ControllerRequestBody
  responses: ControllerResponse[]
  security?: string[]
}

export interface ControllerParameter {
  name: string
  in: 'path' | 'query' | 'header' | 'cookie'
  type: string
  required: boolean
  description?: string
  example?: string
}

export interface ControllerRequestBody {
  description?: string
  required: boolean
  type: string
  properties?: Record<string, ControllerPropertySchema>
}

export interface ControllerResponse {
  status: string
  description?: string
  type: string
}

export interface ControllerPropertySchema {
  type: string
  required: boolean
  description?: string
  example?: any
}
