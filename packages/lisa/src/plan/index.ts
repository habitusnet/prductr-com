/**
 * Plan - Generate roadmap and scopecraft documentation
 * Creates phased roadmap from current stage to target stage
 */

import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";
import type {
  LisaConfig,
  SemanticMemory,
  PlanningOutput,
  RoadmapPhase,
  ProjectStage,
} from "../types.js";

/**
 * Generate roadmap and planning documentation
 *
 * @param config - Lisa configuration
 * @param semanticMemory - Project semantic memory from discover
 * @returns Planning output with roadmap phases
 */
export async function plan(
  config: LisaConfig,
  semanticMemory: SemanticMemory,
): Promise<PlanningOutput> {
  console.log(`🗺️  Generating roadmap for ${semanticMemory.name}...`);

  const currentStage = semanticMemory.stage;
  const targetStage = getNextStage(currentStage);

  // Generate roadmap phases
  const phases = generatePhases(currentStage, targetStage, semanticMemory);

  const planning: PlanningOutput = {
    vision: generateVision(semanticMemory),
    currentStage,
    targetStage,
    phases,
    northStarMetric: generateNorthStarMetric(semanticMemory),
    completionCriteria: generateCompletionCriteria(targetStage),
    openQuestions: semanticMemory.openQuestions,
  };

  // Write scopecraft files
  writeScopecraftFiles(config, planning, semanticMemory);

  return planning;
}

/**
 * Determine next stage in maturity progression
 */
function getNextStage(current: ProjectStage): ProjectStage {
  const progression: ProjectStage[] = [
    "abandoned",
    "mvp",
    "alpha",
    "beta",
    "early-release",
    "stable",
    "mature",
  ];

  const currentIndex = progression.indexOf(current);
  if (currentIndex === -1 || currentIndex >= progression.length - 1) {
    return "stable";
  }

  return progression[currentIndex + 1];
}

/**
 * Generate vision statement
 */
function generateVision(memory: SemanticMemory): string {
  return (
    memory.purpose ||
    `Transform ${memory.name} into a production-ready solution for its domain.`
  );
}

/**
 * Generate north star metric
 */
function generateNorthStarMetric(memory: SemanticMemory): string {
  if (memory.stack.includes("Dashboard") || memory.stack.includes("Next.js")) {
    return "Daily Active Users";
  }
  if (memory.stack.includes("Conductor")) {
    return "Agent Coordination Success Rate";
  }
  return "User Adoption Rate";
}

/**
 * Generate roadmap phases
 */
function generatePhases(
  current: ProjectStage,
  target: ProjectStage,
  memory: SemanticMemory,
): RoadmapPhase[] {
  // Generate 3-5 phases based on stage gap
  const phases: RoadmapPhase[] = [];

  if (current === "abandoned" || current === "mvp") {
    phases.push({
      id: "phase-1",
      name: "Foundation & Cleanup",
      duration: "2 weeks",
      goals: [
        "Remove technical debt",
        "Update dependencies",
        "Fix critical bugs",
      ],
      deliverables: [
        "Clean build with no errors",
        "Updated README",
        "Working tests",
      ],
      risks: ["Outdated dependencies may have breaking changes"],
      dependencies: [],
    });
  }

  phases.push({
    id: `phase-${phases.length + 1}`,
    name: "Core Features",
    duration: "3-4 weeks",
    goals: [
      "Implement missing core functionality",
      "Add comprehensive testing",
      "Improve documentation",
    ],
    deliverables: [
      "Feature-complete core",
      "80%+ test coverage",
      "API documentation",
    ],
    risks: ["Scope creep", "Unclear requirements"],
    dependencies: phases.length > 0 ? ["phase-1"] : [],
  });

  phases.push({
    id: `phase-${phases.length + 1}`,
    name: "Polish & Deploy",
    duration: "2-3 weeks",
    goals: [
      "Production deployment",
      "Performance optimization",
      "User experience refinement",
    ],
    deliverables: [
      "Live deployment",
      "Performance benchmarks",
      "User documentation",
    ],
    risks: ["Deployment complexity", "Performance issues"],
    dependencies: [`phase-${phases.length}`],
  });

  return phases;
}

/**
 * Generate completion criteria for target stage
 */
function generateCompletionCriteria(target: ProjectStage): string[] {
  const criteria: Record<ProjectStage, string[]> = {
    abandoned: ["Project structure restored", "Build system working"],
    mvp: [
      "Core functionality working",
      "Basic tests passing",
      "README complete",
    ],
    alpha: [
      "All features implemented",
      "60%+ test coverage",
      "Internal dogfooding started",
    ],
    beta: [
      "80%+ test coverage",
      "External users testing",
      "Bug tracking in place",
    ],
    "early-release": [
      "95%+ test coverage",
      "Production deployment",
      "Monitoring in place",
    ],
    stable: [
      "100% test coverage",
      "Public documentation",
      "SLA commitments met",
    ],
    mature: [
      "Enterprise features complete",
      "Multi-region deployment",
      "24/7 support available",
    ],
  };

  return criteria[target] || criteria.stable;
}

/**
 * Write scopecraft documentation files
 */
function writeScopecraftFiles(
  config: LisaConfig,
  planning: PlanningOutput,
  memory: SemanticMemory,
): void {
  const scopecraftDir = join(config.projectRoot, config.scopecraftDir);

  // Ensure directory exists
  if (!existsSync(scopecraftDir)) {
    mkdirSync(scopecraftDir, { recursive: true });
  }

  // Write ROADMAP.md
  const roadmapContent = `# Project Roadmap

## Vision
${planning.vision}

## Current Stage
**${planning.currentStage}** → **${planning.targetStage}**

## North Star Metric
${planning.northStarMetric}

## Roadmap Phases

${planning.phases
  .map(
    (phase, i) => `### Phase ${i + 1}: ${phase.name}
**Duration:** ${phase.duration}

**Goals:**
${phase.goals.map((g) => `- ${g}`).join("\n")}

**Deliverables:**
${phase.deliverables.map((d) => `- ${d}`).join("\n")}

**Risks:**
${phase.risks.map((r) => `- ${r}`).join("\n")}
`,
  )
  .join("\n")}

## Completion Criteria

${planning.completionCriteria.map((c) => `- [ ] ${c}`).join("\n")}

## Open Questions

${planning.openQuestions.map((q) => `- ${q}`).join("\n")}
`;

  writeFileSync(join(scopecraftDir, "ROADMAP.md"), roadmapContent);

  // Write VISION_AND_STAGE_DEFINITION.md
  const visionContent = `# Vision & Stage Definition

## Project Vision
${planning.vision}

## Current State
- **Stage:** ${planning.currentStage}
- **Stack:** ${memory.stack.join(", ")}
- **Architecture:** ${memory.architecture}

## Target State
- **Stage:** ${planning.targetStage}
- **North Star Metric:** ${planning.northStarMetric}

## Completion Criteria
${planning.completionCriteria.map((c) => `- [ ] ${c}`).join("\n")}
`;

  writeFileSync(
    join(scopecraftDir, "VISION_AND_STAGE_DEFINITION.md"),
    visionContent,
  );

  // Write OPEN_QUESTIONS.md
  const questionsContent = `# Open Questions

${planning.openQuestions.map((q, i) => `${i + 1}. ${q}`).join("\n\n")}
`;

  writeFileSync(join(scopecraftDir, "OPEN_QUESTIONS.md"), questionsContent);

  console.log(`✅ Wrote scopecraft files to ${scopecraftDir}/`);
}
