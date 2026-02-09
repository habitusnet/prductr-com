import { eq, and } from "drizzle-orm";
import { users, userSecrets } from "../schema.js";

export interface User {
  id: string;
  email: string;
  name?: string | null;
  passwordHash?: string | null;
  authProvider?: "local" | "google" | "github" | null;
  authProviderId?: string | null;
  avatarUrl?: string | null;
  isActive?: boolean;
  lastLoginAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface UserSecret {
  id: string;
  userId: string;
  name: string;
  encryptedValue: string;
  iv: string;
  authTag: string;
  provider?: string | null;
  expiresAt?: string | null;
  lastUsedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export function createUserRepository(db: any) {
  return {
    async create(user: Omit<User, "createdAt" | "updatedAt">) {
      const result = await db
        .insert(users)
        .values({
          id: user.id,
          email: user.email,
          name: user.name,
          passwordHash: user.passwordHash,
          authProvider: user.authProvider || "local",
          authProviderId: user.authProviderId,
          avatarUrl: user.avatarUrl,
          isActive: user.isActive ?? true,
        })
        .returning();
      return result[0];
    },

    async findById(id: string) {
      const result = await db.select().from(users).where(eq(users.id, id));
      return result[0] || null;
    },

    async findByEmail(email: string) {
      const result = await db
        .select()
        .from(users)
        .where(eq(users.email, email));
      return result[0] || null;
    },

    async findByAuthProvider(provider: string, providerId: string) {
      const result = await db
        .select()
        .from(users)
        .where(
          and(
            eq(users.authProvider, provider as any),
            eq(users.authProviderId, providerId),
          ),
        );
      return result[0] || null;
    },

    async update(id: string, data: Partial<User>) {
      const result = await db
        .update(users)
        .set({
          ...data,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(users.id, id))
        .returning();
      return result[0];
    },

    async updateLastLogin(id: string) {
      return this.update(id, { lastLoginAt: new Date().toISOString() });
    },

    async delete(id: string) {
      await db.delete(users).where(eq(users.id, id));
    },

    async list(options?: { isActive?: boolean; limit?: number; offset?: number }) {
      let query = db.select().from(users);

      if (options?.isActive !== undefined) {
        query = query.where(eq(users.isActive, options.isActive));
      }

      if (options?.limit) {
        query = query.limit(options.limit);
      }

      if (options?.offset) {
        query = query.offset(options.offset);
      }

      return query;
    },
  };
}

export function createUserSecretsRepository(db: any) {
  return {
    async create(secret: Omit<UserSecret, "createdAt" | "updatedAt">) {
      const result = await db
        .insert(userSecrets)
        .values({
          id: secret.id,
          userId: secret.userId,
          name: secret.name,
          encryptedValue: secret.encryptedValue,
          iv: secret.iv,
          authTag: secret.authTag,
          provider: secret.provider,
          expiresAt: secret.expiresAt,
        })
        .returning();
      return result[0];
    },

    async findById(id: string) {
      const result = await db
        .select()
        .from(userSecrets)
        .where(eq(userSecrets.id, id));
      return result[0] || null;
    },

    async findByUserIdAndName(userId: string, name: string) {
      const result = await db
        .select()
        .from(userSecrets)
        .where(
          and(eq(userSecrets.userId, userId), eq(userSecrets.name, name)),
        );
      return result[0] || null;
    },

    async listByUserId(userId: string) {
      return db
        .select()
        .from(userSecrets)
        .where(eq(userSecrets.userId, userId));
    },

    async update(id: string, data: Partial<UserSecret>) {
      const result = await db
        .update(userSecrets)
        .set({
          ...data,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(userSecrets.id, id))
        .returning();
      return result[0];
    },

    async updateLastUsed(id: string) {
      return this.update(id, { lastUsedAt: new Date().toISOString() });
    },

    async delete(id: string) {
      await db.delete(userSecrets).where(eq(userSecrets.id, id));
    },

    async deleteByUserIdAndName(userId: string, name: string) {
      await db
        .delete(userSecrets)
        .where(
          and(eq(userSecrets.userId, userId), eq(userSecrets.name, name)),
        );
    },

    async deleteAllForUser(userId: string) {
      await db.delete(userSecrets).where(eq(userSecrets.userId, userId));
    },

    /**
     * Upsert a secret - create if not exists, update if exists
     */
    async upsert(secret: Omit<UserSecret, "createdAt" | "updatedAt">) {
      const existing = await this.findByUserIdAndName(secret.userId, secret.name);
      if (existing) {
        return this.update(existing.id, {
          encryptedValue: secret.encryptedValue,
          iv: secret.iv,
          authTag: secret.authTag,
          provider: secret.provider,
          expiresAt: secret.expiresAt,
        });
      } else {
        return this.create(secret);
      }
    },
  };
}
