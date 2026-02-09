/**
 * Observer Agent Types
 */

// Detection event types
export type DetectionEventType =
  | "stuck"
  | "error"
  | "auth_required"
  | "test_failure"
  | "build_failure"
  | "rate_limited"
  | "git_conflict"
  | "crash"
  | "heartbeat_timeout"
  | "context_exhaustion";

export interface BaseDetectionEvent {
  type: DetectionEventType;
  agentId: string;
  sandboxId: string;
  timestamp: Date;
}

export interface StuckEvent extends BaseDetectionEvent {
  type: "stuck";
  silentDurationMs: number;
}

export interface ErrorEvent extends BaseDetectionEvent {
  type: "error";
  message: string;
  severity: "warning" | "error" | "fatal";
  stackTrace?: string;
}

export interface AuthRequiredEvent extends BaseDetectionEvent {
  type: "auth_required";
  provider: string;
  authUrl?: string;
}

export interface TestFailureEvent extends BaseDetectionEvent {
  type: "test_failure";
  failedTests: number;
  totalTests?: number;
  output: string;
}

export interface BuildFailureEvent extends BaseDetectionEvent {
  type: "build_failure";
  output: string;
}

export interface RateLimitedEvent extends BaseDetectionEvent {
  type: "rate_limited";
  provider: string;
  retryAfterMs?: number;
}

export interface GitConflictEvent extends BaseDetectionEvent {
  type: "git_conflict";
  files: string[];
}

export interface CrashEvent extends BaseDetectionEvent {
  type: "crash";
  exitCode: number;
  signal?: string;
}

export interface HeartbeatTimeoutEvent extends BaseDetectionEvent {
  type: "heartbeat_timeout";
  lastHeartbeat: Date;
}

export interface ContextExhaustionEvent extends BaseDetectionEvent {
  type: "context_exhaustion";
  tokenCount: number;
  tokenLimit: number;
  usagePercent: number;
  taskId?: string;
}

export type DetectionEvent =
  | StuckEvent
  | ErrorEvent
  | AuthRequiredEvent
  | TestFailureEvent
  | BuildFailureEvent
  | RateLimitedEvent
  | GitConflictEvent
  | CrashEvent
  | HeartbeatTimeoutEvent
  | ContextExhaustionEvent;

// Decision types
export type DecisionType = "autonomous" | "escalate";

export interface AutonomousDecision {
  action: "autonomous";
  actionType: AutonomousActionType;
  reason: string;
}

export interface EscalateDecision {
  action: "escalate";
  priority: "critical" | "high" | "normal";
  reason: string;
}

export type Decision = AutonomousDecision | EscalateDecision;

// Autonomous action types
export type AutonomousActionType =
  | "prompt_agent"
  | "restart_agent"
  | "reassign_task"
  | "retry_task"
  | "pause_agent"
  | "release_lock"
  | "update_task_status"
  | "save_checkpoint_and_pause";

export interface PromptAgentAction {
  type: "prompt_agent";
  agentId: string;
  message: string;
}

export interface RestartAgentAction {
  type: "restart_agent";
  agentId: string;
}

export interface ReassignTaskAction {
  type: "reassign_task";
  taskId: string;
  fromAgent: string;
  toAgent?: string;
}

export interface RetryTaskAction {
  type: "retry_task";
  taskId: string;
}

export interface PauseAgentAction {
  type: "pause_agent";
  agentId: string;
  reason: string;
}

export interface ReleaseLockAction {
  type: "release_lock";
  filePath: string;
  agentId: string;
}

export interface UpdateTaskStatusAction {
  type: "update_task_status";
  taskId: string;
  status: string;
  notes: string;
}

export interface SaveCheckpointAndPauseAction {
  type: "save_checkpoint_and_pause";
  agentId: string;
  taskId?: string;
  tokenCount: number;
  tokenLimit: number;
  stage: string;
}

export type AutonomousAction =
  | PromptAgentAction
  | RestartAgentAction
  | ReassignTaskAction
  | RetryTaskAction
  | PauseAgentAction
  | ReleaseLockAction
  | UpdateTaskStatusAction
  | SaveCheckpointAndPauseAction;

// Threshold configuration
export interface ThresholdConfig {
  stuck: {
    promptAfterMs: number;
    escalateAfterAttempts: number;
  };
  taskFailure: {
    autoRetryMax: number;
  };
  agentCrash: {
    autoRestartMax: number;
    cooldownMs: number;
  };
  heartbeat: {
    timeoutMs: number;
    pingBeforeRestart: boolean;
  };
  rateLimit: {
    autoBackoff: boolean;
    maxBackoffMs: number;
  };
}

// Escalation record
export interface Escalation {
  id: string;
  projectId: string;
  priority: "critical" | "high" | "normal";
  type: string;
  title: string;
  agentId?: string;
  taskId?: string;
  detectionEvent: DetectionEvent;
  consoleOutput: string;
  attemptedActions: ActionLog[];
  suggestedAction?: string;
  status: "pending" | "acknowledged" | "resolved" | "dismissed";
  resolvedBy?: string;
  resolvedAt?: Date;
  resolution?: string;
  createdAt: Date;
  expiresAt?: Date;
}

// Action audit log
export interface ActionLog {
  id: string;
  projectId: string;
  observerId: string;
  action: AutonomousAction;
  triggerEvent: DetectionEvent;
  outcome: "success" | "failure" | "pending";
  outcomeDetails?: string;
  humanOverride?: {
    overriddenBy: string;
    overrideAction: string;
    reason?: string;
  };
  createdAt: Date;
}

// Observer configuration
export interface ObserverConfig {
  projectId: string;
  mcpServerUrl: string;
  dbPath: string;
  observerId?: string;
  thresholds?: Partial<ThresholdConfig>;
  enabledDetectors?: DetectionEventType[];
  autonomyLevel?: "full_auto" | "supervised" | "assisted" | "manual";
}

// Observer events for external listeners
export type ObserverEventType =
  | "detection"
  | "decision"
  | "action"
  | "escalation";

export interface ObserverEvents {
  detection: (event: DetectionEvent) => void;
  decision: (event: DetectionEvent, decision: Decision) => void;
  action: (action: AutonomousAction, result: ActionResult) => void;
  escalation: (escalation: Escalation) => void;
}

export interface ActionResult {
  success: boolean;
  error?: string;
}
