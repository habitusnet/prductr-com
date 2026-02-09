/**
 * Research - Git archaeology and timeline analysis
 * Reconstructs lost context from abandoned codebases
 */

import { execFileSync } from "child_process";
import { existsSync } from "fs";
import { join } from "path";
import type { LisaConfig, ResearchOutput, TimelineEvent } from "../types.js";

/**
 * Analyze git history to understand project timeline and abandonment
 *
 * @param config - Lisa configuration
 * @returns Research output with timeline and analysis
 */
export async function research(config: LisaConfig): Promise<ResearchOutput> {
  const { projectRoot } = config;

  // Verify git repository
  if (!existsSync(join(projectRoot, ".git"))) {
    throw new Error(`Not a git repository: ${projectRoot}`);
  }

  console.log(`🔍 Analyzing git history in ${projectRoot}...`);

  // Get commit timeline
  const timeline = await analyzeCommitTimeline(projectRoot);

  // Get contributors
  const contributors = await getContributorCount(projectRoot);

  // Detect abandonment
  const lastActivity = timeline[0]?.date || "unknown";
  const abandonmentDate = detectAbandonment(timeline);
  const complexity = assessComplexity(timeline, contributors);

  return {
    timeline,
    lastActivity,
    totalCommits: timeline.reduce((sum, event) => sum + event.commits, 0),
    contributors,
    abandonmentDate,
    rescueComplexity: complexity,
  };
}

/**
 * Analyze commit timeline grouped by week
 */
async function analyzeCommitTimeline(
  projectRoot: string,
): Promise<TimelineEvent[]> {
  try {
    // Use execFileSync for safety - no shell injection possible
    const output = execFileSync(
      "git",
      [
        "-C",
        projectRoot,
        "log",
        "--format=%ad|%s",
        "--date=short",
        "--name-only",
        "--reverse",
      ],
      { encoding: "utf8", maxBuffer: 10 * 1024 * 1024 },
    );

    const timeline: Map<string, TimelineEvent> = new Map();
    const lines = output.trim().split("\n");

    let currentDate = "";
    let currentMessage = "";
    let currentFiles: string[] = [];

    for (const line of lines) {
      if (line.includes("|")) {
        // Save previous entry
        if (currentDate) {
          const weekKey = getWeekKey(currentDate);
          const existing = timeline.get(weekKey);
          if (existing) {
            existing.commits++;
            existing.files.push(...currentFiles);
          } else {
            timeline.set(weekKey, {
              date: weekKey,
              commits: 1,
              files: currentFiles,
              message: currentMessage,
              activity: "medium",
            });
          }
        }

        // Parse new entry
        const [date, message] = line.split("|");
        currentDate = date;
        currentMessage = message;
        currentFiles = [];
      } else if (line.trim()) {
        // File change
        currentFiles.push(line.trim());
      }
    }

    // Convert to array and calculate activity levels
    const events = Array.from(timeline.values()).map((event) => ({
      ...event,
      activity: getActivityLevel(event.commits),
    }));

    return events;
  } catch (error) {
    console.warn("Failed to analyze timeline:", error);
    return [];
  }
}

/**
 * Get week key from date (YYYY-WW format)
 */
function getWeekKey(dateStr: string): string {
  const date = new Date(dateStr);
  const year = date.getFullYear();
  const week = Math.ceil(
    (date.getTime() - new Date(year, 0, 1).getTime()) / (7 * 24 * 60 * 60 * 1000),
  );
  return `${year}-W${week.toString().padStart(2, "0")}`;
}

/**
 * Determine activity level based on commit count
 */
function getActivityLevel(
  commits: number,
): "high" | "medium" | "low" | "none" {
  if (commits >= 10) return "high";
  if (commits >= 5) return "medium";
  if (commits >= 1) return "low";
  return "none";
}

/**
 * Get unique contributor count
 */
async function getContributorCount(projectRoot: string): Promise<number> {
  try {
    // Use execFileSync with safe argument array
    const output = execFileSync(
      "git",
      ["-C", projectRoot, "log", "--format=%ae"],
      { encoding: "utf8" },
    );

    // Count unique emails
    const emails = new Set(output.trim().split("\n").filter(Boolean));
    return emails.size;
  } catch (error) {
    return 0;
  }
}

/**
 * Detect project abandonment date
 */
function detectAbandonment(timeline: TimelineEvent[]): string | undefined {
  if (timeline.length === 0) return undefined;

  const lastEvent = timeline[timeline.length - 1];
  const lastDate = new Date(lastEvent.date);
  const now = new Date();
  const monthsAgo =
    (now.getTime() - lastDate.getTime()) / (30 * 24 * 60 * 60 * 1000);

  // Consider abandoned if no activity in 3+ months
  if (monthsAgo >= 3) {
    return lastEvent.date;
  }

  return undefined;
}

/**
 * Assess rescue complexity
 */
function assessComplexity(
  timeline: TimelineEvent[],
  contributors: number,
): "low" | "medium" | "high" | "critical" {
  const totalCommits = timeline.reduce((sum, e) => sum + e.commits, 0);

  // Critical: Large project, many contributors, long gap
  if (totalCommits > 500 && contributors > 5) return "critical";

  // High: Medium size with multiple contributors
  if (totalCommits > 200 && contributors > 2) return "high";

  // Medium: Small-medium project
  if (totalCommits > 50) return "medium";

  // Low: Small project
  return "low";
}
