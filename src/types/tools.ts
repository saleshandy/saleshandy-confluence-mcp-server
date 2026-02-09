import { ConfluencePage } from './confluence.js'

export interface ListSpacesInput {}

export interface ListSpacesOutput {
  spaces: Array<{
    id: string
    key: string
    name: string
  }>
}

export interface SearchPagesInput {
  query: string
  spaceKey?: string
}

export interface SearchPagesOutput {
  pages: Array<{
    id: string
    title: string
    spaceKey?: string
    url?: string
  }>
}

export interface GetPageInput {
  pageId: string
}

export interface GetPageOutput {
  id: string
  title: string
  content: string
  version: number
}

export interface CreateApiDocInput {
  swaggerSource: string
  spaceKey: string
  parentPageId?: string
  title?: string
  filterTags?: string[]
  filterPaths?: string[]
}

export interface CreateApiDocOutput {
  pageId: string
  title: string
  url: string
}

export interface UpdateApiDocInput {
  pageId: string
  swaggerSource: string
  filterTags?: string[]
  filterPaths?: string[]
}

export interface UpdateApiDocOutput {
  pageId: string
  title: string
  url: string
  version: number
}

export interface SyncSwaggerInput {
  swaggerSource: string
  spaceKey: string
  parentPageId?: string
  groupBy?: 'tag' | 'path' | 'single'
}

export interface SyncSwaggerOutput {
  pages: Array<{
    pageId: string
    title: string
    url: string
    parentId?: string
  }>
}

export interface DeletePageInput {
  pageId: string
}

export interface DeletePageOutput {
  success: boolean
  pageId: string
}
