/**
 * Core types for Lisa - Archaeological rescue & migration agent
 */

import { z } from "zod";

/**
 * Project stage definitions
 */
export const ProjectStage = z.enum([
  "abandoned",
  "mvp",
  "alpha",
  "beta",
  "early-release",
  "stable",
  "mature",
]);
export type ProjectStage = z.infer<typeof ProjectStage>;

/**
 * Semantic memory - Condensed project knowledge
 */
export const SemanticMemory = z.object({
  name: z.string(),
  stage: ProjectStage,
  purpose: z.string(),
  stack: z.array(z.string()),
  keyFiles: z.array(z.string()),
  dependencies: z.record(z.string()),
  architecture: z.string(),
  patterns: z.array(z.string()),
  openQuestions: z.array(z.string()),
  risks: z.array(z.string()),
  timestamp: z.string(),
});
export type SemanticMemory = z.infer<typeof SemanticMemory>;

/**
 * Git timeline event
 */
export const TimelineEvent = z.object({
  date: z.string(),
  commits: z.number(),
  files: z.array(z.string()),
  message: z.string(),
  activity: z.enum(["high", "medium", "low", "none"]),
});
export type TimelineEvent = z.infer<typeof TimelineEvent>;

/**
 * Research output - Archaeological analysis
 */
export const ResearchOutput = z.object({
  timeline: z.array(TimelineEvent),
  lastActivity: z.string(),
  totalCommits: z.number(),
  contributors: z.number(),
  abandonmentDate: z.string().optional(),
  rescueComplexity: z.enum(["low", "medium", "high", "critical"]),
});
export type ResearchOutput = z.infer<typeof ResearchOutput>;

/**
 * Roadmap phase
 */
export const RoadmapPhase = z.object({
  id: z.string(),
  name: z.string(),
  duration: z.string(),
  goals: z.array(z.string()),
  deliverables: z.array(z.string()),
  risks: z.array(z.string()),
  dependencies: z.array(z.string()),
});
export type RoadmapPhase = z.infer<typeof RoadmapPhase>;

/**
 * Planning output - Roadmap and scope
 */
export const PlanningOutput = z.object({
  vision: z.string(),
  currentStage: ProjectStage,
  targetStage: ProjectStage,
  phases: z.array(RoadmapPhase),
  northStarMetric: z.string(),
  completionCriteria: z.array(z.string()),
  openQuestions: z.array(z.string()),
});
export type PlanningOutput = z.infer<typeof PlanningOutput>;

/**
 * Work item (Bead) - Smallest unit of work
 */
export const Bead = z.object({
  id: z.string(),
  type: z.enum([
    "feature",
    "bugfix",
    "refactor",
    "docs",
    "test",
    "infrastructure",
  ]),
  title: z.string(),
  description: z.string(),
  acceptance: z.array(z.string()),
  estimate: z.string(),
  dependencies: z.array(z.string()),
  files: z.array(z.string()),
  tags: z.array(z.string()),
});
export type Bead = z.infer<typeof Bead>;

/**
 * Work bundle (Convoy) - Collection of related beads
 */
export const Convoy = z.object({
  id: z.string(),
  name: z.string(),
  objective: z.string(),
  beads: z.array(z.string()), // Bead IDs
  phase: z.string(),
  deliverables: z.array(z.string()),
  completionCriteria: z.array(z.string()),
});
export type Convoy = z.infer<typeof Convoy>;

/**
 * Structure output - Beads and convoys
 */
export const StructureOutput = z.object({
  beads: z.array(Bead),
  convoys: z.array(Convoy),
  totalWork: z.number(),
  estimatedDuration: z.string(),
});
export type StructureOutput = z.infer<typeof StructureOutput>;

/**
 * Project perspective - Self-reported state
 */
export const ProjectPerspective = z.object({
  name: z.string(),
  semanticMemory: SemanticMemory,
  beadCount: z.number(),
  convoyCount: z.number(),
  phase: z.string(),
  completionPercent: z.number(),
});
export type ProjectPerspective = z.infer<typeof ProjectPerspective>;

/**
 * Reconciliation output - Alignment report
 */
export const ReconciliationOutput = z.object({
  projects: z.array(ProjectPerspective),
  misalignments: z.array(z.string()),
  recommendations: z.array(z.string()),
  checkpoint: z.record(z.unknown()),
  timestamp: z.string(),
});
export type ReconciliationOutput = z.infer<typeof ReconciliationOutput>;

/**
 * Lisa configuration
 */
export const LisaConfig = z.object({
  projectRoot: z.string(),
  outputDir: z.string().default(".gt"),
  scopecraftDir: z.string().default("scopecraft"),
  excludePatterns: z.array(z.string()).default(["node_modules", "dist", ".git"]),
});
export type LisaConfig = z.infer<typeof LisaConfig>;
