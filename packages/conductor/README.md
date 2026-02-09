# @prductr/conductor

Multi-tenant LLM orchestration platform.

## Overview

Coordinate multiple LLM agents (Claude, GPT, Gemini) on shared codebases with task queuing, file locking, cost tracking, and agent lifecycle management.

## Features

- **21 MCP tools** for coordination
- **Multi-tenant** with access control
- **Task queuing** with dependencies
- **File locking** to prevent conflicts
- **Cost tracking** per agent/task
- **Agent onboarding** with approval flow

## Architecture

- **Database**: Cloudflare D1 (11 tables)
- **Deployment**: Vercel Edge
- **Protocol**: MCP (Model Context Protocol)
- **Tests**: 1,374+ passing

## Usage

Connect via MCP client:
```json
{
  "mcpServers": {
    "conductor": {
      "command": "npx",
      "args": ["@prductr/conductor"]
    }
  }
}
```

## Public Repository

Will be published to: `prductr-com/conductor`

## Dashboard

- **Production**: https://conductor.prductr.com
- **Multi-tenant**: Organizations, projects, agents
