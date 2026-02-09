#!/usr/bin/env node

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { SQLiteStateStore } from "@conductor/state";
import { createConductorServer } from "./server.js";

async function main() {
  const dbPath = process.env["CONDUCTOR_DB"] || "./conductor.db";
  const projectId = process.env["CONDUCTOR_PROJECT"];

  if (!projectId) {
    console.error("Error: CONDUCTOR_PROJECT environment variable is required");
    console.error("Usage: CONDUCTOR_PROJECT=<project-id> conductor-mcp");
    process.exit(1);
  }

  const stateStore = new SQLiteStateStore(dbPath);

  // Verify project exists
  const project = stateStore.getProject(projectId);
  if (!project) {
    console.error(`Error: Project not found: ${projectId}`);
    console.error("Initialize a project first with: conductor init");
    process.exit(1);
  }

  const server = createConductorServer({ stateStore, projectId });
  const transport = new StdioServerTransport();

  console.error(`Conductor MCP server starting...`);
  console.error(`  Project: ${project.name} (${projectId})`);
  console.error(`  Database: ${dbPath}`);

  await server.connect(transport);
}

main().catch((error) => {
  console.error("Failed to start Conductor MCP server:", error);
  process.exit(1);
});
