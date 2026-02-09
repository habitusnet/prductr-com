#!/usr/bin/env npx ts-node

/**
 * Seed script to add test data to the Conductor dashboard
 * Run with: npx ts-node scripts/seed-test-data.ts
 */

import { SQLiteStateStore } from "@conductor/state";

const dbPath = process.env.CONDUCTOR_DB || "./conductor.db";

console.log(`Seeding database at: ${dbPath}`);

const store = new SQLiteStateStore({ dbPath });

// Generate IDs
const orgId = crypto.randomUUID();

// Seed data
const agents = [
  {
    id: "claude-opus",
    name: "Claude Opus",
    provider: "anthropic" as const,
    model: "claude-opus-4-5-20251101",
    capabilities: ["code", "analysis", "planning", "debugging"],
    costPerToken: { input: 0.015, output: 0.075 },
    status: "working" as const,
  },
  {
    id: "gemini-pro",
    name: "Gemini Pro",
    provider: "google" as const,
    model: "gemini-2.0-flash",
    capabilities: ["code", "multimodal", "reasoning"],
    costPerToken: { input: 0.00025, output: 0.001 },
    status: "idle" as const,
  },
  {
    id: "gpt-4-turbo",
    name: "GPT-4 Turbo",
    provider: "openai" as const,
    model: "gpt-4-turbo",
    capabilities: ["code", "analysis", "writing"],
    costPerToken: { input: 0.01, output: 0.03 },
    status: "offline" as const,
  },
];

const tasks = [
  {
    title: "Implement authentication system",
    description: "Add user authentication with OAuth support",
    priority: "critical" as const,
    tags: ["auth", "security"],
  },
  {
    title: "Fix database connection pooling",
    description: "Optimize database connections for better performance",
    priority: "high" as const,
    tags: ["database", "performance"],
  },
  {
    title: "Add unit tests for API routes",
    description: "Increase test coverage for all API endpoints",
    priority: "medium" as const,
    tags: ["testing"],
  },
  {
    title: "Update documentation",
    description: "Update README and API documentation",
    priority: "low" as const,
    tags: ["docs"],
  },
  {
    title: "Refactor state management",
    description: "Migrate to new state management approach",
    priority: "high" as const,
    tags: ["refactor", "architecture"],
  },
];

async function seed() {
  try {
    // Create project
    console.log("\nCreating project...");
    const project = store.createProject({
      organizationId: orgId,
      name: "Demo Project",
      slug: "demo-project",
      description: "A demonstration project for testing real-time updates",
      gitBranch: "main",
      conflictStrategy: "lock",
      settings: {},
      isActive: true,
      budget: {
        total: 100,
        spent: 0,
        currency: "USD",
        alertThreshold: 80,
      },
    });
    console.log(`  Project created: ${project.name} (${project.id})`);

    // Register agents
    console.log("\nRegistering agents...");
    for (const agent of agents) {
      store.registerAgent(project.id, {
        id: agent.id,
        name: agent.name,
        provider: agent.provider,
        model: agent.model,
        capabilities: agent.capabilities,
        costPerToken: agent.costPerToken,
        status: agent.status,
        metadata: {},
      });
      console.log(`  Registered: ${agent.name} (${agent.status})`);
    }

    // Create tasks
    console.log("\nCreating tasks...");
    const createdTasks: string[] = [];
    for (const task of tasks) {
      const created = store.createTask(project.id, {
        title: task.title,
        description: task.description,
        priority: task.priority,
        status: "pending",
        tags: task.tags,
        dependencies: [],
        files: [],
        metadata: {},
      });
      createdTasks.push(created.id);
      console.log(`  Created: ${task.title}`);
    }

    // Assign tasks to agents and update statuses
    console.log("\nAssigning tasks and updating statuses...");

    // Task 0: In progress with Claude
    store.updateTask(createdTasks[0], {
      status: "in_progress",
      assignedTo: "claude-opus",
    });
    console.log(`  ${tasks[0].title} -> claude-opus (in_progress)`);

    // Task 4: In progress with Gemini
    store.updateTask(createdTasks[4], {
      status: "in_progress",
      assignedTo: "gemini-pro",
    });
    console.log(`  ${tasks[4].title} -> gemini-pro (in_progress)`);

    // Task 3: Completed by GPT-4
    store.updateTask(createdTasks[3], {
      status: "completed",
      assignedTo: "gpt-4-turbo",
    });
    console.log(`  ${tasks[3].title} -> gpt-4-turbo (completed)`);

    // Record some cost events
    console.log("\nRecording cost events...");
    const costEvents = [
      {
        agentId: "claude-opus",
        tokensInput: 15000,
        tokensOutput: 3000,
        cost: 0.45,
        model: "claude-opus-4-5-20251101",
      },
      {
        agentId: "claude-opus",
        tokensInput: 8000,
        tokensOutput: 2000,
        cost: 0.25,
        model: "claude-opus-4-5-20251101",
      },
      {
        agentId: "gemini-pro",
        tokensInput: 20000,
        tokensOutput: 5000,
        cost: 0.15,
        model: "gemini-2.0-flash",
      },
      {
        agentId: "gpt-4-turbo",
        tokensInput: 12000,
        tokensOutput: 4000,
        cost: 0.35,
        model: "gpt-4-turbo",
      },
      {
        agentId: "gpt-4-turbo",
        tokensInput: 5000,
        tokensOutput: 1500,
        cost: 0.12,
        model: "gpt-4-turbo",
      },
    ];

    for (const event of costEvents) {
      store.recordCost({
        organizationId: orgId,
        projectId: project.id,
        agentId: event.agentId,
        taskId: createdTasks[0], // Associate with first task
        tokensInput: event.tokensInput,
        tokensOutput: event.tokensOutput,
        cost: event.cost,
        model: event.model,
      });
      console.log(`  Recorded: ${event.agentId} - $${event.cost.toFixed(2)}`);
    }

    // Summary
    const allTasks = store.listTasks(project.id);
    const allAgents = store.listAgents(project.id);
    const totalCost = costEvents.reduce((sum, e) => sum + e.cost, 0);

    console.log("\n========================================");
    console.log("Seed completed successfully!");
    console.log("========================================");
    console.log(`Project: ${project.name} (${project.id})`);
    console.log(`Organization ID: ${orgId}`);
    console.log(`Agents: ${allAgents.length}`);
    console.log(`Tasks: ${allTasks.length}`);
    console.log(`Total cost: $${totalCost.toFixed(2)}`);
    console.log("========================================");
    console.log("\nSet these environment variables to use this project:");
    console.log(`  export CONDUCTOR_PROJECT_ID="${project.id}"`);
    console.log(`  export CONDUCTOR_DB="${dbPath}"`);
    console.log("========================================\n");
  } catch (error) {
    console.error("Seed failed:", error);
    process.exit(1);
  }
}

seed();
