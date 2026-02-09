/**
 * Market Fit - Assess product-market fit and competitive position
 * Analyzes target audience, competition, and market opportunity
 */

import { readFileSync, existsSync, writeFileSync } from "fs";
import { join } from "path";
import type { CarlosConfig, MarketFitAssessment } from "../types.js";

/**
 * Assess product-market fit
 *
 * @param config - Carlos configuration
 * @returns Market fit assessment with score and recommendations
 */
export async function assessMarketFit(
  config: CarlosConfig,
): Promise<MarketFitAssessment> {
  console.log("📊 Assessing product-market fit...");

  // Read existing PRD if available
  const prdContent = readPRD(config);

  // Extract key components
  const targetAudience = extractTargetAudience(prdContent);
  const problemStatement = extractProblemStatement(prdContent);
  const solution = extractSolution(prdContent);
  const uvp = extractUVP(prdContent);
  const competition = identifyCompetition(prdContent);

  // Analyze positioning
  const differentiators = analyzeDifferentiators(solution, competition);
  const risks = identifyRisks(config, competition);
  const opportunities = identifyOpportunities(config, targetAudience);

  // Calculate PMF score
  const pmfScore = calculatePMFScore({
    hasClearAudience: targetAudience.length > 0,
    hasProblem: problemStatement.length > 0,
    hasSolution: solution.length > 0,
    hasUVP: uvp.length > 0,
    hasDifferentiators: differentiators.length > 0,
    competitionLevel: competition.length,
  });

  const recommendations = generateRecommendations(pmfScore, {
    targetAudience,
    problemStatement,
    solution,
    uvp,
    differentiators,
  });

  const assessment: MarketFitAssessment = {
    productMarketFitScore: pmfScore,
    targetAudience,
    problemStatement,
    solution,
    uniqueValueProposition: uvp,
    competition,
    differentiators,
    riskFactors: risks,
    opportunities,
    recommendations,
  };

  // Write assessment file
  writeMarketFitFile(config, assessment);

  return assessment;
}

/**
 * Read Product Requirements Document
 */
function readPRD(config: CarlosConfig): string {
  const prdPaths = [
    join(config.projectRoot, config.docsDir, "PRD.md"),
    join(config.projectRoot, "PRD.md"),
    join(config.projectRoot, "README.md"),
  ];

  for (const path of prdPaths) {
    if (existsSync(path)) {
      return readFileSync(path, "utf8");
    }
  }

  return "";
}

/**
 * Extract target audience from PRD
 */
function extractTargetAudience(prd: string): string {
  // Look for target audience section
  const patterns = [
    /##\s*Target Audience\s*\n(.+?)(?:\n\n|\n#)/s,
    /##\s*Users?\s*\n(.+?)(?:\n\n|\n#)/s,
    /##\s*Who is this for\?\s*\n(.+?)(?:\n\n|\n#)/s,
  ];

  for (const pattern of patterns) {
    const match = prd.match(pattern);
    if (match) return match[1].trim();
  }

  return "Target audience not clearly defined";
}

/**
 * Extract problem statement
 */
function extractProblemStatement(prd: string): string {
  const patterns = [
    /##\s*Problem\s*\n(.+?)(?:\n\n|\n#)/s,
    /##\s*Problem Statement\s*\n(.+?)(?:\n\n|\n#)/s,
    /##\s*Overview\s*\n(.+?)(?:\n\n|\n#)/s,
  ];

  for (const pattern of patterns) {
    const match = prd.match(pattern);
    if (match) return match[1].trim();
  }

  return "Problem not clearly articulated";
}

/**
 * Extract solution description
 */
function extractSolution(prd: string): string {
  const patterns = [
    /##\s*Solution\s*\n(.+?)(?:\n\n|\n#)/s,
    /##\s*Features\s*\n(.+?)(?:\n\n|\n#)/s,
    /##\s*Overview\s*\n(.+?)(?:\n\n|\n#)/s,
  ];

  for (const pattern of patterns) {
    const match = prd.match(pattern);
    if (match) return match[1].trim();
  }

  return "Solution not clearly described";
}

/**
 * Extract unique value proposition
 */
function extractUVP(prd: string): string {
  const patterns = [
    /##\s*(?:Unique )?Value Proposition\s*\n(.+?)(?:\n\n|\n#)/s,
    /##\s*Why\s+(?:us|this)\?\s*\n(.+?)(?:\n\n|\n#)/s,
  ];

  for (const pattern of patterns) {
    const match = prd.match(pattern);
    if (match) return match[1].trim();
  }

  return "Value proposition needs clarification";
}

/**
 * Identify competition
 */
function identifyCompetition(prd: string): string[] {
  const match = prd.match(/##\s*Compet(?:ition|itors)\s*\n(.+?)(?:\n\n|\n#)/s);
  if (!match) return [];

  // Extract bullet points
  const bullets = match[1].match(/^[-*]\s+(.+)$/gm);
  return bullets ? bullets.map((b) => b.replace(/^[-*]\s+/, "").trim()) : [];
}

/**
 * Analyze differentiators
 */
function analyzeDifferentiators(
  solution: string,
  competition: string[],
): string[] {
  const differentiators: string[] = [];

  // Look for key differentiating features
  if (solution.toLowerCase().includes("ai") || solution.toLowerCase().includes("machine learning")) {
    differentiators.push("AI-powered capabilities");
  }

  if (solution.toLowerCase().includes("real-time") || solution.toLowerCase().includes("realtime")) {
    differentiators.push("Real-time functionality");
  }

  if (solution.toLowerCase().includes("open source") || solution.toLowerCase().includes("open-source")) {
    differentiators.push("Open source approach");
  }

  if (competition.length === 0) {
    differentiators.push("First mover advantage");
  }

  if (differentiators.length === 0) {
    differentiators.push("Differentiation strategy needs development");
  }

  return differentiators;
}

/**
 * Identify risk factors
 */
function identifyRisks(config: CarlosConfig, competition: string[]): string[] {
  const risks: string[] = [];

  // Competition risk
  if (competition.length > 3) {
    risks.push("High competition in market space");
  }

  // Technical risk
  const pkgPath = join(config.projectRoot, "package.json");
  if (existsSync(pkgPath)) {
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
    const version = pkg.version || "0.0.0";

    if (version.startsWith("0.")) {
      risks.push("Early stage product - execution risk");
    }
  }

  // Documentation risk
  if (!existsSync(join(config.projectRoot, "README.md"))) {
    risks.push("Insufficient documentation for market entry");
  }

  return risks;
}

/**
 * Identify opportunities
 */
function identifyOpportunities(
  config: CarlosConfig,
  targetAudience: string,
): string[] {
  const opportunities: string[] = [];

  // Check for specific audience types
  if (targetAudience.toLowerCase().includes("developer")) {
    opportunities.push("Large developer community for adoption");
  }

  if (targetAudience.toLowerCase().includes("enterprise")) {
    opportunities.push("Enterprise market with high willingness to pay");
  }

  if (targetAudience.toLowerCase().includes("small business") || targetAudience.toLowerCase().includes("smb")) {
    opportunities.push("Underserved SMB market segment");
  }

  return opportunities;
}

/**
 * Calculate PMF score (0-100)
 */
function calculatePMFScore(factors: {
  hasClearAudience: boolean;
  hasProblem: boolean;
  hasSolution: boolean;
  hasUVP: boolean;
  hasDifferentiators: boolean;
  competitionLevel: number;
}): number {
  let score = 0;

  // Core factors (20 points each)
  if (factors.hasClearAudience) score += 20;
  if (factors.hasProblem) score += 20;
  if (factors.hasSolution) score += 20;
  if (factors.hasUVP) score += 20;

  // Differentiation (15 points)
  if (factors.hasDifferentiators) score += 15;

  // Competition factor (5 points - inverse of competition)
  if (factors.competitionLevel === 0) score += 5;
  else if (factors.competitionLevel <= 2) score += 3;
  else if (factors.competitionLevel <= 5) score += 1;

  return Math.min(score, 100);
}

/**
 * Generate recommendations
 */
function generateRecommendations(
  pmfScore: number,
  components: {
    targetAudience: string;
    problemStatement: string;
    solution: string;
    uvp: string;
    differentiators: string[];
  },
): string[] {
  const recommendations: string[] = [];

  if (pmfScore < 40) {
    recommendations.push("🚨 Critical: Define clear product-market fit strategy");
  }

  if (components.targetAudience.includes("not clearly defined")) {
    recommendations.push("Define specific target audience personas");
  }

  if (components.problemStatement.includes("not clearly articulated")) {
    recommendations.push("Articulate clear problem statement backed by research");
  }

  if (components.solution.includes("not clearly described")) {
    recommendations.push("Document solution approach and core features");
  }

  if (components.uvp.includes("needs clarification")) {
    recommendations.push("Develop compelling unique value proposition");
  }

  if (components.differentiators.length === 0) {
    recommendations.push("Identify and emphasize competitive differentiators");
  }

  if (pmfScore >= 70) {
    recommendations.push("✅ Strong PMF indicators - focus on execution and growth");
  }

  return recommendations;
}

/**
 * Write market fit assessment file
 */
function writeMarketFitFile(
  config: CarlosConfig,
  assessment: MarketFitAssessment,
): void {
  const outputPath = join(
    config.projectRoot,
    config.outputDir,
    "METRICS_AND_PMF.md",
  );

  const content = `# Metrics & Product-Market Fit

## Product-Market Fit Score
**${assessment.productMarketFitScore}/100**

${assessment.productMarketFitScore >= 70 ? "🟢 Strong" : assessment.productMarketFitScore >= 40 ? "🟡 Moderate" : "🔴 Weak"} product-market fit indicators

## Target Audience
${assessment.targetAudience}

## Problem Statement
${assessment.problemStatement}

## Solution
${assessment.solution}

## Unique Value Proposition
${assessment.uniqueValueProposition}

## Competition
${assessment.competition.length > 0 ? assessment.competition.map((c) => `- ${c}`).join("\n") : "_No direct competitors identified_"}

## Differentiators
${assessment.differentiators.map((d) => `- ${d}`).join("\n")}

## Risk Factors
${assessment.riskFactors.length > 0 ? assessment.riskFactors.map((r) => `- ⚠️ ${r}`).join("\n") : "_No major risks identified_"}

## Opportunities
${assessment.opportunities.length > 0 ? assessment.opportunities.map((o) => `- 🎯 ${o}`).join("\n") : "_Additional opportunities to explore_"}

## Recommendations
${assessment.recommendations.map((r, i) => `${i + 1}. ${r}`).join("\n")}

---
Generated: ${new Date().toISOString()}
`;

  writeFileSync(outputPath, content);

  console.log(`✅ Wrote market fit assessment to ${outputPath}`);
}
