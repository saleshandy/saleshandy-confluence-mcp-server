# Confluence API Docs MCP Server

An MCP (Model Context Protocol) server that generates API documentation in Confluence from:
- **Swagger/OpenAPI specifications** (JSON files or URLs)
- **NestJS controller files** (TypeScript decorators)

Automatically generates Postman collections and embeds them in documentation pages.

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

**Space Management:**
- `list_spaces` - List all Confluence spaces
- `search_pages` - Search for existing pages
- `get_page` - Get page content
- `delete_page` - Delete a page

**Swagger/OpenAPI Documentation:**
- `create_api_doc` - Create API documentation from Swagger/OpenAPI spec (URL or file)
- `update_api_doc` - Update existing API documentation from spec
- `sync_swagger_to_confluence` - Full sync with configurable grouping (tag, path, or single page)

**NestJS Controller Documentation:**
- `create_api_doc_from_controller` - Create documentation from NestJS controller files
- `update_api_doc_from_controller` - Update documentation from controller files

**Note:** All tools automatically generate Postman collections embedded in the documentation.

### Examples

**List available spaces:**
```
Show me available Confluence spaces
```

**Create API docs from Swagger:**
```
Create API documentation in space DEV from http://localhost:3000/swagger.json
```

**Create API docs from NestJS controller:**
```
Create API documentation from src/controllers/dialer.controller.ts in space DEV with base URL https://api.example.com
```

**Create docs from controller directory:**
```
Create API documentation from src/controllers in space DEV
```

**Update API docs:**
```
Update page 12345678 with latest API spec from /path/to/swagger.json
```

**Update from controller:**
```
Update page 12345678 from src/controllers/dialer.controller.ts
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
  ├── Parsers
  │   ├── Swagger Parser Service
  │   │   └── Parses OpenAPI specs from URLs or files
  │   └── Controller Parser Service
  │       └── Parses NestJS TypeScript controller files
  ├── Generators
  │   ├── Doc Generator Service
  │   │   └── Converts parsed specs to Confluence storage format
  │   └── Postman Generator Service
  │       └── Generates Postman Collection v2.1 JSON
  ├── Confluence Client Service
  │   └── Handles Confluence REST API v2 calls
  └── Tools
      ├── Space Management
      ├── Swagger-based Documentation
      ├── Controller-based Documentation
      └── Maintenance
```

### Dual-Mode Pipeline

Both Swagger and Controller inputs converge to the same `ParsedSwagger` format, ensuring identical output documentation:

```
Swagger JSON/URL → Swagger Parser → ParsedSwagger ─┐
                                                    ├→ Doc Generator → Confluence HTML + Postman JSON
NestJS Controller → Controller Parser → ParsedSwagger ┘
```

## Supported Swagger/OpenAPI Versions

- OpenAPI 3.0.x
- OpenAPI 3.1.x
- Swagger 2.0

## License

MIT
