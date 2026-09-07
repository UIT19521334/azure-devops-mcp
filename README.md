# Azure DevOps MCP Server

An [MCP (Model Context Protocol)](https://modelcontextprotocol.io/) server for managing Azure DevOps work items — Product Backlog Items (PBIs), Tasks, Bugs — and their comments, directly from an MCP-compatible client such as Kiro, Claude Desktop, or Cursor.

Configured for the organization `DigiFY2025` and project `DIGI STD FY26`.

## Features

- Create, read, update PBIs
- List your own unfinished work items
- Flexible search/list with filters or raw WIQL
- Add, list, update, delete comments on any work item
- Automatic sprint detection based on the current date
- Sensible defaults for area path and iteration path

## Prerequisites

- [Node.js](https://nodejs.org/) 18+ (uses the built-in `fetch`). See `.nvmrc` for the pinned version.
- An Azure DevOps [Personal Access Token (PAT)](https://learn.microsoft.com/en-us/azure/devops/organizations/accounts/use-personal-access-tokens-to-authenticate) with **Work Items (Read & Write)** scope.

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create a `.env` file from the example and add your PAT:

   ```bash
   cp .env.example .env
   ```

   ```env
   AZURE_DEVOPS_PAT=your-personal-access-token-here
   ```

   > `.env` is git-ignored. Never commit your real PAT.

3. Run the server:

   ```bash
   npm start
   ```

## MCP Client Configuration

Add the server to your MCP client config (e.g. `.kiro/settings/mcp.json`):

```json
{
  "mcpServers": {
    "azure-devops": {
      "command": "node",
      "args": ["/absolute/path/to/azure-devops-mcp/index.js"],
      "env": {
        "AZURE_DEVOPS_PAT": "your-personal-access-token-here"
      }
    }
  }
}
```

## Available Tools

### Work items

| Tool | Description |
| --- | --- |
| `create-pbi` | Create a Product Backlog Item. Auto-detects the current sprint and defaults the area path. Supports title, description, acceptance criteria, assignee, area/iteration path, start/target dates, and a parent link. |
| `read-pbi` | Read full details of a work item by ID, including parent/child relations. |
| `update-pbi` | Update fields of an existing work item (title, description, state, priority, dates, tags, etc.). |
| `list-my-pbis` | List work items assigned to you (via the PAT) that are not Done/Closed/Removed. |
| `list-pbis` | Search/list work items using filters (text, state, assignee, iteration, area) or a raw WIQL query. |

### Comments

| Tool | Description | Parameters |
| --- | --- | --- |
| `add-comment` | Add a comment to a work item. | `id`, `text` (HTML supported) |
| `list-comments` | List all comments on a work item. | `id` |
| `update-comment` | Edit an existing comment. | `id`, `commentId`, `text` |
| `delete-comment` | Delete a comment. | `id`, `commentId` |

## Configuration constants

Defined at the top of `index.js`:

- `ORG` — Azure DevOps organization (`DigiFY2025`)
- `PROJECT` — project name (`DIGI STD FY26`)
- `DEFAULT_AREA_PATH` — default area path for new PBIs
- `SPRINT_LIST` — sprint schedule used for automatic current-sprint detection

## Security

- Authentication uses the `AZURE_DEVOPS_PAT` environment variable only; no tokens are hardcoded.
- `.env` is git-ignored so your PAT stays local.
- Treat your PAT like a password: scope it minimally and rotate it if exposed.

## License

MIT
