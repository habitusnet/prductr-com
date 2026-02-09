#!/usr/bin/env node

/**
 * Carlos CLI - Command-line interface for product roadmap generation
 */

import { resolve } from "path";
import { generateRoadmap } from "./roadmap/index.js";
import { assessMarketFit } from "./market-fit/index.js";
import { prioritizeFeatures } from "./product/index.js";
import { auditTechnical } from "./technical/index.js";
import type { CarlosConfig } from "./types.js";

const commands = {
  roadmap: "Generate comprehensive product roadmap",
  "market-fit": "Assess product-market fit",
  backlog: "Prioritize product backlog (requires feature list)",
  audit: "Perform technical debt audit",
  full: "Run complete analysis (roadmap + market-fit + audit)",
  help: "Show this help message",
};

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || "help";
  const projectRoot = args[1] || process.cwd();

  const config: CarlosConfig = {
    projectRoot: resolve(projectRoot),
    outputDir: "scopecraft",
    docsDir: "docs",
    includeMarketFit: true,
    includeTechnicalAudit: true,
  };

  console.log("📊 Carlos - Product Roadmap Agent\n");

  try {
    switch (command) {
      case "roadmap": {
        const roadmap = await generateRoadmap(config);
        console.log("\n✅ Roadmap generated successfully");
        console.log(`   Phases: ${roadmap.phases.length}`);
        console.log(`   Epics: ${roadmap.epics.length}`);
        console.log(`   Timeline: ${roadmap.timeline}`);
        break;
      }

      case "market-fit": {
        const assessment = await assessMarketFit(config);
        console.log("\n✅ Market fit assessment complete");
        console.log(`   PMF Score: ${assessment.productMarketFitScore}/100`);
        console.log(
          `   Competition: ${assessment.competition.length} competitors`,
        );
        console.log(
          `   Recommendations: ${assessment.recommendations.length}`,
        );
        break;
      }

      case "backlog": {
        // Example features - in real usage, would read from file
        const exampleFeatures = [
          "User authentication and authorization",
          "Dashboard with real-time metrics",
          "Export data to CSV",
          "Dark mode support",
          "Email notifications",
          "Advanced search filters",
          "Mobile responsive design",
          "API rate limiting",
        ];

        const backlog = await prioritizeFeatures(config, exampleFeatures);
        console.log("\n✅ Product backlog prioritized");
        console.log(`   Now: ${backlog.nowItems.length} items`);
        console.log(`   Next: ${backlog.nextItems.length} items`);
        console.log(`   Later: ${backlog.laterItems.length} items`);
        break;
      }

      case "audit": {
        const audit = await auditTechnical(config);
        console.log("\n✅ Technical audit complete");
        console.log(`   Overall Health: ${audit.overallHealth}/100`);
        console.log(`   Debt Items: ${audit.debtItems.length}`);
        console.log(`   Critical Items: ${audit.debtItems.filter((d) => d.severity === "critical").length}`);
        break;
      }

      case "full": {
        console.log("Running complete analysis...\n");

        const roadmap = await generateRoadmap(config);
        console.log(`✅ Roadmap: ${roadmap.phases.length} phases`);

        const assessment = await assessMarketFit(config);
        console.log(
          `✅ Market Fit: ${assessment.productMarketFitScore}/100`,
        );

        const audit = await auditTechnical(config);
        console.log(`✅ Technical Health: ${audit.overallHealth}/100`);

        console.log(
          `\n📁 All reports written to ${config.outputDir}/`,
        );
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
  console.log("Usage: carlos <command> [project-path]\n");
  console.log("Commands:\n");

  Object.entries(commands).forEach(([cmd, desc]) => {
    console.log(`  ${cmd.padEnd(12)} ${desc}`);
  });

  console.log("\nExamples:");
  console.log("  carlos roadmap              # Generate roadmap for current directory");
  console.log("  carlos market-fit           # Assess product-market fit");
  console.log("  carlos audit                # Run technical debt audit");
  console.log("  carlos full                 # Complete analysis");
  console.log("  carlos roadmap ./my-product # Analyze specific project");
}

main();
