import dotenv from 'dotenv'
import { ConfluenceApiDocsMcpServer } from './server.js'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const envPath = path.resolve(__dirname, '../.env')

// Force override of environment variables from .env
// This ensures .env values take precedence over those passed via process.env
dotenv.config({ path: envPath, override: true })

console.error('[Index] After dotenv.config():')
console.error('[Index]   CONFLUENCE_BASE_URL:', process.env.CONFLUENCE_BASE_URL)
console.error('[Index]   CONFLUENCE_EMAIL:', process.env.CONFLUENCE_EMAIL)
console.error('[Index]   CONFLUENCE_API_TOKEN:', process.env.CONFLUENCE_API_TOKEN ? process.env.CONFLUENCE_API_TOKEN.substring(0, 20) + '...' : 'NOT SET')

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
