/**
 * E2B Runner Types
 * Type definitions for E2B sandbox management and agent execution
 */

export type SandboxStatus =
  | "pending"
  | "running"
  | "stopped"
  | "failed"
  | "timeout";

export type AgentRunnerType =
  | "claude-code"
  | "aider"
  | "copilot"
  | "crush"
  | "zencoder"
  | "custom";

/**
 * E2B Sandbox configuration
 */
export interface SandboxConfig {
  /** Unique sandbox ID */
  id?: string;
  /** E2B template ID (default: base sandbox) */
  template?: string;
  /** Sandbox timeout in seconds (default: 300) */
  timeout?: number;
  /** Memory limit in MB */
  memory?: number;
  /** CPU count */
  cpu?: number;
  /** Environment variables */
  env?: Record<string, string>;
  /** Metadata for tracking */
  metadata?: Record<string, unknown>;
}

/**
 * Running sandbox instance
 */
export interface SandboxInstance {
  /** Sandbox ID from E2B */
  id: string;
  /** Associated agent ID */
  agentId: string;
  /** Project ID */
  projectId: string;
  /** Current status */
  status: SandboxStatus;
  /** Template used */
  template: string;
  /** Start time */
  startedAt: Date;
  /** Last activity time */
  lastActivityAt: Date;
  /** Sandbox URL (if available) */
  url?: string;
  /** Metadata */
  metadata: Record<string, unknown>;
}

/**
 * Agent runner configuration
 */
export interface AgentRunnerConfig {
  /** Type of agent runner */
  type: AgentRunnerType;
  /** Agent ID in Conductor */
  agentId: string;
  /** Project ID */
  projectId: string;
  /** MCP server URL for agent to connect to */
  mcpServerUrl: string;
  /** Working directory in sandbox */
  workDir?: string;
  /** Git repository to clone */
  gitRepo?: string;
  /** Git branch */
  gitBranch?: string;
  /** Additional setup commands */
  setupCommands?: string[];
  /** Environment variables */
  env?: Record<string, string>;
  /** Sandbox configuration */
  sandbox?: SandboxConfig;
}

/**
 * Agent execution result
 */
export interface AgentExecutionResult {
  /** Sandbox ID */
  sandboxId: string;
  /** Agent ID */
  agentId: string;
  /** Success status */
  success: boolean;
  /** Exit code */
  exitCode?: number;
  /** Standard output */
  stdout?: string;
  /** Standard error */
  stderr?: string;
  /** Execution duration in ms */
  duration: number;
  /** Error message if failed */
  error?: string;
  /** Files modified */
  filesModified?: string[];
  /** Tokens used */
  tokensUsed?: number;
}

/**
 * Code execution request
 */
export interface CodeExecutionRequest {
  /** Sandbox ID to execute in */
  sandboxId: string;
  /** Code or command to execute */
  code: string;
  /** Language (for code interpreter) */
  language?: "python" | "javascript" | "typescript" | "bash";
  /** Timeout in seconds */
  timeout?: number;
  /** Working directory */
  cwd?: string;
}

/**
 * Code execution result
 */
export interface CodeExecutionResult {
  /** Success status */
  success: boolean;
  /** Standard output */
  stdout: string;
  /** Standard error */
  stderr: string;
  /** Exit code */
  exitCode: number;
  /** Execution duration in ms */
  duration: number;
  /** Error message */
  error?: string;
  /** Result data (for code interpreter) */
  data?: unknown;
}

/**
 * File operation request
 */
export interface FileOperation {
  /** Operation type */
  type: "read" | "write" | "delete" | "list" | "exists";
  /** File path */
  path: string;
  /** Content for write operations */
  content?: string;
}

/**
 * File operation result
 */
export interface FileOperationResult {
  /** Success status */
  success: boolean;
  /** File path */
  path: string;
  /** Content for read operations */
  content?: string;
  /** File list for list operations */
  files?: string[];
  /** Exists flag */
  exists?: boolean;
  /** Error message */
  error?: string;
}

/**
 * Sandbox event types
 */
export type SandboxEventType =
  | "sandbox:created"
  | "sandbox:started"
  | "sandbox:stopped"
  | "sandbox:failed"
  | "sandbox:timeout"
  | "agent:started"
  | "agent:completed"
  | "agent:failed"
  | "execution:started"
  | "execution:completed"
  | "execution:failed";

/**
 * Sandbox event
 */
export interface SandboxEvent {
  /** Event type */
  type: SandboxEventType;
  /** Sandbox ID */
  sandboxId: string;
  /** Agent ID (if applicable) */
  agentId?: string;
  /** Timestamp */
  timestamp: Date;
  /** Event data */
  data?: Record<string, unknown>;
}

/**
 * E2B Runner options
 */
export interface E2BRunnerOptions {
  /** E2B API key (from env if not provided) */
  apiKey?: string;
  /** Default sandbox template */
  defaultTemplate?: string;
  /** Default timeout in seconds */
  defaultTimeout?: number;
  /** Max concurrent sandboxes */
  maxConcurrent?: number;
  /** Auto-cleanup stopped sandboxes */
  autoCleanup?: boolean;
  /** Event callback */
  onEvent?: (event: SandboxEvent) => void;
}

/**
 * Output stream type
 */
export type OutputStreamType = "stdout" | "stderr";

/**
 * Streaming output chunk
 */
export interface StreamingChunk {
  /** Stream type */
  type: OutputStreamType;
  /** Output data */
  data: string;
  /** Timestamp */
  timestamp: Date;
}

/**
 * Streaming callbacks for real-time output
 */
export interface StreamingCallbacks {
  /** Called for each stdout chunk */
  onStdout?: (data: string) => void;
  /** Called for each stderr chunk */
  onStderr?: (data: string) => void;
  /** Called for any output (stdout or stderr) */
  onOutput?: (chunk: StreamingChunk) => void;
  /** Called when command starts */
  onStart?: () => void;
  /** Called when command completes */
  onComplete?: (result: { exitCode: number; duration: number }) => void;
  /** Called on error */
  onError?: (error: Error) => void;
}

/**
 * Streaming command options
 */
export interface StreamingCommandOptions {
  /** Working directory */
  cwd?: string;
  /** Timeout in seconds */
  timeout?: number;
  /** Environment variables */
  env?: Record<string, string>;
  /** Streaming callbacks */
  callbacks: StreamingCallbacks;
}

/**
 * Streaming agent runner configuration
 */
export interface StreamingAgentConfig extends AgentRunnerConfig {
  /** Streaming callbacks for real-time output */
  streaming?: StreamingCallbacks;
}
