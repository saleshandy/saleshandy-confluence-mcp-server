export interface PostmanCollection {
  info: {
    name: string
    description?: string
    schema: string
  }
  item: PostmanItem[]
  variable?: PostmanVariable[]
  auth?: PostmanAuth
}

export interface PostmanItem {
  name: string
  description?: string
  request: PostmanRequest
  response?: PostmanResponse[]
}

export interface PostmanRequest {
  method: string
  header: PostmanHeader[]
  body?: PostmanBody
  url: PostmanUrl
  auth?: PostmanAuth
  description?: string
}

export interface PostmanHeader {
  key: string
  value: string
  type?: string
  disabled?: boolean
}

export interface PostmanBody {
  mode: 'raw' | 'formdata' | 'urlencoded' | 'graphql'
  raw?: string
  formdata?: PostmanFormDataItem[]
  urlencoded?: PostmanFormDataItem[]
  graphql?: Record<string, any>
  options?: {
    raw: {
      language: string
    }
  }
}

export interface PostmanFormDataItem {
  key: string
  value: string
  type: string
  disabled?: boolean
}

export interface PostmanUrl {
  raw: string
  protocol?: string
  host?: string[]
  port?: string
  path?: string[]
  query?: PostmanQueryParam[]
  variable?: PostmanUrlVariable[]
}

export interface PostmanQueryParam {
  key: string
  value: string
  disabled?: boolean
}

export interface PostmanUrlVariable {
  id: string
  key: string
  value: string
  type: string
}

export interface PostmanVariable {
  id?: string
  key: string
  value: string
  type?: string
  disabled?: boolean
}

export interface PostmanAuth {
  type: string
  bearer?: Array<{ key: string; value: string; type: string }>
  basic?: Array<{ key: string; value: string; type: string }>
  apikey?: Array<{ key: string; value: string; type: string }>
}

export interface PostmanResponse {
  name: string
  originalRequest?: PostmanRequest
  status: string
  code: number
  header?: PostmanHeader[]
  body?: string
}
