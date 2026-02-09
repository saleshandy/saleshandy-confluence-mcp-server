export interface ConfluenceSpace {
  id: string
  key: string
  name: string
  type: string
}

export interface ConfluencePage {
  id: string
  type: string
  title: string
  spaceKey?: string
  version?: {
    number: number
  }
  links?: {
    webui: string
    self: string
  }
}

export interface ConfluencePageContent extends ConfluencePage {
  body?: {
    storage: {
      value: string
      representation: string
    }
  }
}

export interface ConfluenceSearchResult {
  results: ConfluencePage[]
  start: number
  limit: number
  size: number
  totalSize: number
}

export interface ConfluenceCreatePageRequest {
  spaceKey: string
  title: string
  type: string
  body: {
    storage: {
      value: string
      representation: string
    }
  }
  parentId?: string
}

export interface ConfluenceUpdatePageRequest {
  id: string
  spaceKey: string
  title: string
  type: string
  version: {
    number: number
  }
  body: {
    storage: {
      value: string
      representation: string
    }
  }
}

export interface ConfluenceError {
  statusCode: number
  message: string
  data?: Record<string, unknown>
}
