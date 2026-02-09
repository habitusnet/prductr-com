/**
 * Rescue - Full rescue pipeline for abandoned projects
 * Combines research, discover, plan, and structure into one workflow
 */

import type { LisaConfig, SemanticMemory, PlanningOutput, StructureOutput } from "../types.js";
import { research } from "../research/index.js";
import { discover } from "../discover/index.js";
import { plan } from "../plan/index.js";
import { structure } from "../structure/index.js";

export interface RescueOutput {
  research: {
    timeline: string;
    complexity: string;
  };
  semanticMemory: SemanticMemory;
  planning: PlanningOutput;
  structure: StructureOutput;
  timestamp: string;
}

/**
 * Execute full rescue pipeline for an abandoned project
 *
 * Steps:
 * 1. Research - Git archaeology and timeline analysis
 * 2. Discover - Extract semantic memory
 * 3. Plan - Generate roadmap
 * 4. Structure - Create beads and convoys
 *
 * @param config - Lisa configuration
 * @returns Complete rescue output
 */
export async function rescue(config: LisaConfig): Promise<RescueOutput> {
  console.log("🔬 Starting rescue pipeline...");

  // Phase 1: Research - Git archaeology
  console.log("\n📊 Phase 1: Research (git archaeology)");
  const researchOutput = await research(config);

  // Phase 2: Discover - Extract semantic memory
  console.log("\n🧠 Phase 2: Discover (semantic memory extraction)");
  const semanticMemory = await discover(config);

  // Phase 3: Plan - Generate roadmap
  console.log("\n🗺️  Phase 3: Plan (roadmap generation)");
  const planning = await plan(config, semanticMemory);

  // Phase 4: Structure - Create work items
  console.log("\n📦 Phase 4: Structure (bead/convoy creation)");
  const structureData = await structure(config, planning);

  console.log("\n✅ Rescue pipeline complete!");

  return {
    research: {
      timeline: `${researchOutput.timeline.length} events`,
      complexity: researchOutput.rescueComplexity,
    },
    semanticMemory,
    planning,
    structure: structureData,
    timestamp: new Date().toISOString(),
  };
}
