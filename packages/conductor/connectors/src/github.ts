import { Octokit } from "@octokit/rest";
import type { Connector } from "./index";

export interface GitHubConfig {
  token: string;
  owner?: string;
  repo?: string;
}

export class GitHubConnector implements Connector {
  name = "GitHub";
  type = "github";
  private octokit: Octokit | null = null;
  private config: GitHubConfig;

  constructor(config: GitHubConfig) {
    this.config = config;
  }

  isConnected(): boolean {
    return this.octokit !== null;
  }

  async connect(): Promise<void> {
    this.octokit = new Octokit({ auth: this.config.token });
    // Verify connection
    await this.octokit.users.getAuthenticated();
  }

  async disconnect(): Promise<void> {
    this.octokit = null;
  }

  // Repository operations
  async getRepo(owner: string, repo: string) {
    if (!this.octokit) throw new Error("Not connected");
    const { data } = await this.octokit.repos.get({ owner, repo });
    return data;
  }

  async listBranches(owner: string, repo: string) {
    if (!this.octokit) throw new Error("Not connected");
    const { data } = await this.octokit.repos.listBranches({ owner, repo });
    return data;
  }

  // Issue/PR operations
  async createIssue(
    owner: string,
    repo: string,
    title: string,
    body: string,
    labels?: string[],
  ) {
    if (!this.octokit) throw new Error("Not connected");
    const { data } = await this.octokit.issues.create({
      owner,
      repo,
      title,
      body,
      labels,
    });
    return data;
  }

  async createPullRequest(
    owner: string,
    repo: string,
    title: string,
    body: string,
    head: string,
    base: string,
  ) {
    if (!this.octokit) throw new Error("Not connected");
    const { data } = await this.octokit.pulls.create({
      owner,
      repo,
      title,
      body,
      head,
      base,
    });
    return data;
  }

  // File operations
  async getContent(owner: string, repo: string, path: string, ref?: string) {
    if (!this.octokit) throw new Error("Not connected");
    const { data } = await this.octokit.repos.getContent({
      owner,
      repo,
      path,
      ref,
    });
    return data;
  }

  async createOrUpdateFile(
    owner: string,
    repo: string,
    path: string,
    content: string,
    message: string,
    sha?: string,
    branch?: string,
  ) {
    if (!this.octokit) throw new Error("Not connected");
    const { data } = await this.octokit.repos.createOrUpdateFileContents({
      owner,
      repo,
      path,
      message,
      content: Buffer.from(content).toString("base64"),
      sha,
      branch,
    });
    return data;
  }

  // Sync CLAUDE.md / GEMINI.md from repo
  async syncInstructionFile(
    owner: string,
    repo: string,
    filename: string,
  ): Promise<string | null> {
    try {
      const data = await this.getContent(owner, repo, filename);
      if ("content" in data) {
        return Buffer.from(data.content, "base64").toString("utf-8");
      }
      return null;
    } catch {
      return null;
    }
  }
}
