import { describe, it, expect, vi, beforeEach } from "vitest";
import { createOrganizationRepository } from "./organization";

describe("OrganizationRepository", () => {
  let mockDb: any;
  let repo: ReturnType<typeof createOrganizationRepository>;

  beforeEach(() => {
    mockDb = {
      insert: vi.fn().mockReturnThis(),
      values: vi.fn().mockReturnThis(),
      returning: vi.fn(),
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
    };
    repo = createOrganizationRepository(mockDb);
  });

  describe("create", () => {
    it("should create organization with all fields", async () => {
      const org: any = {
        id: "org-123",
        name: "Test Org",
        slug: "test-org",
        plan: "pro" as const,
        billingEmail: "billing@test.com",
        apiKeys: ["key1", "key2"],
        settings: { theme: "dark" },
      };

      const expectedResult = {
        ...org,
        createdAt: "2024-01-01",
        updatedAt: "2024-01-01",
      };
      mockDb.returning.mockResolvedValue([expectedResult]);

      const result = await repo.create(org);

      expect(mockDb.insert).toHaveBeenCalled();
      expect(mockDb.values).toHaveBeenCalledWith({
        id: "org-123",
        name: "Test Org",
        slug: "test-org",
        plan: "pro",
        billingEmail: "billing@test.com",
        apiKeys: JSON.stringify(["key1", "key2"]),
        settings: JSON.stringify({ theme: "dark" }),
      });
      expect(result).toEqual(expectedResult);
    });

    it("should create organization with default values", async () => {
      const org: any = {
        id: "org-456",
        name: "Minimal Org",
        slug: "minimal-org",
      };

      mockDb.returning.mockResolvedValue([{ ...org, plan: "free" }]);

      await repo.create(org);

      expect(mockDb.values).toHaveBeenCalledWith({
        id: "org-456",
        name: "Minimal Org",
        slug: "minimal-org",
        plan: "free",
        billingEmail: undefined,
        apiKeys: "[]",
        settings: "{}",
      });
    });
  });

  describe("findById", () => {
    it("should find organization by id", async () => {
      const org = { id: "org-123", name: "Test Org" };
      mockDb.where.mockResolvedValue([org]);

      const result = await repo.findById("org-123");

      expect(mockDb.select).toHaveBeenCalled();
      expect(result).toEqual(org);
    });

    it("should return null when organization not found", async () => {
      mockDb.where.mockResolvedValue([]);

      const result = await repo.findById("non-existent");

      expect(result).toBeNull();
    });
  });

  describe("findBySlug", () => {
    it("should find organization by slug", async () => {
      const org = { id: "org-123", slug: "test-org" };
      mockDb.where.mockResolvedValue([org]);

      const result = await repo.findBySlug("test-org");

      expect(mockDb.select).toHaveBeenCalled();
      expect(result).toEqual(org);
    });

    it("should return null when slug not found", async () => {
      mockDb.where.mockResolvedValue([]);

      const result = await repo.findBySlug("non-existent");

      expect(result).toBeNull();
    });
  });

  describe("update", () => {
    it("should update organization fields", async () => {
      const updatedOrg = { id: "org-123", name: "Updated Org" };
      mockDb.returning.mockResolvedValue([updatedOrg]);

      const result = await repo.update("org-123", { name: "Updated Org" });

      expect(mockDb.update).toHaveBeenCalled();
      expect(mockDb.set).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Updated Org",
          updatedAt: expect.any(String),
        }),
      );
      expect(result).toEqual(updatedOrg);
    });

    it("should serialize settings when updating", async () => {
      mockDb.returning.mockResolvedValue([{}]);

      await repo.update("org-123", { settings: { theme: "light" } });

      expect(mockDb.set).toHaveBeenCalledWith(
        expect.objectContaining({
          settings: JSON.stringify({ theme: "light" }),
        }),
      );
    });

    it("should serialize apiKeys when updating", async () => {
      mockDb.returning.mockResolvedValue([{}]);

      await repo.update("org-123", { apiKeys: ["new-key"] });

      expect(mockDb.set).toHaveBeenCalledWith(
        expect.objectContaining({
          apiKeys: JSON.stringify(["new-key"]),
        }),
      );
    });
  });

  describe("delete", () => {
    it("should delete organization by id", async () => {
      mockDb.where.mockResolvedValue(undefined);

      await repo.delete("org-123");

      expect(mockDb.delete).toHaveBeenCalled();
    });
  });

  describe("addMember", () => {
    it("should add member to organization", async () => {
      const member: any = {
        id: "member-123",
        organizationId: "org-123",
        userId: "user-456",
        role: "admin" as const,
      };

      mockDb.returning.mockResolvedValue([
        { ...member, invitedAt: "2024-01-01" },
      ]);

      const result = await repo.addMember(member);

      expect(mockDb.insert).toHaveBeenCalled();
      expect(mockDb.values).toHaveBeenCalledWith({
        id: "member-123",
        organizationId: "org-123",
        userId: "user-456",
        role: "admin",
      });
      expect(result).toHaveProperty("invitedAt");
    });

    it("should use default member role", async () => {
      const member: any = {
        id: "member-456",
        organizationId: "org-123",
        userId: "user-789",
      };

      mockDb.returning.mockResolvedValue([{}]);

      await repo.addMember(member);

      expect(mockDb.values).toHaveBeenCalledWith(
        expect.objectContaining({
          role: "member",
        }),
      );
    });
  });

  describe("getMembers", () => {
    it("should get all members of organization", async () => {
      const members = [
        { id: "member-1", userId: "user-1", role: "owner" },
        { id: "member-2", userId: "user-2", role: "member" },
      ];
      mockDb.where.mockResolvedValue(members);

      const result = await repo.getMembers("org-123");

      expect(mockDb.select).toHaveBeenCalled();
      expect(result).toEqual(members);
    });

    it("should return empty array when no members", async () => {
      mockDb.where.mockResolvedValue([]);

      const result = await repo.getMembers("org-123");

      expect(result).toEqual([]);
    });
  });
});
