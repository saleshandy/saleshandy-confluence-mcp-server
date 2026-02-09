import axios, { AxiosInstance } from 'axios'
import {
  ConfluenceSpace,
  ConfluencePage,
  ConfluencePageContent,
  ConfluenceCreatePageRequest,
  ConfluenceUpdatePageRequest,
  ConfluenceSearchResult,
  ConfluenceError,
} from '../types/confluence.js'

export class ConfluenceClient {
  private client: AxiosInstance

  constructor(baseUrl: string, email: string, apiToken: string) {
    this.client = axios.create({
      baseURL: baseUrl,
      auth: {
        username: email,
        password: apiToken,
      },
      headers: {
        'Content-Type': 'application/json',
        'X-Atlassian-Token': 'no-check',
      },
    })

    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        const err: ConfluenceError = {
          statusCode: error.response?.status || 500,
          message: error.response?.data?.message || error.message,
          data: error.response?.data,
        }
        return Promise.reject(err)
      }
    )
  }

  async listSpaces(): Promise<ConfluenceSpace[]> {
    const response = await this.client.get<{ results: ConfluenceSpace[] }>(
      '/wiki/api/v2/spaces',
      {
        params: {
          limit: 250,
        },
      }
    )
    return response.data.results || []
  }

  async searchPages(query: string, spaceKey?: string): Promise<ConfluencePage[]> {
    const cql = spaceKey
      ? `text ~ "${query}" AND space.key = "${spaceKey}"`
      : `text ~ "${query}"`

    const response = await this.client.get<ConfluenceSearchResult>('/wiki/api/v2/pages', {
      params: {
        'query-param': cql,
        'query-param-expand': 'version',
        limit: 50,
      },
    })

    return response.data.results || []
  }

  async getPage(pageId: string): Promise<ConfluencePageContent> {
    const response = await this.client.get<ConfluencePageContent>(
      `/wiki/api/v2/pages/${pageId}`,
      {
        params: {
          'body-format': 'storage',
        },
      }
    )
    return response.data
  }

  async createPage(request: ConfluenceCreatePageRequest): Promise<ConfluencePage> {
    const payload = {
      spaceId: request.spaceKey, // Note: API v2 uses spaceId
      title: request.title,
      type: request.type || 'page',
      body: request.body,
      ...(request.parentId && { parentId: request.parentId }),
    }

    const response = await this.client.post<ConfluencePage>('/wiki/api/v2/pages', payload)
    return response.data
  }

  async updatePage(request: ConfluenceUpdatePageRequest): Promise<ConfluencePage> {
    const payload = {
      id: request.id,
      title: request.title,
      type: request.type || 'page',
      version: request.version,
      body: request.body,
    }

    const response = await this.client.put<ConfluencePage>(
      `/wiki/api/v2/pages/${request.id}`,
      payload
    )
    return response.data
  }

  async deletePage(pageId: string): Promise<void> {
    await this.client.delete(`/wiki/api/v2/pages/${pageId}`)
  }

  async getPageByTitle(spaceKey: string, title: string): Promise<ConfluencePage | null> {
    const cql = `type = page AND space.key = "${spaceKey}" AND title ~ "${title}"`

    const response = await this.client.get<ConfluenceSearchResult>('/wiki/api/v2/pages', {
      params: {
        'query-param': cql,
        limit: 10,
      },
    })

    const results = response.data.results || []
    return results.find((p) => p.title === title) || null
  }

  async getSpaceByKey(spaceKey: string): Promise<ConfluenceSpace | null> {
    try {
      const response = await this.client.get<ConfluenceSpace>(`/wiki/api/v2/spaces/${spaceKey}`)
      return response.data
    } catch {
      return null
    }
  }
}
