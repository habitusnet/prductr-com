/**
 * Structure - Create beads (work items) and convoys (bundles)
 * Transforms roadmap phases into executable work items
 */

import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";
import type {
  LisaConfig,
  PlanningOutput,
  StructureOutput,
  Bead,
  Convoy,
} from "../types.js";

/**
 * Generate work structure from planning output
 *
 * @param config - Lisa configuration
 * @param planning - Planning output from plan stage
 * @returns Structure output with beads and convoys
 */
export async function structure(
  config: LisaConfig,
  planning: PlanningOutput,
): Promise<StructureOutput> {
  console.log(`📦 Creating work structure...`);

  // Generate beads from roadmap phases
  const beads = generateBeads(planning);

  // Bundle beads into convoys
  const convoys = generateConvoys(planning, beads);

  // Calculate total work
  const totalWork = beads.length;
  const estimatedDuration = estimateDuration(beads);

  // Write to .gt directory
  writeWorkStructure(config, beads, convoys);

  return {
    beads,
    convoys,
    totalWork,
    estimatedDuration,
  };
}

/**
 * Generate beads from roadmap phases
 */
function generateBeads(planning: PlanningOutput): Bead[] {
  const beads: Bead[] = [];

  planning.phases.forEach((phase, phaseIndex) => {
    // Create beads for each goal
    phase.goals.forEach((goal, goalIndex) => {
      const beadId = `gt-${phase.id}-${String(goalIndex + 1).padStart(3, "0")}`;

      beads.push({
        id: beadId,
        type: inferBeadType(goal),
        title: goal,
        description: `Implement ${goal} as part of ${phase.name}`,
        acceptance: generateAcceptanceCriteria(goal),
        estimate: "3-5 days",
        dependencies:
          phaseIndex > 0 ? [`convoy-${String(phaseIndex).padStart(3, "0")}`] : [],
        files: [],
        tags: [phase.name.toLowerCase().replace(/\s+/g, "-")],
      });
    });

    // Create beads for each deliverable
    phase.deliverables.forEach((deliverable, delivIndex) => {
      const beadId = `gt-${phase.id}-d${String(delivIndex + 1).padStart(3, "0")}`;

      beads.push({
        id: beadId,
        type: "feature",
        title: `Deliver: ${deliverable}`,
        description: `Complete and deliver ${deliverable}`,
        acceptance: [`${deliverable} is complete and verified`],
        estimate: "2-3 days",
        dependencies: [],
        files: [],
        tags: [phase.name.toLowerCase().replace(/\s+/g, "-"), "deliverable"],
      });
    });
  });

  return beads;
}

/**
 * Infer bead type from goal description
 */
function inferBeadType(
  goal: string,
): "feature" | "bugfix" | "refactor" | "docs" | "test" | "infrastructure" {
  const lower = goal.toLowerCase();

  if (lower.includes("fix") || lower.includes("bug")) return "bugfix";
  if (lower.includes("refactor") || lower.includes("cleanup")) return "refactor";
  if (lower.includes("document") || lower.includes("readme")) return "docs";
  if (lower.includes("test") || lower.includes("coverage")) return "test";
  if (
    lower.includes("deploy") ||
    lower.includes("ci") ||
    lower.includes("infrastructure")
  )
    return "infrastructure";

  return "feature";
}

/**
 * Generate acceptance criteria for a goal
 */
function generateAcceptanceCriteria(goal: string): string[] {
  const criteria: string[] = [
    `${goal} is implemented`,
    "Tests are passing",
    "Documentation is updated",
  ];

  if (goal.toLowerCase().includes("test")) {
    criteria.push("Test coverage increased");
  }

  if (goal.toLowerCase().includes("deploy")) {
    criteria.push("Deployment is successful");
    criteria.push("Monitoring is in place");
  }

  return criteria;
}

/**
 * Bundle beads into convoys by phase
 */
function generateConvoys(planning: PlanningOutput, beads: Bead[]): Convoy[] {
  const convoys: Convoy[] = [];

  planning.phases.forEach((phase, index) => {
    const convoyId = `convoy-${String(index + 1).padStart(3, "0")}`;

    // Find beads for this phase
    const phaseBeads = beads.filter((bead) =>
      bead.tags.includes(phase.name.toLowerCase().replace(/\s+/g, "-")),
    );

    convoys.push({
      id: convoyId,
      name: phase.name,
      objective: phase.goals.join(", "),
      beads: phaseBeads.map((b) => b.id),
      phase: `phase-${index + 1}`,
      deliverables: phase.deliverables,
      completionCriteria: [
        "All beads completed",
        "All deliverables shipped",
        "No blocking issues",
      ],
    });
  });

  return convoys;
}

/**
 * Estimate total duration from beads
 */
function estimateDuration(beads: Bead[]): string {
  // Simple estimation: sum of bead estimates
  const totalDays = beads.length * 4; // Average 4 days per bead
  const weeks = Math.ceil(totalDays / 5);

  return `${weeks} weeks`;
}

/**
 * Write beads and convoys to .gt directory
 */
function writeWorkStructure(
  config: LisaConfig,
  beads: Bead[],
  convoys: Convoy[],
): void {
  const gtDir = join(config.projectRoot, config.outputDir);
  const beadsDir = join(gtDir, "beads");
  const convoysDir = join(gtDir, "convoys");

  // Ensure directories exist
  [gtDir, beadsDir, convoysDir].forEach((dir) => {
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  });

  // Write individual bead files
  beads.forEach((bead) => {
    writeFileSync(
      join(beadsDir, `${bead.id}.json`),
      JSON.stringify(bead, null, 2),
    );
  });

  // Write individual convoy files
  convoys.forEach((convoy) => {
    writeFileSync(
      join(convoysDir, `${convoy.id}.json`),
      JSON.stringify(convoy, null, 2),
    );
  });

  console.log(`✅ Wrote ${beads.length} beads and ${convoys.length} convoys to ${gtDir}/`);
}
