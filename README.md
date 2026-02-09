# Confluence API Docs MCP Server

An MCP (Model Context Protocol) server that reads Swagger/OpenAPI specifications and creates/updates API documentation pages in Confluence Cloud.

## Installation

```bash
npm install
npm run build
```

## Configuration

1. Copy `.env.example` to `.env`
2. Fill in your Confluence Cloud credentials:
   - `CONFLUENCE_BASE_URL`: Your Atlassian Cloud URL (e.g., https://mycompany.atlassian.net)
   - `CONFLUENCE_EMAIL`: Your email address
   - `CONFLUENCE_API_TOKEN`: API token from https://id.atlassian.com/manage-profile/security/api-tokens

3. Add to `~/.claude.json`:

```json
{
  "mcpServers": {
    "confluence-api-docs": {
      "command": "node",
      "args": ["/home/harsh-vaghela/saleshandy/confluence-api-docs-mcp/dist/index.js"],
      "env": {
        "CONFLUENCE_BASE_URL": "https://yourcompany.atlassian.net",
        "CONFLUENCE_EMAIL": "your.email@company.com",
        "CONFLUENCE_API_TOKEN": "your-api-token"
      }
    }
  }
}
```

## Usage

### Available Tools

- `list_spaces` - List all Confluence spaces
- `search_pages` - Search for existing pages
- `get_page` - Get page content
- `create_api_doc` - Create API documentation from Swagger spec
- `update_api_doc` - Update existing API documentation
- `sync_swagger_to_confluence` - Full sync with configurable grouping
- `delete_page` - Delete a page

### Examples

**List available spaces:**
```
Show me available Confluence spaces
```

**Create API docs:**
```
Create API documentation in space DEV from http://localhost:3000/swagger.json
```

**Update API docs:**
```
Update page 12345678 with latest API spec from /path/to/swagger.json
```

## Development

```bash
npm run dev          # Run with ts-node
npm run build        # Build to dist/
npm start            # Run compiled version
npm run clean        # Remove dist/
```

## Architecture

```
MCP Server
  ├── Swagger Parser Service
  │   └── Parses OpenAPI specs from URLs or files
  ├── Confluence Client Service
  │   └── Handles Confluence REST API v2 calls
  ├── Doc Generator Service
  │   └── Converts parsed specs to Confluence storage format
  └── Tools
      ├── Space Management (list_spaces, search_pages, get_page)
      ├── Documentation Creation (create_api_doc, sync_swagger_to_confluence)
      └── Maintenance (update_api_doc, delete_page)
```

## Supported Swagger/OpenAPI Versions

- OpenAPI 3.0.x
- OpenAPI 3.1.x
- Swagger 2.0

## License

MIT
