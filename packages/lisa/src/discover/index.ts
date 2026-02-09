/**
 * Discover - Extract semantic memory from project
 * Scans codebase, docs, and configs to understand project state
 */

import { readFileSync, existsSync, readdirSync, statSync } from "fs";
import { join, extname } from "path";
import type { LisaConfig, SemanticMemory, ProjectStage } from "../types.js";

/**
 * Extract semantic memory by analyzing project structure and files
 *
 * @param config - Lisa configuration
 * @returns Semantic memory object
 */
export async function discover(config: LisaConfig): Promise<SemanticMemory> {
  const { projectRoot } = config;

  console.log(`🧠 Discovering project structure in ${projectRoot}...`);

  // Read package.json for name and dependencies
  const packageInfo = readPackageJson(projectRoot);

  // Detect tech stack
  const stack = detectTechStack(projectRoot);

  // Find key files
  const keyFiles = findKeyFiles(projectRoot);

  // Analyze architecture
  const architecture = analyzeArchitecture(projectRoot, stack);

  // Detect patterns
  const patterns = detectPatterns(projectRoot);

  // Infer project stage
  const stage = inferProjectStage(projectRoot);

  return {
    name: (packageInfo.name as string) || "unknown-project",
    stage,
    purpose: (packageInfo.description as string) || "No description available",
    stack,
    keyFiles,
    dependencies: (packageInfo.dependencies as Record<string, string>) || {},
    architecture,
    patterns,
    openQuestions: generateOpenQuestions(stack, keyFiles),
    risks: identifyRisks(stage, keyFiles),
    timestamp: new Date().toISOString(),
  };
}

/**
 * Read package.json if it exists
 */
function readPackageJson(projectRoot: string): Record<string, unknown> {
  const pkgPath = join(projectRoot, "package.json");
  if (existsSync(pkgPath)) {
    try {
      return JSON.parse(readFileSync(pkgPath, "utf8"));
    } catch (error) {
      console.warn("Failed to parse package.json:", error);
    }
  }
  return {};
}

/**
 * Detect technology stack from files and dependencies
 */
function detectTechStack(projectRoot: string): string[] {
  const stack: Set<string> = new Set();

  // Check package.json dependencies
  const pkg = readPackageJson(projectRoot);
  const allDeps = {
    ...(pkg.dependencies as Record<string, string>),
    ...(pkg.devDependencies as Record<string, string>),
  };

  // Detect frameworks and libraries
  if (allDeps.react) stack.add("React");
  if (allDeps.next) stack.add("Next.js");
  if (allDeps.vue) stack.add("Vue");
  if (allDeps.express) stack.add("Express");
  if (allDeps.fastify) stack.add("Fastify");
  if (allDeps.typescript) stack.add("TypeScript");
  if (allDeps.vitest || allDeps.jest) stack.add("Testing");
  if (allDeps.tailwindcss) stack.add("Tailwind CSS");
  if (allDeps["@conductor/core"]) stack.add("Conductor");

  // Check for configuration files
  if (existsSync(join(projectRoot, "tsconfig.json"))) stack.add("TypeScript");
  if (existsSync(join(projectRoot, "Dockerfile"))) stack.add("Docker");
  if (existsSync(join(projectRoot, "turbo.json"))) stack.add("Turborepo");
  if (existsSync(join(projectRoot, "vercel.json"))) stack.add("Vercel");
  if (existsSync(join(projectRoot, "wrangler.toml"))) stack.add("Cloudflare");

  return Array.from(stack);
}

/**
 * Find key project files
 */
function findKeyFiles(projectRoot: string): string[] {
  const keyFiles: string[] = [];

  const importantFiles = [
    "README.md",
    "CLAUDE.md",
    "package.json",
    "tsconfig.json",
    "turbo.json",
    "next.config.js",
    "vite.config.ts",
    "tailwind.config.js",
  ];

  for (const file of importantFiles) {
    if (existsSync(join(projectRoot, file))) {
      keyFiles.push(file);
    }
  }

  // Find main source directories
  const srcDirs = ["src", "app", "pages", "packages", "apps"];
  for (const dir of srcDirs) {
    if (existsSync(join(projectRoot, dir))) {
      keyFiles.push(`${dir}/`);
    }
  }

  return keyFiles;
}

/**
 * Analyze project architecture
 */
function analyzeArchitecture(projectRoot: string, stack: string[]): string {
  // Check for monorepo
  if (
    existsSync(join(projectRoot, "turbo.json")) ||
    existsSync(join(projectRoot, "pnpm-workspace.yaml"))
  ) {
    return "Monorepo with Turborepo";
  }

  // Check for specific architectures
  if (stack.includes("Next.js")) {
    return "Next.js App Router";
  }

  if (existsSync(join(projectRoot, "packages"))) {
    return "Multi-package workspace";
  }

  return "Standard Node.js project";
}

/**
 * Detect common patterns in codebase
 */
function detectPatterns(projectRoot: string): string[] {
  const patterns: Set<string> = new Set();

  // Check for common patterns
  if (existsSync(join(projectRoot, "packages"))) {
    patterns.add("Workspace packages");
  }

  if (existsSync(join(projectRoot, "apps"))) {
    patterns.add("Applications directory");
  }

  const pkg = readPackageJson(projectRoot);
  if (pkg.type === "module") {
    patterns.add("ES Modules");
  }

  if (existsSync(join(projectRoot, "src/components"))) {
    patterns.add("Component-based architecture");
  }

  return Array.from(patterns);
}

/**
 * Infer project stage from indicators
 */
function inferProjectStage(projectRoot: string): ProjectStage {
  const pkg = readPackageJson(projectRoot);
  const version = (pkg.version as string) || "0.0.0";

  // Check version number
  if (version.startsWith("0.")) return "alpha";
  if (version.startsWith("1.0")) return "stable";
  if (parseInt(version.split(".")[0], 10) >= 2) return "mature";

  // Check for tests
  const hasTests = existsSync(join(projectRoot, "src")) &&
    readdirSync(join(projectRoot, "src")).some((f) => f.includes(".test."));

  if (!hasTests) return "mvp";

  return "beta";
}

/**
 * Generate open questions based on analysis
 */
function generateOpenQuestions(stack: string[], keyFiles: string[]): string[] {
  const questions: string[] = [];

  if (!keyFiles.includes("README.md")) {
    questions.push("What is the project's purpose and goals?");
  }

  if (stack.length === 0) {
    questions.push("What is the primary technology stack?");
  }

  if (!keyFiles.some((f) => f.includes("test"))) {
    questions.push("What is the testing strategy?");
  }

  return questions;
}

/**
 * Identify potential risks
 */
function identifyRisks(stage: ProjectStage, keyFiles: string[]): string[] {
  const risks: string[] = [];

  if (stage === "abandoned") {
    risks.push("Project appears abandoned - significant rescue effort needed");
  }

  if (!keyFiles.includes("package.json")) {
    risks.push("Missing package.json - dependency management unclear");
  }

  return risks;
}
