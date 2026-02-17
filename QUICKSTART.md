# Quick Start Guide

## Prerequisites

- Node.js 18+
- Atlassian Cloud Confluence account
- Confluence API token

## 1. Get Your Confluence API Token

1. Go to https://id.atlassian.com/manage-profile/security/api-tokens
2. Click "Create API token"
3. Give it a name like "Claude MCP Server"
4. Copy the token (you'll need it in the next step)

## 2. Configure Environment

```bash
cd /home/harsh-vaghela/saleshandy/confluence-api-docs-mcp
cp .env.example .env
```

Edit `.env` with your credentials:

```env
CONFLUENCE_BASE_URL=https://yourcompany.atlassian.net
CONFLUENCE_EMAIL=your.email@company.com
CONFLUENCE_API_TOKEN=your-api-token-here
```

## 3. Configure Claude Code

Add to `~/.claude.json`:

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

## 4. Build and Start

```bash
npm run build
npm start
```

You should see: `Confluence API Docs MCP server started`

## 5. Test the Server

In Claude Code, ask:

```
Show me available Confluence spaces
```

This will list all your Confluence spaces. If it works, you're ready!

## 6. Create API Documentation

### From Swagger/OpenAPI (URL or file):

```
Create API documentation in space DEV from http://localhost:3000/sh/api/edge/api-doc-json
```

or from a local file:

```
Create API documentation in space DEV from /path/to/swagger.json
```

### From NestJS Controller Files (NEW!):

```
Create API documentation from src/controllers/dialer.controller.ts in space DEV with base URL https://api.example.com
```

or from all controllers in a directory:

```
Create API documentation from src/controllers in space DEV
```

### With custom organization:

```
Sync the API documentation to Confluence space DEV, grouping by tags (separate pages for each tag)
```

```
Sync the API documentation to Confluence space DEV as a single page
```

## 7. Update Documentation

### Update from Swagger:
```
Update page 123456789 with the latest API spec from http://localhost:3000/sh/api/edge/api-doc-json
```

### Update from Controller:
```
Update page 123456789 from src/controllers/dialer.controller.ts
```

## Available Commands

| Task | Ask Claude | Result |
|------|-----------|--------|
| List spaces | "Show available Confluence spaces" | View all spaces |
| Search pages | "Search for pages with 'API'" | Find existing pages |
| Get page | "Get content of page 123456" | View page content |
| Create from Swagger | "Create API docs from URL in space KEY" | New documentation page + Postman JSON |
| Create from Controller | "Create API docs from src/controllers/foo.controller.ts in space KEY" | New documentation page + Postman JSON |
| Update from Swagger | "Update page ID with new swagger from URL" | Updated documentation + Postman JSON |
| Update from Controller | "Update page ID from src/controllers/foo.controller.ts" | Updated documentation + Postman JSON |
| Sync all | "Sync swagger to Confluence" | Organized multi-page docs + Postman JSON |
| Delete page | "Delete page 123456" | Remove page |

## Troubleshooting

### "CONFLUENCE_BASE_URL environment variable is required"
- Make sure you've copied `.env.example` to `.env`
- Verify all three environment variables are set

### "Error: Confluence API returned 401"
- Check your email and API token are correct
- Verify the token hasn't expired

### "Error: Swagger parsing failed"
- Ensure the URL is correct and returns valid JSON
- For local dev, make sure the server is running
- For files, verify the path is absolute

### "Error: Space KEY not found"
- List spaces first to get the correct key
- Space keys are case-sensitive

## Postman Collections

Every API documentation page automatically includes an embedded Postman Collection (v2.1) that can be imported into Postman for testing. The collection includes:

- ✅ All endpoints with correct HTTP methods and paths
- ✅ Pre-configured authentication (Bearer token)
- ✅ Base URL variables for easy environment switching
- ✅ Request examples and parameters
- ✅ Response definitions

Simply copy the JSON from the "Postman Collection" section of any generated page and import it into Postman.

## Integration with saleshandy-edge

The saleshandy-edge API documentation is available at:

**Main API:**
```
http://localhost:3000/sh/api/edge/api-doc-json
```

**Admin Panel:**
```
http://localhost:3000/sh/api/edge/api-doc/admin-panel
```

To export as file:
```bash
curl http://localhost:3000/sh/api/edge/api-doc-json > swagger.json
```

Then use: `Create API documentation from /path/to/swagger.json`

## Controller File Format

For the controller-based documentation feature, the system expects NestJS controllers with standard decorators:

```typescript
import { Controller, Get, Post, Body, Param } from '@nestjs/common'

@Controller('dialer')
export class DialerController {
  @Get(':id')
  getDialer(@Param('id') id: string) {
    // Implementation
  }

  @Post()
  createDialer(@Body() createDto: CreateDialerDto) {
    // Implementation
  }
}
```

The parser extracts:
- Controller path from `@Controller()`
- HTTP methods from `@Get/@Post/@Put/@Delete/@Patch()`
- Parameters from `@Param/@Query/@Body/@Header()`
- JSDoc comments as documentation
- Response status codes (with `@HttpCode()` decorators)

## Need Help?

Check the README.md for detailed documentation on all available tools.
