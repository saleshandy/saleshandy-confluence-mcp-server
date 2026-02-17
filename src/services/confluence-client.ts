import axios, { AxiosInstance } from 'axios'
import { writeFileSync } from 'fs'
import { resolve } from 'path'
import {
  ConfluenceSpace,
  ConfluencePage,
  ConfluencePageContent,
  ConfluenceCreatePageRequest,
  ConfluenceUpdatePageRequest,
  ConfluenceSearchResult,
  ConfluenceError,
} from '../types/confluence.js'

const LOG_FILE = resolve('/tmp/confluence-mcp-debug.log')

function log(message: string, data?: any) {
  const timestamp = new Date().toISOString()
  let logStr = `[${timestamp}] ${message}`
  if (data) {
    logStr += '\n' + JSON.stringify(data, null, 2)
  }
  logStr += '\n'
  try {
    writeFileSync(LOG_FILE, logStr, { flag: 'a' })
  } catch (e) {
    console.error('[ConfluenceClient] Failed to write log:', e)
  }
}

export class ConfluenceClient {
  private client: AxiosInstance

  constructor(baseUrl: string, email: string, apiToken: string) {
    log('ConfluenceClient Constructor', { baseUrl, email, apiToken: apiToken?.substring(0, 20) + '...' })
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
    try {
      log('listSpaces: Starting API call')
      log('listSpaces: baseURL=', (this.client as any).defaults?.baseURL)
      log('listSpaces: auth username=', (this.client as any).defaults?.auth?.username)

      const response = await this.client.get<{ results: ConfluenceSpace[] }>(
        '/wiki/api/v2/spaces',
        {
          params: {
            limit: 250,
          },
        }
      )
      log('listSpaces: Response status:', response.status)
      log('listSpaces: Response data', response.data)
      const results = response.data.results || []
      log('listSpaces: Returning', results.length + ' spaces')
      return results
    } catch (error) {
      log('listSpaces error:', error)
      throw error
    }
  }

  async searchPages(query: string, spaceKey?: string): Promise<ConfluencePage[]> {
    try {
      // For Confluence Cloud API v2, we need to use 'query' parameter with CQL
      const cql = spaceKey
        ? `text ~ "${query}" AND space.key = "${spaceKey}"`
        : `text ~ "${query}"`

      console.error('[Confluence] searchPages query:', { query, spaceKey, cql })

      const response = await this.client.get<ConfluenceSearchResult>('/wiki/api/v2/pages', {
        params: {
          query: cql,  // Correct parameter for Confluence Cloud API v2
          expand: 'version',  // Correct parameter name
          limit: 50,
        },
      })

      console.error('[Confluence] searchPages response:', JSON.stringify(response.data, null, 2))
      return response.data.results || []
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : JSON.stringify(error, null, 2)
      console.error('[Confluence] searchPages error:', errorMsg)
      throw error
    }
  }

  async getPage(pageId: string): Promise<ConfluencePageContent> {
    try {
      console.error('[Confluence] getPage: Fetching page', pageId)
      const response = await this.client.get<ConfluencePageContent>(
        `/wiki/api/v2/pages/${pageId}`,
        {
          params: {
            'body-format': 'storage',
          },
        }
      )
      console.error('[Confluence] getPage: Page fetched successfully:', response.data.title)
      return response.data
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : JSON.stringify(error, null, 2)
      console.error('[Confluence] getPage error:', errorMsg)
      throw error
    }
  }

  async createPage(request: ConfluenceCreatePageRequest): Promise<ConfluencePage> {
    try {
      // First, get the space ID from the space key
      console.error('[Confluence] createPage: Fetching space ID for key:', request.spaceKey)
      const space = await this.getSpaceByKey(request.spaceKey)

      if (!space) {
        throw new Error(`Space with key "${request.spaceKey}" not found`)
      }

      console.error('[Confluence] createPage: Found space:', space)

      const payload = {
        spaceId: space.id, // Use actual space ID, not key
        title: request.title,
        type: request.type || 'page',
        body: request.body,
        ...(request.parentId && { parentId: request.parentId }),
      }

      console.error('[Confluence] createPage: Creating page with payload:', JSON.stringify(payload, null, 2))
      const response = await this.client.post<ConfluencePage>('/wiki/api/v2/pages', payload)
      console.error('[Confluence] createPage: Page created successfully:', response.data)
      return response.data
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : JSON.stringify(error, null, 2)
      console.error('[Confluence] createPage error:', errorMsg)
      throw error
    }
  }

  async updatePage(request: ConfluenceUpdatePageRequest): Promise<ConfluencePage> {
    try {
      console.error('[Confluence] updatePage: Updating page', request.id)
      const payload = {
        id: request.id,
        status: 'current',
        title: request.title,
        type: request.type || 'page',
        version: request.version,
        body: request.body,
      }

      console.error('[Confluence] updatePage: Payload:', JSON.stringify(payload, null, 2))
      const response = await this.client.put<ConfluencePage>(
        `/wiki/api/v2/pages/${request.id}`,
        payload
      )
      console.error('[Confluence] updatePage: Page updated successfully:', response.data.id)
      return response.data
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : JSON.stringify(error, null, 2)
      console.error('[Confluence] updatePage error:', errorMsg)
      throw error
    }
  }

  async deletePage(pageId: string): Promise<void> {
    try {
      console.error('[Confluence] deletePage: Deleting page', pageId)
      await this.client.delete(`/wiki/api/v2/pages/${pageId}`)
      console.error('[Confluence] deletePage: Page deleted successfully:', pageId)
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : JSON.stringify(error, null, 2)
      console.error('[Confluence] deletePage error:', errorMsg)
      throw error
    }
  }

  async getPageByTitle(spaceKey: string, title: string): Promise<ConfluencePage | null> {
    try {
      const cql = `type = page AND space.key = "${spaceKey}" AND title ~ "${title}"`
      console.error('[Confluence] getPageByTitle: Searching for page', { spaceKey, title, cql })

      const response = await this.client.get<ConfluenceSearchResult>('/wiki/api/v2/pages', {
        params: {
          query: cql,  // Correct parameter name for Confluence Cloud API v2
          limit: 10,
        },
      })

      const results = response.data.results || []
      console.error('[Confluence] getPageByTitle: Found', results.length, 'pages')
      return results.find((p) => p.title === title) || null
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : JSON.stringify(error, null, 2)
      console.error('[Confluence] getPageByTitle error:', errorMsg)
      throw error
    }
  }

  async getSpaceByKey(spaceKey: string): Promise<ConfluenceSpace | null> {
    try {
      const response = await this.client.get<{ results: ConfluenceSpace[] }>(
        '/wiki/api/v2/spaces',
        { params: { keys: spaceKey, limit: 1 } }
      )
      const results = response.data.results || []
      return results.find((s) => s.key === spaceKey) || null
    } catch {
      return null
    }
  }
}
