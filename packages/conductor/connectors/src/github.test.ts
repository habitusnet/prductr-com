import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GitHubConnector } from "./github";

// Mock Octokit (vitest v4+)
const mockGetAuthenticated = vi.fn();
const mockReposGet = vi.fn();
const mockListBranches = vi.fn();
const mockGetContent = vi.fn();
const mockCreateOrUpdateFileContents = vi.fn();
const mockIssuesCreate = vi.fn();
const mockPullsCreate = vi.fn();

vi.mock("@octokit/rest", () => {
  return {
    Octokit: class MockOctokit {
      users = {
        getAuthenticated: mockGetAuthenticated,
      };
      repos = {
        get: mockReposGet,
        listBranches: mockListBranches,
        getContent: mockGetContent,
        createOrUpdateFileContents: mockCreateOrUpdateFileContents,
      };
      issues = {
        create: mockIssuesCreate,
      };
      pulls = {
        create: mockPullsCreate,
      };
    },
  };
});

describe("GitHubConnector", () => {
  let connector: GitHubConnector;

  beforeEach(() => {
    vi.clearAllMocks();
    connector = new GitHubConnector({ token: "test-token" });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("constructor", () => {
    it("should initialize with required config", () => {
      expect(connector.name).toBe("GitHub");
      expect(connector.type).toBe("github");
    });

    it("should accept optional owner and repo", () => {
      const connectorWithRepo = new GitHubConnector({
        token: "test-token",
        owner: "test-owner",
        repo: "test-repo",
      });
      expect(connectorWithRepo.name).toBe("GitHub");
    });
  });

  describe("isConnected", () => {
    it("should return false when not connected", () => {
      expect(connector.isConnected()).toBe(false);
    });

    it("should return true when connected", async () => {
      mockGetAuthenticated.mockResolvedValue({ data: { login: "testuser" } });
      await connector.connect();
      expect(connector.isConnected()).toBe(true);
    });
  });

  describe("connect", () => {
    it("should authenticate with GitHub", async () => {
      mockGetAuthenticated.mockResolvedValue({ data: { login: "testuser" } });
      await connector.connect();
      expect(mockGetAuthenticated).toHaveBeenCalled();
    });

    it("should throw if authentication fails", async () => {
      mockGetAuthenticated.mockRejectedValue(new Error("Unauthorized"));
      await expect(connector.connect()).rejects.toThrow("Unauthorized");
    });
  });

  describe("disconnect", () => {
    it("should set connected state to false", async () => {
      mockGetAuthenticated.mockResolvedValue({ data: { login: "testuser" } });
      await connector.connect();
      expect(connector.isConnected()).toBe(true);

      await connector.disconnect();
      expect(connector.isConnected()).toBe(false);
    });
  });

  describe("getRepo", () => {
    it("should throw if not connected", async () => {
      await expect(connector.getRepo("owner", "repo")).rejects.toThrow(
        "Not connected",
      );
    });

    it("should return repo data when connected", async () => {
      mockGetAuthenticated.mockResolvedValue({ data: { login: "testuser" } });
      await connector.connect();

      const mockRepoData = {
        id: 1,
        name: "test-repo",
        full_name: "owner/test-repo",
      };
      mockReposGet.mockResolvedValue({ data: mockRepoData });

      const result = await connector.getRepo("owner", "test-repo");
      expect(result).toEqual(mockRepoData);
      expect(mockReposGet).toHaveBeenCalledWith({
        owner: "owner",
        repo: "test-repo",
      });
    });
  });

  describe("listBranches", () => {
    it("should throw if not connected", async () => {
      await expect(connector.listBranches("owner", "repo")).rejects.toThrow(
        "Not connected",
      );
    });

    it("should return branches when connected", async () => {
      mockGetAuthenticated.mockResolvedValue({ data: { login: "testuser" } });
      await connector.connect();

      const mockBranches = [
        { name: "main", protected: true },
        { name: "feature", protected: false },
      ];
      mockListBranches.mockResolvedValue({ data: mockBranches });

      const result = await connector.listBranches("owner", "repo");
      expect(result).toEqual(mockBranches);
      expect(mockListBranches).toHaveBeenCalledWith({
        owner: "owner",
        repo: "repo",
      });
    });
  });

  describe("createIssue", () => {
    it("should throw if not connected", async () => {
      await expect(
        connector.createIssue("owner", "repo", "title", "body"),
      ).rejects.toThrow("Not connected");
    });

    it("should create issue when connected", async () => {
      mockGetAuthenticated.mockResolvedValue({ data: { login: "testuser" } });
      await connector.connect();

      const mockIssue = { id: 1, number: 42, title: "Test Issue" };
      mockIssuesCreate.mockResolvedValue({ data: mockIssue });

      const result = await connector.createIssue(
        "owner",
        "repo",
        "Test Issue",
        "Issue body",
        ["bug"],
      );
      expect(result).toEqual(mockIssue);
      expect(mockIssuesCreate).toHaveBeenCalledWith({
        owner: "owner",
        repo: "repo",
        title: "Test Issue",
        body: "Issue body",
        labels: ["bug"],
      });
    });

    it("should create issue without labels", async () => {
      mockGetAuthenticated.mockResolvedValue({ data: { login: "testuser" } });
      await connector.connect();

      const mockIssue = { id: 1, number: 42, title: "Test Issue" };
      mockIssuesCreate.mockResolvedValue({ data: mockIssue });

      await connector.createIssue("owner", "repo", "Test Issue", "Issue body");
      expect(mockIssuesCreate).toHaveBeenCalledWith({
        owner: "owner",
        repo: "repo",
        title: "Test Issue",
        body: "Issue body",
        labels: undefined,
      });
    });
  });

  describe("createPullRequest", () => {
    it("should throw if not connected", async () => {
      await expect(
        connector.createPullRequest(
          "owner",
          "repo",
          "title",
          "body",
          "feature",
          "main",
        ),
      ).rejects.toThrow("Not connected");
    });

    it("should create pull request when connected", async () => {
      mockGetAuthenticated.mockResolvedValue({ data: { login: "testuser" } });
      await connector.connect();

      const mockPR = {
        id: 1,
        number: 99,
        title: "Test PR",
        html_url: "https://github.com/owner/repo/pull/99",
      };
      mockPullsCreate.mockResolvedValue({ data: mockPR });

      const result = await connector.createPullRequest(
        "owner",
        "repo",
        "Test PR",
        "PR body",
        "feature",
        "main",
      );
      expect(result).toEqual(mockPR);
      expect(mockPullsCreate).toHaveBeenCalledWith({
        owner: "owner",
        repo: "repo",
        title: "Test PR",
        body: "PR body",
        head: "feature",
        base: "main",
      });
    });
  });

  describe("getContent", () => {
    it("should throw if not connected", async () => {
      await expect(
        connector.getContent("owner", "repo", "path"),
      ).rejects.toThrow("Not connected");
    });

    it("should return file content when connected", async () => {
      mockGetAuthenticated.mockResolvedValue({ data: { login: "testuser" } });
      await connector.connect();

      const mockContent = {
        type: "file",
        name: "README.md",
        content: Buffer.from("# Test").toString("base64"),
      };
      mockGetContent.mockResolvedValue({ data: mockContent });

      const result = await connector.getContent("owner", "repo", "README.md");
      expect(result).toEqual(mockContent);
      expect(mockGetContent).toHaveBeenCalledWith({
        owner: "owner",
        repo: "repo",
        path: "README.md",
        ref: undefined,
      });
    });

    it("should get content with ref", async () => {
      mockGetAuthenticated.mockResolvedValue({ data: { login: "testuser" } });
      await connector.connect();

      const mockContent = { type: "file", name: "README.md" };
      mockGetContent.mockResolvedValue({ data: mockContent });

      await connector.getContent(
        "owner",
        "repo",
        "README.md",
        "feature-branch",
      );
      expect(mockGetContent).toHaveBeenCalledWith({
        owner: "owner",
        repo: "repo",
        path: "README.md",
        ref: "feature-branch",
      });
    });
  });

  describe("createOrUpdateFile", () => {
    it("should throw if not connected", async () => {
      await expect(
        connector.createOrUpdateFile(
          "owner",
          "repo",
          "path",
          "content",
          "message",
        ),
      ).rejects.toThrow("Not connected");
    });

    it("should create new file when connected", async () => {
      mockGetAuthenticated.mockResolvedValue({ data: { login: "testuser" } });
      await connector.connect();

      const mockResult = {
        content: { sha: "abc123" },
        commit: { sha: "def456" },
      };
      mockCreateOrUpdateFileContents.mockResolvedValue({ data: mockResult });

      const result = await connector.createOrUpdateFile(
        "owner",
        "repo",
        "new-file.txt",
        "File content",
        "Add new file",
      );

      expect(result).toEqual(mockResult);
      expect(mockCreateOrUpdateFileContents).toHaveBeenCalledWith({
        owner: "owner",
        repo: "repo",
        path: "new-file.txt",
        message: "Add new file",
        content: Buffer.from("File content").toString("base64"),
        sha: undefined,
        branch: undefined,
      });
    });

    it("should update existing file with sha", async () => {
      mockGetAuthenticated.mockResolvedValue({ data: { login: "testuser" } });
      await connector.connect();

      const mockResult = { content: { sha: "xyz789" } };
      mockCreateOrUpdateFileContents.mockResolvedValue({ data: mockResult });

      await connector.createOrUpdateFile(
        "owner",
        "repo",
        "existing-file.txt",
        "Updated content",
        "Update file",
        "old-sha",
        "main",
      );

      expect(mockCreateOrUpdateFileContents).toHaveBeenCalledWith({
        owner: "owner",
        repo: "repo",
        path: "existing-file.txt",
        message: "Update file",
        content: Buffer.from("Updated content").toString("base64"),
        sha: "old-sha",
        branch: "main",
      });
    });
  });

  describe("syncInstructionFile", () => {
    it("should return file content when found", async () => {
      mockGetAuthenticated.mockResolvedValue({ data: { login: "testuser" } });
      await connector.connect();

      const fileContent = "# Instructions";
      mockGetContent.mockResolvedValue({
        data: {
          type: "file",
          content: Buffer.from(fileContent).toString("base64"),
        },
      });

      const result = await connector.syncInstructionFile(
        "owner",
        "repo",
        "CLAUDE.md",
      );
      expect(result).toBe(fileContent);
    });

    it("should return null when file not found", async () => {
      mockGetAuthenticated.mockResolvedValue({ data: { login: "testuser" } });
      await connector.connect();

      mockGetContent.mockRejectedValue(new Error("Not found"));

      const result = await connector.syncInstructionFile(
        "owner",
        "repo",
        "CLAUDE.md",
      );
      expect(result).toBeNull();
    });

    it("should return null when content field is missing", async () => {
      mockGetAuthenticated.mockResolvedValue({ data: { login: "testuser" } });
      await connector.connect();

      mockGetContent.mockResolvedValue({
        data: { type: "dir", name: "folder" },
      });

      const result = await connector.syncInstructionFile(
        "owner",
        "repo",
        "folder",
      );
      expect(result).toBeNull();
    });
  });
});
