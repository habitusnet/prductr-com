/**
 * Core types for Carlos - Product roadmap and market fit agent
 */

import { z } from "zod";

/**
 * Product maturity stage
 */
export const ProductStage = z.enum([
  "idea",
  "prototype",
  "mvp",
  "alpha",
  "beta",
  "early-release",
  "growth",
  "mature",
  "enterprise",
]);
export type ProductStage = z.infer<typeof ProductStage>;

/**
 * Epic - Large feature or capability
 */
export const Epic = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  businessValue: z.string(),
  userStories: z.array(z.string()),
  acceptanceCriteria: z.array(z.string()),
  dependencies: z.array(z.string()),
  effort: z.enum(["small", "medium", "large", "extra-large"]),
  priority: z.enum(["critical", "high", "medium", "low"]),
});
export type Epic = z.infer<typeof Epic>;

/**
 * User story
 */
export const UserStory = z.object({
  id: z.string(),
  epic: z.string(),
  title: z.string(),
  asA: z.string(),
  iWant: z.string(),
  soThat: z.string(),
  acceptanceCriteria: z.array(z.string()),
  estimate: z.string(),
});
export type UserStory = z.infer<typeof UserStory>;

/**
 * Roadmap phase
 */
export const Phase = z.object({
  id: z.string(),
  name: z.string(),
  duration: z.string(),
  objectives: z.array(z.string()),
  epics: z.array(z.string()), // Epic IDs
  milestones: z.array(z.string()),
  successMetrics: z.array(z.string()),
});
export type Phase = z.infer<typeof Phase>;

/**
 * Product roadmap
 */
export const Roadmap = z.object({
  vision: z.string(),
  currentStage: ProductStage,
  targetStage: ProductStage,
  northStarMetric: z.string(),
  phases: z.array(Phase),
  epics: z.array(Epic),
  timeline: z.string(),
  lastUpdated: z.string(),
});
export type Roadmap = z.infer<typeof Roadmap>;

/**
 * Market fit assessment
 */
export const MarketFitAssessment = z.object({
  productMarketFitScore: z.number().min(0).max(100),
  targetAudience: z.string(),
  problemStatement: z.string(),
  solution: z.string(),
  uniqueValueProposition: z.string(),
  competition: z.array(z.string()),
  differentiators: z.array(z.string()),
  riskFactors: z.array(z.string()),
  opportunities: z.array(z.string()),
  recommendations: z.array(z.string()),
});
export type MarketFitAssessment = z.infer<typeof MarketFitAssessment>;

/**
 * Technical debt item
 */
export const TechnicalDebtItem = z.object({
  id: z.string(),
  category: z.enum([
    "code-quality",
    "architecture",
    "dependencies",
    "testing",
    "documentation",
    "infrastructure",
    "security",
  ]),
  severity: z.enum(["critical", "high", "medium", "low"]),
  description: z.string(),
  impact: z.string(),
  effort: z.string(),
  recommendation: z.string(),
});
export type TechnicalDebtItem = z.infer<typeof TechnicalDebtItem>;

/**
 * Technical audit
 */
export const TechnicalAudit = z.object({
  overallHealth: z.number().min(0).max(100),
  debtItems: z.array(TechnicalDebtItem),
  architectureScore: z.number().min(0).max(100),
  codeQualityScore: z.number().min(0).max(100),
  testCoverageScore: z.number().min(0).max(100),
  securityScore: z.number().min(0).max(100),
  recommendations: z.array(z.string()),
  prioritizedActions: z.array(z.string()),
});
export type TechnicalAudit = z.infer<typeof TechnicalAudit>;

/**
 * Feature priority
 */
export const FeaturePriority = z.object({
  feature: z.string(),
  impact: z.number().min(1).max(10),
  effort: z.number().min(1).max(10),
  confidence: z.number().min(1).max(10),
  priority: z.number(), // Calculated: impact * confidence / effort
  recommendation: z.enum(["now", "next", "later", "never"]),
});
export type FeaturePriority = z.infer<typeof FeaturePriority>;

/**
 * Product backlog
 */
export const ProductBacklog = z.object({
  features: z.array(FeaturePriority),
  nowItems: z.array(z.string()),
  nextItems: z.array(z.string()),
  laterItems: z.array(z.string()),
  totalItems: z.number(),
});
export type ProductBacklog = z.infer<typeof ProductBacklog>;

/**
 * Risk item
 */
export const Risk = z.object({
  id: z.string(),
  category: z.enum([
    "technical",
    "market",
    "resource",
    "timeline",
    "dependency",
    "regulatory",
  ]),
  description: z.string(),
  likelihood: z.enum(["low", "medium", "high"]),
  impact: z.enum(["low", "medium", "high", "critical"]),
  mitigation: z.string(),
  owner: z.string().optional(),
});
export type Risk = z.infer<typeof Risk>;

/**
 * Carlos configuration
 */
export const CarlosConfig = z.object({
  projectRoot: z.string(),
  outputDir: z.string().default("scopecraft"),
  docsDir: z.string().default("docs"),
  includeMarketFit: z.boolean().default(true),
  includeTechnicalAudit: z.boolean().default(true),
});
export type CarlosConfig = z.infer<typeof CarlosConfig>;
