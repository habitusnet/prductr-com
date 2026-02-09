/**
 * Carlos - Product roadmap and market fit assessment agent
 *
 * A tool for generating comprehensive product roadmaps, assessing market fit,
 * and auditing technical debt.
 */

export { generateRoadmap } from "./roadmap/index.js";
export { assessMarketFit } from "./market-fit/index.js";
export { prioritizeFeatures } from "./product/index.js";
export { auditTechnical } from "./technical/index.js";

export type {
  CarlosConfig,
  ProductStage,
  Roadmap,
  Phase,
  Epic,
  UserStory,
  MarketFitAssessment,
  TechnicalAudit,
  TechnicalDebtItem,
  ProductBacklog,
  FeaturePriority,
  Risk,
} from "./types.js";
