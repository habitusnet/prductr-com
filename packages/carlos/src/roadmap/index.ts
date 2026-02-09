/**
 * Roadmap - Generate comprehensive product roadmap
 * Creates phased roadmap with epics, stories, and milestones
 */

import { readFileSync, existsSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import type {
  CarlosConfig,
  Roadmap,
  Phase,
  Epic,
  ProductStage,
} from "../types.js";

/**
 * Generate comprehensive product roadmap
 *
 * @param config - Carlos configuration
 * @returns Complete roadmap with phases and epics
 */
export async function generateRoadmap(
  config: CarlosConfig,
): Promise<Roadmap> {
  console.log("🗺️  Generating product roadmap...");

  // Analyze project to determine stage
  const currentStage = inferProductStage(config.projectRoot);
  const targetStage = getNextStage(currentStage);

  // Read existing docs if available
  const vision = extractVision(config);
  const northStarMetric = determineNorthStarMetric(config, currentStage);

  // Generate epics based on stage progression
  const epics = generateEpics(currentStage, targetStage, config);

  // Create phased roadmap
  const phases = createPhases(currentStage, targetStage, epics);

  const roadmap: Roadmap = {
    vision,
    currentStage,
    targetStage,
    northStarMetric,
    phases,
    epics,
    timeline: estimateTimeline(phases),
    lastUpdated: new Date().toISOString(),
  };

  // Write scopecraft files
  writeRoadmapFiles(config, roadmap);

  return roadmap;
}

/**
 * Infer product stage from project state
 */
function inferProductStage(projectRoot: string): ProductStage {
  // Check for package.json and version
  const pkgPath = join(projectRoot, "package.json");
  if (existsSync(pkgPath)) {
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
    const version = pkg.version || "0.0.0";

    if (version.startsWith("0.0")) return "prototype";
    if (version.startsWith("0.")) return "mvp";
    if (version.startsWith("1.0")) return "beta";
    if (parseInt(version.split(".")[0], 10) >= 2) return "growth";
  }

  // Check for README
  if (!existsSync(join(projectRoot, "README.md"))) return "idea";

  return "mvp";
}

/**
 * Get next stage in progression
 */
function getNextStage(current: ProductStage): ProductStage {
  const progression: ProductStage[] = [
    "idea",
    "prototype",
    "mvp",
    "alpha",
    "beta",
    "early-release",
    "growth",
    "mature",
    "enterprise",
  ];

  const idx = progression.indexOf(current);
  if (idx === -1 || idx >= progression.length - 1) return "mature";

  return progression[idx + 1];
}

/**
 * Extract vision from existing docs
 */
function extractVision(config: CarlosConfig): string {
  const visionFile = join(
    config.projectRoot,
    config.outputDir,
    "VISION_AND_STAGE_DEFINITION.md",
  );

  if (existsSync(visionFile)) {
    const content = readFileSync(visionFile, "utf8");
    const match = content.match(/## Project Vision\n(.+?)(?:\n\n|\n#)/s);
    if (match) return match[1].trim();
  }

  // Fallback to package.json description
  const pkgPath = join(config.projectRoot, "package.json");
  if (existsSync(pkgPath)) {
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
    if (pkg.description) return pkg.description;
  }

  return "Build a successful product that delights users and achieves product-market fit";
}

/**
 * Determine north star metric
 */
function determineNorthStarMetric(
  config: CarlosConfig,
  stage: ProductStage,
): string {
  // Read existing metric if available
  const metricsFile = join(
    config.projectRoot,
    config.outputDir,
    "METRICS_AND_PMF.md",
  );

  if (existsSync(metricsFile)) {
    const content = readFileSync(metricsFile, "utf8");
    const match = content.match(/## North Star Metric\n(.+?)(?:\n\n|\n#)/s);
    if (match) return match[1].trim();
  }

  // Default metrics by stage
  const defaultMetrics: Record<ProductStage, string> = {
    idea: "Validated problem-solution fit",
    prototype: "User feedback quality score",
    mvp: "Weekly Active Users",
    alpha: "User retention rate (7-day)",
    beta: "Monthly Active Users",
    "early-release": "User growth rate",
    growth: "Revenue growth rate",
    mature: "Net Revenue Retention",
    enterprise: "Enterprise customer count",
  };

  return defaultMetrics[stage];
}

/**
 * Generate epics for stage transition
 */
function generateEpics(
  current: ProductStage,
  target: ProductStage,
  config: CarlosConfig,
): Epic[] {
  const epics: Epic[] = [];

  // Core epics based on stage
  if (current === "idea" || current === "prototype") {
    epics.push({
      id: "epic-001",
      title: "MVP Development",
      description: "Build minimum viable product with core features",
      businessValue: "Validate product-market fit with real users",
      userStories: ["user-001", "user-002", "user-003"],
      acceptanceCriteria: [
        "Core user flow is functional",
        "Users can complete primary use case",
        "Basic metrics tracking in place",
      ],
      dependencies: [],
      effort: "large",
      priority: "critical",
    });
  }

  if (current === "mvp" || current === "alpha") {
    epics.push({
      id: "epic-002",
      title: "User Onboarding",
      description: "Streamlined onboarding experience for new users",
      businessValue: "Reduce time-to-value and improve activation rate",
      userStories: ["user-004", "user-005"],
      acceptanceCriteria: [
        "Onboarding flow is < 2 minutes",
        "90% of users complete onboarding",
        "Clear value demonstration",
      ],
      dependencies: ["epic-001"],
      effort: "medium",
      priority: "high",
    });
  }

  // Testing & Quality epic
  epics.push({
    id: "epic-003",
    title: "Testing & Quality Assurance",
    description: "Comprehensive test coverage and quality infrastructure",
    businessValue: "Reduce bugs and increase user confidence",
    userStories: ["user-006", "user-007"],
    acceptanceCriteria: [
      "80%+ test coverage",
      "CI/CD pipeline functional",
      "Automated quality checks",
    ],
    dependencies: [],
    effort: "medium",
    priority: "high",
  });

  // Documentation epic
  epics.push({
    id: "epic-004",
    title: "Documentation & Developer Experience",
    description: "Complete documentation for users and developers",
    businessValue: "Enable self-service and reduce support burden",
    userStories: ["user-008"],
    acceptanceCriteria: [
      "README is comprehensive",
      "API documentation complete",
      "Getting started guide exists",
    ],
    dependencies: [],
    effort: "small",
    priority: "medium",
  });

  return epics;
}

/**
 * Create roadmap phases from epics
 */
function createPhases(
  current: ProductStage,
  target: ProductStage,
  epics: Epic[],
): Phase[] {
  const phases: Phase[] = [];

  // Phase 1: Foundation
  phases.push({
    id: "phase-1",
    name: "Foundation & Core Features",
    duration: "4-6 weeks",
    objectives: [
      "Establish core product functionality",
      "Set up quality infrastructure",
      "Create initial documentation",
    ],
    epics: epics.filter((e) => e.priority === "critical").map((e) => e.id),
    milestones: [
      "MVP feature complete",
      "Basic test coverage achieved",
      "README published",
    ],
    successMetrics: [
      "Core user flow functional",
      "First 10 users onboarded",
      "Zero critical bugs",
    ],
  });

  // Phase 2: Growth
  phases.push({
    id: "phase-2",
    name: "Growth & Optimization",
    duration: "6-8 weeks",
    objectives: [
      "Improve user experience",
      "Expand feature set",
      "Increase quality metrics",
    ],
    epics: epics.filter((e) => e.priority === "high").map((e) => e.id),
    milestones: [
      "Onboarding optimized",
      "80% test coverage",
      "Documentation complete",
    ],
    successMetrics: [
      "User activation rate > 50%",
      "Test coverage > 80%",
      "Support tickets < 5/week",
    ],
  });

  // Phase 3: Scale
  phases.push({
    id: "phase-3",
    name: "Scale & Polish",
    duration: "4-6 weeks",
    objectives: [
      "Production-ready infrastructure",
      "Performance optimization",
      "Advanced features",
    ],
    epics: epics.filter((e) => e.priority === "medium").map((e) => e.id),
    milestones: [
      "Production deployment",
      "Performance benchmarks met",
      "Advanced features shipped",
    ],
    successMetrics: [
      "100+ active users",
      "99.9% uptime",
      "NPS > 50",
    ],
  });

  return phases;
}

/**
 * Estimate total timeline
 */
function estimateTimeline(phases: Phase[]): string {
  let totalWeeks = 0;

  for (const phase of phases) {
    const match = phase.duration.match(/(\d+)-(\d+)\s+weeks/);
    if (match) {
      const avg = (parseInt(match[1]) + parseInt(match[2])) / 2;
      totalWeeks += avg;
    }
  }

  return `${Math.ceil(totalWeeks)} weeks (${Math.ceil(totalWeeks / 4)} months)`;
}

/**
 * Write roadmap files to scopecraft directory
 */
function writeRoadmapFiles(config: CarlosConfig, roadmap: Roadmap): void {
  const outputDir = join(config.projectRoot, config.outputDir);

  // Ensure directory exists
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  // Write ROADMAP.md
  const roadmapContent = `# Product Roadmap

## Vision
${roadmap.vision}

## Current State
**${roadmap.currentStage}** → **${roadmap.targetStage}**

## North Star Metric
${roadmap.northStarMetric}

## Timeline
${roadmap.timeline}

## Roadmap Phases

${roadmap.phases
  .map(
    (phase, i) => `### Phase ${i + 1}: ${phase.name}
**Duration:** ${phase.duration}

**Objectives:**
${phase.objectives.map((o) => `- ${o}`).join("\n")}

**Epics:**
${phase.epics.map((epicId) => {
  const epic = roadmap.epics.find((e) => e.id === epicId);
  return epic ? `- **${epic.title}** (${epic.effort}, ${epic.priority})` : "";
}).join("\n")}

**Milestones:**
${phase.milestones.map((m) => `- ${m}`).join("\n")}

**Success Metrics:**
${phase.successMetrics.map((s) => `- ${s}`).join("\n")}
`,
  )
  .join("\n")}

## Epics Detail

${roadmap.epics
  .map(
    (epic) => `### ${epic.title}
**ID:** ${epic.id}
**Priority:** ${epic.priority} | **Effort:** ${epic.effort}

${epic.description}

**Business Value:** ${epic.businessValue}

**Acceptance Criteria:**
${epic.acceptanceCriteria.map((ac) => `- [ ] ${ac}`).join("\n")}
`,
  )
  .join("\n")}

---
Last updated: ${new Date(roadmap.lastUpdated).toLocaleDateString()}
`;

  writeFileSync(join(outputDir, "ROADMAP.md"), roadmapContent);

  console.log(`✅ Wrote roadmap to ${outputDir}/ROADMAP.md`);
}
