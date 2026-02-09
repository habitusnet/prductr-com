#!/usr/bin/env node

/**
 * Lisa CLI - Command-line interface for archaeological rescue
 */

import { resolve } from "path";
import { rescue } from "./rescue/index.js";
import { research } from "./research/index.js";
import { discover } from "./discover/index.js";
import { plan } from "./plan/index.js";
import { structure } from "./structure/index.js";
import { reconcile } from "./reconcile/index.js";
import type { LisaConfig } from "./types.js";

const commands = {
  rescue: "Full rescue pipeline (research + discover + plan + structure)",
  research: "Git archaeology and timeline analysis",
  discover: "Extract semantic memory from project",
  plan: "Generate roadmap and scopecraft docs",
  structure: "Create beads and convoys from roadmap",
  reconcile: "Multi-project alignment analysis",
  help: "Show this help message",
};

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || "help";
  const projectRoot = args[1] || process.cwd();

  const config: LisaConfig = {
    projectRoot: resolve(projectRoot),
    outputDir: ".gt",
    scopecraftDir: "scopecraft",
    excludePatterns: ["node_modules", "dist", ".git", ".next"],
  };

  console.log("🔬 Lisa - Archaeological Rescue Agent\n");

  try {
    switch (command) {
      case "rescue":
        await rescue(config);
        break;

      case "research":
        await research(config);
        break;

      case "discover": {
        const memory = await discover(config);
        console.log("\n📊 Semantic Memory:");
        console.log(JSON.stringify(memory, null, 2));
        break;
      }

      case "plan": {
        // Need to run discover first
        const memory = await discover(config);
        await plan(config, memory);
        break;
      }

      case "structure": {
        // Need to run discover and plan first
        const memory = await discover(config);
        const planning = await plan(config, memory);
        await structure(config, planning);
        break;
      }

      case "reconcile": {
        // Expects multiple project paths
        const projects = args.slice(1).map((p) => resolve(p));
        if (projects.length === 0) {
          console.error("❌ Please provide project paths to reconcile");
          process.exit(1);
        }
        await reconcile(config, projects);
        break;
      }

      case "help":
      default:
        showHelp();
        break;
    }
  } catch (error) {
    console.error("\n❌ Error:", error);
    process.exit(1);
  }
}

function showHelp() {
  console.log("Usage: lisa <command> [project-path]\n");
  console.log("Commands:\n");

  Object.entries(commands).forEach(([cmd, desc]) => {
    console.log(`  ${cmd.padEnd(12)} ${desc}`);
  });

  console.log("\nExamples:");
  console.log("  lisa rescue                    # Rescue current directory");
  console.log("  lisa rescue ./my-project       # Rescue specific project");
  console.log("  lisa research                  # Analyze git history");
  console.log("  lisa reconcile ./p1 ./p2 ./p3  # Align multiple projects");
}

main();
