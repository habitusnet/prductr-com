/**
 * Reconcile - Multi-project alignment and ecosystem coordination
 * Compares project perspectives with ecosystem planning
 */

import { readFileSync, writeFileSync, existsSync, readdirSync } from "fs";
import { join } from "path";
import type {
  LisaConfig,
  ReconciliationOutput,
  ProjectPerspective,
  SemanticMemory,
} from "../types.js";

/**
 * Reconcile multiple projects against ecosystem planning
 *
 * @param config - Lisa configuration for ecosystem root
 * @param projectRoots - Array of project root paths to reconcile
 * @returns Reconciliation output with alignment analysis
 */
export async function reconcile(
  config: LisaConfig,
  projectRoots: string[],
): Promise<ReconciliationOutput> {
  console.log(`🔄 Reconciling ${projectRoots.length} projects...`);

  // Gather perspectives from all projects
  const projects = await gatherProjectPerspectives(projectRoots);

  // Identify misalignments
  const misalignments = identifyMisalignments(projects);

  // Generate recommendations
  const recommendations = generateRecommendations(projects, misalignments);

  // Create checkpoint for context recovery
  const checkpoint = createCheckpoint(projects);

  // Write alignment report
  writeAlignmentReport(config, projects, misalignments, recommendations);

  return {
    projects,
    misalignments,
    recommendations,
    checkpoint,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Gather perspectives from all projects
 */
async function gatherProjectPerspectives(
  projectRoots: string[],
): Promise<ProjectPerspective[]> {
  const perspectives: ProjectPerspective[] = [];

  for (const root of projectRoots) {
    try {
      const perspective = await gatherSinglePerspective(root);
      perspectives.push(perspective);
    } catch (error) {
      console.warn(`Failed to gather perspective for ${root}:`, error);
    }
  }

  return perspectives;
}

/**
 * Gather perspective from a single project
 */
async function gatherSinglePerspective(
  projectRoot: string,
): Promise<ProjectPerspective> {
  // Read semantic memory
  const memoryPath = join(projectRoot, ".gt/memory/semantic.json");
  const semanticMemory: SemanticMemory = existsSync(memoryPath)
    ? JSON.parse(readFileSync(memoryPath, "utf8"))
    : {
        name: "unknown",
        stage: "mvp",
        purpose: "",
        stack: [],
        keyFiles: [],
        dependencies: {},
        architecture: "",
        patterns: [],
        openQuestions: [],
        risks: [],
        timestamp: new Date().toISOString(),
      };

  // Count beads and convoys
  const beadsDir = join(projectRoot, ".gt/beads");
  const convoysDir = join(projectRoot, ".gt/convoys");

  const beadCount = existsSync(beadsDir) ? readdirSync(beadsDir).length : 0;
  const convoyCount = existsSync(convoysDir)
    ? readdirSync(convoysDir).length
    : 0;

  // Estimate completion
  const completionPercent = estimateCompletion(projectRoot);

  return {
    name: semanticMemory.name,
    semanticMemory,
    beadCount,
    convoyCount,
    phase: semanticMemory.stage,
    completionPercent,
  };
}

/**
 * Estimate project completion percentage
 */
function estimateCompletion(projectRoot: string): number {
  // Simple heuristic based on presence of key files
  let score = 0;
  const checks = [
    { file: "README.md", weight: 10 },
    { file: "package.json", weight: 10 },
    { file: ".gt/memory/semantic.json", weight: 20 },
    { file: "scopecraft/ROADMAP.md", weight: 20 },
    { file: ".gt/beads", weight: 20 },
    { file: ".gt/convoys", weight: 20 },
  ];

  for (const check of checks) {
    if (existsSync(join(projectRoot, check.file))) {
      score += check.weight;
    }
  }

  return Math.min(score, 100);
}

/**
 * Identify misalignments between projects
 */
function identifyMisalignments(projects: ProjectPerspective[]): string[] {
  const misalignments: string[] = [];

  // Check for stage inconsistencies
  const stages = projects.map((p) => p.phase);
  if (new Set(stages).size > 1) {
    misalignments.push(
      `Projects at different stages: ${Array.from(new Set(stages)).join(", ")}`,
    );
  }

  // Check for incomplete projects
  const incomplete = projects.filter((p) => p.completionPercent < 50);
  if (incomplete.length > 0) {
    misalignments.push(
      `${incomplete.length} projects below 50% completion: ${incomplete.map((p) => p.name).join(", ")}`,
    );
  }

  // Check for missing work structure
  const missingStructure = projects.filter(
    (p) => p.beadCount === 0 || p.convoyCount === 0,
  );
  if (missingStructure.length > 0) {
    misalignments.push(
      `${missingStructure.length} projects missing work structure: ${missingStructure.map((p) => p.name).join(", ")}`,
    );
  }

  return misalignments;
}

/**
 * Generate recommendations based on analysis
 */
function generateRecommendations(
  projects: ProjectPerspective[],
  misalignments: string[],
): string[] {
  const recommendations: string[] = [];

  if (misalignments.length === 0) {
    recommendations.push("Projects are well-aligned - continue execution");
    return recommendations;
  }

  // Recommend structure creation
  const needsStructure = projects.filter((p) => p.beadCount === 0);
  if (needsStructure.length > 0) {
    recommendations.push(
      `Run /lisa:structure for: ${needsStructure.map((p) => p.name).join(", ")}`,
    );
  }

  // Recommend planning updates
  const lowCompletion = projects.filter((p) => p.completionPercent < 30);
  if (lowCompletion.length > 0) {
    recommendations.push(
      `Update planning for: ${lowCompletion.map((p) => p.name).join(", ")}`,
    );
  }

  return recommendations;
}

/**
 * Create checkpoint for context recovery
 */
function createCheckpoint(
  projects: ProjectPerspective[],
): Record<string, unknown> {
  return {
    version: "1.0",
    timestamp: new Date().toISOString(),
    projectCount: projects.length,
    projects: projects.map((p) => ({
      name: p.name,
      stage: p.phase,
      completion: p.completionPercent,
    })),
  };
}

/**
 * Write alignment report to scopecraft
 */
function writeAlignmentReport(
  config: LisaConfig,
  projects: ProjectPerspective[],
  misalignments: string[],
  recommendations: string[],
): void {
  const reportPath = join(
    config.projectRoot,
    config.scopecraftDir,
    "ALIGNMENT_REPORT.md",
  );

  const content = `# Ecosystem Alignment Report

Generated: ${new Date().toISOString()}

## Projects Analyzed

${projects.map((p) => `- **${p.name}** (${p.phase}, ${p.completionPercent}% complete)`).join("\n")}

## Misalignments

${misalignments.length > 0 ? misalignments.map((m) => `- ⚠️ ${m}`).join("\n") : "_No misalignments detected_"}

## Recommendations

${recommendations.map((r) => `- ${r}`).join("\n")}

## Summary

- Total Projects: ${projects.length}
- Average Completion: ${Math.round(projects.reduce((sum, p) => sum + p.completionPercent, 0) / projects.length)}%
- Total Work Items: ${projects.reduce((sum, p) => sum + p.beadCount, 0)} beads, ${projects.reduce((sum, p) => sum + p.convoyCount, 0)} convoys
`;

  writeFileSync(reportPath, content);
  console.log(`✅ Wrote alignment report to ${reportPath}`);
}
