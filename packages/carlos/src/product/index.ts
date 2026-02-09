/**
 * Product - Feature prioritization and backlog management
 * Implements RICE scoring and Now/Next/Later framework
 */

import { writeFileSync, existsSync } from "fs";
import { join } from "path";
import type { CarlosConfig, ProductBacklog, FeaturePriority } from "../types.js";

/**
 * Prioritize features and generate product backlog
 *
 * @param config - Carlos configuration
 * @param features - List of feature descriptions
 * @returns Prioritized product backlog
 */
export async function prioritizeFeatures(
  config: CarlosConfig,
  features: string[],
): Promise<ProductBacklog> {
  console.log("📋 Prioritizing product backlog...");

  // Score each feature
  const scoredFeatures = features.map((feature) =>
    scoreFeature(feature),
  );

  // Sort by priority score (descending)
  scoredFeatures.sort((a, b) => b.priority - a.priority);

  // Categorize into Now/Next/Later
  const nowItems = scoredFeatures
    .filter((f) => f.recommendation === "now")
    .map((f) => f.feature);

  const nextItems = scoredFeatures
    .filter((f) => f.recommendation === "next")
    .map((f) => f.feature);

  const laterItems = scoredFeatures
    .filter((f) => f.recommendation === "later")
    .map((f) => f.feature);

  const backlog: ProductBacklog = {
    features: scoredFeatures,
    nowItems,
    nextItems,
    laterItems,
    totalItems: features.length,
  };

  // Write backlog file
  writeBacklogFile(config, backlog);

  return backlog;
}

/**
 * Score a feature using simplified RICE framework
 * Priority = (Impact * Confidence) / Effort
 */
function scoreFeature(feature: string): FeaturePriority {
  // Estimate impact based on feature description
  const impact = estimateImpact(feature);

  // Estimate effort based on feature complexity
  const effort = estimateEffort(feature);

  // Estimate confidence based on clarity
  const confidence = estimateConfidence(feature);

  // Calculate priority score
  const priority = (impact * confidence) / effort;

  // Determine recommendation
  let recommendation: "now" | "next" | "later" | "never";
  if (priority >= 5) recommendation = "now";
  else if (priority >= 2) recommendation = "next";
  else if (priority >= 1) recommendation = "later";
  else recommendation = "never";

  return {
    feature,
    impact,
    effort,
    confidence,
    priority: Math.round(priority * 10) / 10,
    recommendation,
  };
}

/**
 * Estimate impact (1-10)
 */
function estimateImpact(feature: string): number {
  const lower = feature.toLowerCase();

  // High impact keywords
  if (
    lower.includes("core") ||
    lower.includes("critical") ||
    lower.includes("essential") ||
    lower.includes("must-have")
  ) {
    return 9;
  }

  // User-facing features
  if (
    lower.includes("user") ||
    lower.includes("experience") ||
    lower.includes("onboarding")
  ) {
    return 7;
  }

  // Performance/quality improvements
  if (
    lower.includes("performance") ||
    lower.includes("quality") ||
    lower.includes("reliability")
  ) {
    return 6;
  }

  // Nice-to-have features
  if (
    lower.includes("enhancement") ||
    lower.includes("improvement") ||
    lower.includes("polish")
  ) {
    return 4;
  }

  // Default moderate impact
  return 5;
}

/**
 * Estimate effort (1-10, higher = more effort)
 */
function estimateEffort(feature: string): number {
  const lower = feature.toLowerCase();

  // High effort keywords
  if (
    lower.includes("redesign") ||
    lower.includes("rebuild") ||
    lower.includes("migrate") ||
    lower.includes("refactor all")
  ) {
    return 9;
  }

  // Medium-high effort
  if (
    lower.includes("integrate") ||
    lower.includes("implement") ||
    lower.includes("develop")
  ) {
    return 6;
  }

  // Low effort keywords
  if (
    lower.includes("fix") ||
    lower.includes("update") ||
    lower.includes("tweak") ||
    lower.includes("adjust")
  ) {
    return 2;
  }

  // Default moderate effort
  return 5;
}

/**
 * Estimate confidence (1-10)
 */
function estimateConfidence(feature: string): number {
  const lower = feature.toLowerCase();

  // High confidence - clear, specific features
  if (
    lower.includes("add") ||
    lower.includes("create") ||
    lower.includes("implement") ||
    lower.match(/^\w+\s+\w+$/)
  ) {
    return 8;
  }

  // Low confidence - vague or exploratory
  if (
    lower.includes("explore") ||
    lower.includes("investigate") ||
    lower.includes("consider") ||
    lower.includes("maybe")
  ) {
    return 3;
  }

  // Default moderate confidence
  return 6;
}

/**
 * Write backlog to file
 */
function writeBacklogFile(config: CarlosConfig, backlog: ProductBacklog): void {
  const outputPath = join(
    config.projectRoot,
    config.outputDir,
    "PRODUCT_BACKLOG.md",
  );

  const content = `# Product Backlog

Total Features: ${backlog.totalItems}

## Now (Next Sprint) - ${backlog.nowItems.length} items

High priority features that should be built immediately.

${backlog.nowItems.map((item, i) => {
  const feature = backlog.features.find((f) => f.feature === item);
  return `### ${i + 1}. ${item}

- **Priority Score:** ${feature?.priority}
- **Impact:** ${feature?.impact}/10
- **Effort:** ${feature?.effort}/10
- **Confidence:** ${feature?.confidence}/10
`;
}).join("\n")}

## Next (Upcoming) - ${backlog.nextItems.length} items

Important features for subsequent iterations.

${backlog.nextItems.map((item, i) => {
  const feature = backlog.features.find((f) => f.feature === item);
  return `${i + 1}. **${item}** (Priority: ${feature?.priority}, Impact: ${feature?.impact}/10, Effort: ${feature?.effort}/10)`;
}).join("\n")}

## Later (Backlog) - ${backlog.laterItems.length} items

Features to consider for future development.

${backlog.laterItems.map((item, i) => {
  const feature = backlog.features.find((f) => f.feature === item);
  return `${i + 1}. ${item} (Priority: ${feature?.priority})`;
}).join("\n")}

## Prioritization Framework

**RICE Scoring:**
- **Reach:** How many users will this impact?
- **Impact:** How much will it improve their experience?
- **Confidence:** How confident are we in the estimates?
- **Effort:** How much time/resources will it take?

**Formula:** Priority = (Impact × Confidence) / Effort

---
Generated: ${new Date().toISOString()}
`;

  writeFileSync(outputPath, content);

  console.log(`✅ Wrote product backlog to ${outputPath}`);
}
