/**
 * Firestore-compatible state store for Firebase
 * This mirrors the SQLiteStateStore/D1StateStore API but uses Firestore
 */

import {
  Firestore,
  CollectionReference,
  DocumentReference,
  Query,
  FieldValue,
  Timestamp,
} from "firebase-admin/firestore";

// Type definitions (matching other stores)
interface Project {
  id: string;
  organizationId: string;
  name: string;
  slug: string;
  rootPath?: string;
  gitRemote?: string;
  gitBranch: string;
  conflictStrategy: "lock" | "merge" | "zone" | "review";
  settings: Record<string, unknown>;
  isActive: boolean;
  budget?: { total: number; spent: number; alertThreshold: number };
  createdAt: Date;
  updatedAt: Date;
}

interface Task {
  id: string;
  projectId: string;
  title: string;
  description?: string;
  status:
    | "pending"
    | "claimed"
    | "in_progress"
    | "completed"
    | "failed"
    | "blocked"
    | "cancelled";
  priority: "critical" | "high" | "medium" | "low";
  assignedTo?: string;
  claimedAt?: Date;
  startedAt?: Date;
  completedAt?: Date;
  dependencies: string[];
  blockedBy?: string[];
  estimatedTokens?: number;
  actualTokens?: number;
  files: string[];
  tags: string[];
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

interface AgentProfile {
  id: string;
  name: string;
  provider: string;
  model?: string;
  status: "idle" | "working" | "blocked" | "offline";
  capabilities: string[];
  costPerToken: { input: number; output: number };
  lastHeartbeat?: Date;
  metadata: Record<string, unknown>;
}

interface AccessRequest {
  id: string;
  projectId: string;
  agentId: string;
  agentName: string;
  agentType: string;
  capabilities: string[];
  requestedRole: "lead" | "contributor" | "reviewer" | "observer";
  status: "pending" | "approved" | "denied" | "expired";
  requestedAt: Date;
  reviewedAt?: Date;
  reviewedBy?: string;
  expiresAt?: Date;
  denialReason?: string;
  metadata: Record<string, unknown>;
}

interface OnboardingConfig {
  welcomeMessage?: string;
  currentFocus?: string;
  goals: string[];
  styleGuide?: string;
  checkpointRules: string[];
  checkpointEveryNTasks: number;
  autoRefreshContext: boolean;
  agentInstructionsFiles: Record<string, string>;
}

interface CostEvent {
  id: string;
  organizationId: string;
  projectId: string;
  agentId: string;
  model: string;
  taskId?: string;
  tokensInput: number;
  tokensOutput: number;
  cost: number;
  createdAt: Date;
}

interface Conflict {
  id: string;
  filePath: string;
  agents: string[];
  strategy: string;
  createdAt: string;
}

interface FileLock {
  filePath: string;
  agentId: string;
  lockedAt: string;
  expiresAt: string;
}

interface TaskFilters {
  status?: Task["status"] | Task["status"][];
  priority?: Task["priority"] | Task["priority"][];
  assignedTo?: string;
  tags?: string[];
}

interface AccessRequestFilters {
  status?: AccessRequest["status"] | AccessRequest["status"][];
}

/**
 * Convert Firestore Timestamp to Date
 */
function toDate(timestamp: Timestamp | Date | undefined): Date | undefined {
  if (!timestamp) return undefined;
  if (timestamp instanceof Date) return timestamp;
  return timestamp.toDate();
}

/**
 * Firestore State Store - Firebase-compatible database operations
 */
export class FirestoreStateStore {
  constructor(private db: Firestore) {}

  // ============================================================================
  // Collection References
  // ============================================================================

  private projectsRef(): CollectionReference {
    return this.db.collection("projects");
  }

  private tasksRef(projectId: string): CollectionReference {
    return this.projectsRef().doc(projectId).collection("tasks");
  }

  private agentsRef(projectId: string): CollectionReference {
    return this.projectsRef().doc(projectId).collection("agents");
  }

  private accessRequestsRef(projectId: string): CollectionReference {
    return this.projectsRef().doc(projectId).collection("accessRequests");
  }

  private conflictsRef(projectId: string): CollectionReference {
    return this.projectsRef().doc(projectId).collection("conflicts");
  }

  private fileLocksRef(projectId: string): CollectionReference {
    return this.projectsRef().doc(projectId).collection("fileLocks");
  }

  private costEventsRef(projectId: string): CollectionReference {
    return this.projectsRef().doc(projectId).collection("costEvents");
  }

  private onboardingRef(projectId: string): DocumentReference {
    return this.projectsRef()
      .doc(projectId)
      .collection("onboarding")
      .doc("config");
  }

  // ============================================================================
  // Project Methods
  // ============================================================================

  async getProject(projectId: string): Promise<Project | null> {
    const doc = await this.projectsRef().doc(projectId).get();
    if (!doc.exists) return null;

    const data = doc.data()!;
    return {
      id: doc.id,
      organizationId: data.organizationId,
      name: data.name,
      slug: data.slug,
      rootPath: data.rootPath,
      gitRemote: data.gitRemote,
      gitBranch: data.gitBranch || "main",
      conflictStrategy: data.conflictStrategy || "lock",
      settings: data.settings || {},
      isActive: data.isActive !== false,
      budget: data.budget,
      createdAt: toDate(data.createdAt) || new Date(),
      updatedAt: toDate(data.updatedAt) || new Date(),
    };
  }

  // ============================================================================
  // Task Methods
  // ============================================================================

  async listTasks(projectId: string, filters?: TaskFilters): Promise<Task[]> {
    let query: Query = this.tasksRef(projectId);

    if (filters?.status) {
      const statuses = Array.isArray(filters.status)
        ? filters.status
        : [filters.status];
      query = query.where("status", "in", statuses);
    }

    if (filters?.priority) {
      const priorities = Array.isArray(filters.priority)
        ? filters.priority
        : [filters.priority];
      query = query.where("priority", "in", priorities);
    }

    if (filters?.assignedTo) {
      query = query.where("assignedTo", "==", filters.assignedTo);
    }

    query = query.orderBy("createdAt", "desc");

    const snapshot = await query.get();
    return snapshot.docs.map((doc) => this.docToTask(doc));
  }

  async getTask(taskId: string, projectId: string): Promise<Task | null> {
    const doc = await this.tasksRef(projectId).doc(taskId).get();
    if (!doc.exists) return null;
    return this.docToTask(doc);
  }

  async updateTask(
    projectId: string,
    taskId: string,
    updates: Partial<Task>,
  ): Promise<void> {
    const updateData: Record<string, unknown> = {
      updatedAt: FieldValue.serverTimestamp(),
    };

    if (updates.status !== undefined) updateData.status = updates.status;
    if (updates.assignedTo !== undefined)
      updateData.assignedTo = updates.assignedTo;
    if (updates.blockedBy !== undefined)
      updateData.blockedBy = updates.blockedBy;

    await this.tasksRef(projectId).doc(taskId).update(updateData);
  }

  // ============================================================================
  // Agent Methods
  // ============================================================================

  async listAgents(projectId: string): Promise<AgentProfile[]> {
    const snapshot = await this.agentsRef(projectId).get();
    return snapshot.docs.map((doc) => this.docToAgent(doc));
  }

  async getAgent(
    agentId: string,
    projectId: string,
  ): Promise<AgentProfile | null> {
    const doc = await this.agentsRef(projectId).doc(agentId).get();
    if (!doc.exists) return null;
    return this.docToAgent(doc);
  }

  async updateAgentStatus(
    projectId: string,
    agentId: string,
    status: string,
  ): Promise<void> {
    await this.agentsRef(projectId).doc(agentId).update({
      status,
      lastHeartbeat: FieldValue.serverTimestamp(),
    });
  }

  // ============================================================================
  // Access Request Methods
  // ============================================================================

  async listAccessRequests(
    projectId: string,
    filters?: AccessRequestFilters,
  ): Promise<AccessRequest[]> {
    let query: Query = this.accessRequestsRef(projectId);

    if (filters?.status) {
      const statuses = Array.isArray(filters.status)
        ? filters.status
        : [filters.status];
      query = query.where("status", "in", statuses);
    }

    query = query.orderBy("requestedAt", "desc");

    const snapshot = await query.get();
    return snapshot.docs.map((doc) => this.docToAccessRequest(doc));
  }

  async approveAccessRequest(
    projectId: string,
    requestId: string,
    reviewedBy: string,
  ): Promise<void> {
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

    await this.accessRequestsRef(projectId)
      .doc(requestId)
      .update({
        status: "approved",
        reviewedAt: FieldValue.serverTimestamp(),
        reviewedBy,
        expiresAt: Timestamp.fromDate(expiresAt),
      });
  }

  async denyAccessRequest(
    projectId: string,
    requestId: string,
    reviewedBy: string,
    reason?: string,
  ): Promise<void> {
    await this.accessRequestsRef(projectId)
      .doc(requestId)
      .update({
        status: "denied",
        reviewedAt: FieldValue.serverTimestamp(),
        reviewedBy,
        denialReason: reason || null,
      });
  }

  async getAccessRequestSummary(projectId: string): Promise<{
    total: number;
    pending: number;
    approved: number;
    denied: number;
    expired: number;
  }> {
    const snapshot = await this.accessRequestsRef(projectId).get();
    const requests = snapshot.docs.map((doc) => doc.data());

    return {
      total: requests.length,
      pending: requests.filter((r) => r.status === "pending").length,
      approved: requests.filter((r) => r.status === "approved").length,
      denied: requests.filter((r) => r.status === "denied").length,
      expired: requests.filter((r) => r.status === "expired").length,
    };
  }

  // ============================================================================
  // Onboarding Config Methods
  // ============================================================================

  async getOnboardingConfig(
    projectId: string,
  ): Promise<OnboardingConfig | null> {
    const doc = await this.onboardingRef(projectId).get();
    if (!doc.exists) return null;

    const data = doc.data()!;
    return {
      welcomeMessage: data.welcomeMessage,
      currentFocus: data.currentFocus,
      goals: data.goals || [],
      styleGuide: data.styleGuide,
      checkpointRules: data.checkpointRules || [],
      checkpointEveryNTasks: data.checkpointEveryNTasks || 3,
      autoRefreshContext: data.autoRefreshContext !== false,
      agentInstructionsFiles: data.agentInstructionsFiles || {},
    };
  }

  async setOnboardingConfig(
    projectId: string,
    config: Partial<OnboardingConfig>,
  ): Promise<void> {
    await this.onboardingRef(projectId).set(
      {
        ...config,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  }

  // ============================================================================
  // Cost Methods
  // ============================================================================

  async getProjectSpend(projectId: string): Promise<number> {
    const snapshot = await this.costEventsRef(projectId).get();
    let total = 0;
    snapshot.docs.forEach((doc) => {
      total += doc.data().cost || 0;
    });
    return total;
  }

  async getCostEvents(projectId: string): Promise<CostEvent[]> {
    const snapshot = await this.costEventsRef(projectId)
      .orderBy("createdAt", "desc")
      .limit(100)
      .get();

    return snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        organizationId: data.organizationId,
        projectId: data.projectId,
        agentId: data.agentId,
        model: data.model,
        taskId: data.taskId,
        tokensInput: data.tokensInput || 0,
        tokensOutput: data.tokensOutput || 0,
        cost: data.cost || 0,
        createdAt: toDate(data.createdAt) || new Date(),
      };
    });
  }

  // ============================================================================
  // Conflict & Lock Methods
  // ============================================================================

  async getUnresolvedConflicts(projectId: string): Promise<Conflict[]> {
    const snapshot = await this.conflictsRef(projectId)
      .where("resolvedAt", "==", null)
      .orderBy("createdAt", "desc")
      .get();

    return snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        filePath: data.filePath,
        agents: data.agents || [],
        strategy: data.strategy,
        createdAt:
          toDate(data.createdAt)?.toISOString() || new Date().toISOString(),
      };
    });
  }

  async getActiveLocks(projectId: string): Promise<FileLock[]> {
    const now = new Date();
    const snapshot = await this.fileLocksRef(projectId)
      .where("expiresAt", ">", Timestamp.fromDate(now))
      .orderBy("expiresAt")
      .orderBy("lockedAt", "desc")
      .get();

    return snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        filePath: data.filePath,
        agentId: data.agentId,
        lockedAt:
          toDate(data.lockedAt)?.toISOString() || new Date().toISOString(),
        expiresAt:
          toDate(data.expiresAt)?.toISOString() || new Date().toISOString(),
      };
    });
  }

  async resolveConflict(
    projectId: string,
    conflictId: string,
    resolution: string,
  ): Promise<void> {
    await this.conflictsRef(projectId).doc(conflictId).update({
      resolvedAt: FieldValue.serverTimestamp(),
      resolution,
    });
  }

  async releaseLock(
    projectId: string,
    filePath: string,
    agentId: string,
  ): Promise<void> {
    // Find and delete the lock
    const snapshot = await this.fileLocksRef(projectId)
      .where("filePath", "==", filePath)
      .where("agentId", "==", agentId)
      .get();

    const batch = this.db.batch();
    snapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });
    await batch.commit();
  }

  // ============================================================================
  // Document Converters
  // ============================================================================

  private docToTask(doc: FirebaseFirestore.DocumentSnapshot): Task {
    const data = doc.data()!;
    return {
      id: doc.id,
      projectId: data.projectId,
      title: data.title,
      description: data.description,
      status: data.status || "pending",
      priority: data.priority || "medium",
      assignedTo: data.assignedTo,
      claimedAt: toDate(data.claimedAt),
      startedAt: toDate(data.startedAt),
      completedAt: toDate(data.completedAt),
      dependencies: data.dependencies || [],
      blockedBy: data.blockedBy,
      estimatedTokens: data.estimatedTokens,
      actualTokens: data.actualTokens,
      files: data.files || [],
      tags: data.tags || [],
      metadata: data.metadata || {},
      createdAt: toDate(data.createdAt) || new Date(),
      updatedAt: toDate(data.updatedAt) || new Date(),
    };
  }

  private docToAgent(doc: FirebaseFirestore.DocumentSnapshot): AgentProfile {
    const data = doc.data()!;
    return {
      id: doc.id,
      name: data.name,
      provider: data.provider || "custom",
      model: data.model,
      status: data.status || "offline",
      capabilities: data.capabilities || [],
      costPerToken: {
        input: data.costPerToken?.input || 0,
        output: data.costPerToken?.output || 0,
      },
      lastHeartbeat: toDate(data.lastHeartbeat),
      metadata: data.metadata || {},
    };
  }

  private docToAccessRequest(
    doc: FirebaseFirestore.DocumentSnapshot,
  ): AccessRequest {
    const data = doc.data()!;
    return {
      id: doc.id,
      projectId: data.projectId,
      agentId: data.agentId,
      agentName: data.agentName,
      agentType: data.agentType || "custom",
      capabilities: data.capabilities || [],
      requestedRole: data.requestedRole || "contributor",
      status: data.status || "pending",
      requestedAt: toDate(data.requestedAt) || new Date(),
      reviewedAt: toDate(data.reviewedAt),
      reviewedBy: data.reviewedBy,
      expiresAt: toDate(data.expiresAt),
      denialReason: data.denialReason,
      metadata: data.metadata || {},
    };
  }
}

// Export types
export type {
  Project,
  Task,
  AgentProfile,
  AccessRequest,
  OnboardingConfig,
  CostEvent,
  Conflict,
  FileLock,
  TaskFilters,
  AccessRequestFilters,
};
