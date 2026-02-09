/**
 * Technical - Technical debt audit and infrastructure assessment
 * Evaluates code quality, architecture, testing, and security
 */

import { readFileSync, existsSync, readdirSync, statSync } from "fs";
import { join } from "path";
import { writeFileSync } from "fs";
import type {
  CarlosConfig,
  TechnicalAudit,
  TechnicalDebtItem,
} from "../types.js";

/**
 * Perform technical audit
 *
 * @param config - Carlos configuration
 * @returns Technical audit with scores and debt items
 */
export async function auditTechnical(
  config: CarlosConfig,
): Promise<TechnicalAudit> {
  console.log("🔍 Performing technical audit...");

  // Collect debt items
  const debtItems: TechnicalDebtItem[] = [];

  // Audit different areas
  debtItems.push(...auditCodeQuality(config));
  debtItems.push(...auditArchitecture(config));
  debtItems.push(...auditTesting(config));
  debtItems.push(...auditDependencies(config));
  debtItems.push(...auditSecurity(config));
  debtItems.push(...auditDocumentation(config));

  // Calculate scores
  const codeQualityScore = calculateCodeQualityScore(config, debtItems);
  const architectureScore = calculateArchitectureScore(config, debtItems);
  const testCoverageScore = calculateTestCoverageScore(config, debtItems);
  const securityScore = calculateSecurityScore(config, debtItems);

  const overallHealth = Math.round(
    (codeQualityScore + architectureScore + testCoverageScore + securityScore) /
      4,
  );

  const recommendations = generateTechnicalRecommendations(
    debtItems,
    overallHealth,
  );
  const prioritizedActions = prioritizeActions(debtItems);

  const audit: TechnicalAudit = {
    overallHealth,
    debtItems,
    architectureScore,
    codeQualityScore,
    testCoverageScore,
    securityScore,
    recommendations,
    prioritizedActions,
  };

  // Write audit file
  writeTechnicalAuditFile(config, audit);

  return audit;
}

/**
 * Audit code quality
 */
function auditCodeQuality(config: CarlosConfig): TechnicalDebtItem[] {
  const items: TechnicalDebtItem[] = [];

  // Check for linter config
  const linterConfigs = [".eslintrc", ".eslintrc.json", "eslint.config.js"];
  const hasLinter = linterConfigs.some((f) =>
    existsSync(join(config.projectRoot, f)),
  );

  if (!hasLinter) {
    items.push({
      id: "debt-001",
      category: "code-quality",
      severity: "medium",
      description: "No linter configuration found",
      impact: "Inconsistent code style and potential bugs",
      effort: "1-2 days",
      recommendation: "Add ESLint with recommended config",
    });
  }

  // Check for formatter
  const hasFormatter =
    existsSync(join(config.projectRoot, ".prettierrc")) ||
    existsSync(join(config.projectRoot, "prettier.config.js"));

  if (!hasFormatter) {
    items.push({
      id: "debt-002",
      category: "code-quality",
      severity: "low",
      description: "No code formatter configured",
      impact: "Inconsistent code formatting",
      effort: "1 day",
      recommendation: "Add Prettier for automatic formatting",
    });
  }

  return items;
}

/**
 * Audit architecture
 */
function auditArchitecture(config: CarlosConfig): TechnicalDebtItem[] {
  const items: TechnicalDebtItem[] = [];

  // Check for TypeScript
  const hasTypeScript = existsSync(
    join(config.projectRoot, "tsconfig.json"),
  );

  if (!hasTypeScript) {
    items.push({
      id: "debt-003",
      category: "architecture",
      severity: "high",
      description: "Project not using TypeScript",
      impact: "Lack of type safety increases bug risk",
      effort: "2-4 weeks",
      recommendation: "Migrate to TypeScript for better type safety",
    });
  }

  // Check for monorepo
  const isMonorepo =
    existsSync(join(config.projectRoot, "turbo.json")) ||
    existsSync(join(config.projectRoot, "pnpm-workspace.yaml"));

  if (!isMonorepo && existsSync(join(config.projectRoot, "packages"))) {
    items.push({
      id: "debt-004",
      category: "architecture",
      severity: "medium",
      description: "Monorepo structure without build orchestration",
      impact: "Inefficient builds and dependency management",
      effort: "1 week",
      recommendation: "Add Turborepo for build orchestration",
    });
  }

  return items;
}

/**
 * Audit testing
 */
function auditTesting(config: CarlosConfig): TechnicalDebtItem[] {
  const items: TechnicalDebtItem[] = [];

  // Check for test framework
  const pkgPath = join(config.projectRoot, "package.json");
  let hasTests = false;

  if (existsSync(pkgPath)) {
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
    const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };

    hasTests =
      allDeps.vitest || allDeps.jest || allDeps.mocha || allDeps.ava;
  }

  if (!hasTests) {
    items.push({
      id: "debt-005",
      category: "testing",
      severity: "critical",
      description: "No testing framework configured",
      impact: "No automated testing - high bug risk",
      effort: "1-2 weeks",
      recommendation: "Add Vitest or Jest for comprehensive testing",
    });
  }

  // Check for test files
  const hasTestFiles = findTestFiles(config.projectRoot).length > 0;

  if (hasTests && !hasTestFiles) {
    items.push({
      id: "debt-006",
      category: "testing",
      severity: "high",
      description: "Test framework present but no test files",
      impact: "Zero test coverage",
      effort: "2-4 weeks",
      recommendation: "Write tests for critical functionality",
    });
  }

  return items;
}

/**
 * Find test files in project
 */
function findTestFiles(dir: string): string[] {
  const testFiles: string[] = [];
  const excludeDirs = ["node_modules", "dist", ".next", ".git"];

  try {
    const entries = readdirSync(dir);

    for (const entry of entries) {
      if (excludeDirs.includes(entry)) continue;

      const fullPath = join(dir, entry);
      const stat = statSync(fullPath);

      if (stat.isDirectory()) {
        testFiles.push(...findTestFiles(fullPath));
      } else if (
        entry.includes(".test.") ||
        entry.includes(".spec.") ||
        entry.endsWith("_test.ts") ||
        entry.endsWith("_test.js")
      ) {
        testFiles.push(fullPath);
      }
    }
  } catch (error) {
    // Ignore permission errors
  }

  return testFiles;
}

/**
 * Audit dependencies
 */
function auditDependencies(config: CarlosConfig): TechnicalDebtItem[] {
  const items: TechnicalDebtItem[] = [];

  const pkgPath = join(config.projectRoot, "package.json");
  if (!existsSync(pkgPath)) return items;

  const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));

  // Check for lock file
  const hasLockFile =
    existsSync(join(config.projectRoot, "package-lock.json")) ||
    existsSync(join(config.projectRoot, "yarn.lock")) ||
    existsSync(join(config.projectRoot, "pnpm-lock.yaml"));

  if (!hasLockFile) {
    items.push({
      id: "debt-007",
      category: "dependencies",
      severity: "high",
      description: "No package lock file",
      impact: "Inconsistent dependency versions across environments",
      effort: "1 hour",
      recommendation: "Generate and commit lock file",
    });
  }

  return items;
}

/**
 * Audit security
 */
function auditSecurity(config: CarlosConfig): TechnicalDebtItem[] {
  const items: TechnicalDebtItem[] = [];

  // Check for environment file in git
  const gitignorePath = join(config.projectRoot, ".gitignore");
  if (existsSync(gitignorePath)) {
    const gitignore = readFileSync(gitignorePath, "utf8");

    if (!gitignore.includes(".env")) {
      items.push({
        id: "debt-008",
        category: "security",
        severity: "critical",
        description: ".env not in .gitignore",
        impact: "Risk of exposing secrets in version control",
        effort: "5 minutes",
        recommendation: "Add .env* to .gitignore immediately",
      });
    }
  }

  return items;
}

/**
 * Audit documentation
 */
function auditDocumentation(config: CarlosConfig): TechnicalDebtItem[] {
  const items: TechnicalDebtItem[] = [];

  // Check for README
  const hasREADME = existsSync(join(config.projectRoot, "README.md"));

  if (!hasREADME) {
    items.push({
      id: "debt-009",
      category: "documentation",
      severity: "medium",
      description: "No README.md file",
      impact: "Difficult for new contributors to get started",
      effort: "1 day",
      recommendation: "Create comprehensive README with setup instructions",
    });
  }

  return items;
}

/**
 * Calculate code quality score
 */
function calculateCodeQualityScore(
  config: CarlosConfig,
  debtItems: TechnicalDebtItem[],
): number {
  let score = 100;

  const qualityIssues = debtItems.filter((d) => d.category === "code-quality");

  for (const issue of qualityIssues) {
    if (issue.severity === "critical") score -= 30;
    else if (issue.severity === "high") score -= 20;
    else if (issue.severity === "medium") score -= 10;
    else score -= 5;
  }

  return Math.max(score, 0);
}

/**
 * Calculate architecture score
 */
function calculateArchitectureScore(
  config: CarlosConfig,
  debtItems: TechnicalDebtItem[],
): number {
  let score = 100;

  const archIssues = debtItems.filter((d) => d.category === "architecture");

  for (const issue of archIssues) {
    if (issue.severity === "critical") score -= 30;
    else if (issue.severity === "high") score -= 20;
    else if (issue.severity === "medium") score -= 10;
    else score -= 5;
  }

  return Math.max(score, 0);
}

/**
 * Calculate test coverage score
 */
function calculateTestCoverageScore(
  config: CarlosConfig,
  debtItems: TechnicalDebtItem[],
): number {
  let score = 100;

  const testIssues = debtItems.filter((d) => d.category === "testing");

  for (const issue of testIssues) {
    if (issue.severity === "critical") score -= 40;
    else if (issue.severity === "high") score -= 25;
    else if (issue.severity === "medium") score -= 15;
    else score -= 5;
  }

  return Math.max(score, 0);
}

/**
 * Calculate security score
 */
function calculateSecurityScore(
  config: CarlosConfig,
  debtItems: TechnicalDebtItem[],
): number {
  let score = 100;

  const securityIssues = debtItems.filter((d) => d.category === "security");

  for (const issue of securityIssues) {
    if (issue.severity === "critical") score -= 50;
    else if (issue.severity === "high") score -= 30;
    else if (issue.severity === "medium") score -= 15;
    else score -= 5;
  }

  return Math.max(score, 0);
}

/**
 * Generate recommendations
 */
function generateTechnicalRecommendations(
  debtItems: TechnicalDebtItem[],
  overallHealth: number,
): string[] {
  const recommendations: string[] = [];

  if (overallHealth < 50) {
    recommendations.push(
      "🚨 Critical: Address technical debt before adding new features",
    );
  }

  const criticalItems = debtItems.filter((d) => d.severity === "critical");
  if (criticalItems.length > 0) {
    recommendations.push(
      `Immediately address ${criticalItems.length} critical technical debt items`,
    );
  }

  const testingIssues = debtItems.filter((d) => d.category === "testing");
  if (testingIssues.length > 0) {
    recommendations.push(
      "Prioritize testing infrastructure - foundation for quality",
    );
  }

  if (overallHealth >= 80) {
    recommendations.push(
      "✅ Strong technical foundation - maintain quality as you scale",
    );
  }

  return recommendations;
}

/**
 * Prioritize actions
 */
function prioritizeActions(debtItems: TechnicalDebtItem[]): string[] {
  // Sort by severity: critical > high > medium > low
  const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };

  const sorted = [...debtItems].sort(
    (a, b) => severityOrder[a.severity] - severityOrder[b.severity],
  );

  return sorted.slice(0, 5).map((item) => item.recommendation);
}

/**
 * Write technical audit file
 */
function writeTechnicalAuditFile(
  config: CarlosConfig,
  audit: TechnicalAudit,
): void {
  const outputPath = join(
    config.projectRoot,
    config.outputDir,
    "TECHNICAL_AUDIT.md",
  );

  const content = `# Technical Audit Report

## Overall Health Score
**${audit.overallHealth}/100** ${audit.overallHealth >= 80 ? "🟢" : audit.overallHealth >= 50 ? "🟡" : "🔴"}

## Category Scores

| Category | Score | Status |
|----------|-------|--------|
| Code Quality | ${audit.codeQualityScore}/100 | ${audit.codeQualityScore >= 70 ? "✅" : "⚠️"} |
| Architecture | ${audit.architectureScore}/100 | ${audit.architectureScore >= 70 ? "✅" : "⚠️"} |
| Test Coverage | ${audit.testCoverageScore}/100 | ${audit.testCoverageScore >= 70 ? "✅" : "⚠️"} |
| Security | ${audit.securityScore}/100 | ${audit.securityScore >= 70 ? "✅" : "⚠️"} |

## Technical Debt Items (${audit.debtItems.length})

${audit.debtItems
  .map(
    (item) => `### ${item.id}: ${item.description}
**Category:** ${item.category} | **Severity:** ${item.severity}

**Impact:** ${item.impact}

**Effort:** ${item.effort}

**Recommendation:** ${item.recommendation}
`,
  )
  .join("\n")}

## Recommendations

${audit.recommendations.map((r, i) => `${i + 1}. ${r}`).join("\n")}

## Prioritized Actions

${audit.prioritizedActions.map((a, i) => `${i + 1}. ${a}`).join("\n")}

---
Generated: ${new Date().toISOString()}
`;

  writeFileSync(outputPath, content);

  console.log(`✅ Wrote technical audit to ${outputPath}`);
}
