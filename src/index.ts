import dotenv from 'dotenv'
import { ConfluenceApiDocsMcpServer } from './server.js'

dotenv.config()

const baseUrl = process.env.CONFLUENCE_BASE_URL
const email = process.env.CONFLUENCE_EMAIL
const apiToken = process.env.CONFLUENCE_API_TOKEN

if (!baseUrl) {
  throw new Error('CONFLUENCE_BASE_URL environment variable is required')
}
if (!email) {
  throw new Error('CONFLUENCE_EMAIL environment variable is required')
}
if (!apiToken) {
  throw new Error('CONFLUENCE_API_TOKEN environment variable is required')
}

const server = new ConfluenceApiDocsMcpServer(baseUrl, email, apiToken)
server.run().catch(console.error)
