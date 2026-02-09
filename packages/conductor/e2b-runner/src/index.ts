/**
 * E2B Runner Package
 * Run Conductor agents in E2B sandboxes
 */

// Core exports
export { SandboxManager } from "./sandbox-manager.js";
export {
  AgentRunner,
  createClaudeCodeRunner,
  createAiderRunner,
  createZaiRunner,
  createZencoderRunner, // Backwards compatibility alias
} from "./agent-runner.js";

// Type exports
export type {
  SandboxStatus,
  AgentRunnerType,
  SandboxConfig,
  SandboxInstance,
  AgentRunnerConfig,
  AgentExecutionResult,
  CodeExecutionRequest,
  CodeExecutionResult,
  FileOperation,
  FileOperationResult,
  SandboxEventType,
  SandboxEvent,
  E2BRunnerOptions,
  OutputStreamType,
  StreamingChunk,
  StreamingCallbacks,
  StreamingCommandOptions,
  StreamingAgentConfig,
} from "./types.js";
