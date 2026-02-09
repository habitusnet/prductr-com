import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { ActionLogger } from './action-logger';
import type { ErrorEvent, AutonomousAction } from '../types';

describe('ActionLogger', () => {
  let logger: ActionLogger;
  let dbPath: string;

  beforeEach(async () => {
    // Create a temporary database for each test
    dbPath = path.join('/tmp', `test-actions-${randomUUID()}.db`);
    logger = new ActionLogger(dbPath);
    logger.initialize();
  });

  afterEach(() => {
    logger.close();
    // Clean up test database
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
    }
  });

  describe('logAction', () => {
    it('should create an action log with generated ID', () => {
      const event: ErrorEvent = {
        type: 'error',
        agentId: 'agent-1',
        sandboxId: 'sandbox-1',
        timestamp: new Date(),
        message: 'Test error',
        severity: 'error',
      };

      const action: AutonomousAction = {
        type: 'restart_agent',
        agentId: 'agent-1',
      };

      const actionLog = logger.logAction({
        projectId: 'project-1',
        observerId: 'observer-1',
        action,
        triggerEvent: event,
      });

      expect(actionLog).toBeDefined();
      expect(actionLog.id).toMatch(/^act-[a-f0-9-]+$/);
      expect(actionLog.projectId).toBe('project-1');
      expect(actionLog.observerId).toBe('observer-1');
      expect(actionLog.action).toEqual(action);
      expect(actionLog.outcome).toBe('pending');
      expect(actionLog.createdAt).toBeInstanceOf(Date);
    });

    it('should generate unique IDs', () => {
      const event: ErrorEvent = {
        type: 'error',
        agentId: 'agent-1',
        sandboxId: 'sandbox-1',
        timestamp: new Date(),
        message: 'Test error',
        severity: 'error',
      };

      const action: AutonomousAction = {
        type: 'restart_agent',
        agentId: 'agent-1',
      };

      const log1 = logger.logAction({
        projectId: 'project-1',
        observerId: 'observer-1',
        action,
        triggerEvent: event,
      });

      const log2 = logger.logAction({
        projectId: 'project-1',
        observerId: 'observer-1',
        action,
        triggerEvent: event,
      });

      expect(log1.id).not.toBe(log2.id);
    });

    it('should store action and trigger_event as JSON strings', () => {
      const eventTime = new Date();
      const event: ErrorEvent = {
        type: 'error',
        agentId: 'agent-1',
        sandboxId: 'sandbox-1',
        timestamp: eventTime,
        message: 'Test error',
        severity: 'error',
      };

      const action: AutonomousAction = {
        type: 'prompt_agent',
        agentId: 'agent-1',
        message: 'Test message',
      };

      const actionLog = logger.logAction({
        projectId: 'project-1',
        observerId: 'observer-1',
        action,
        triggerEvent: event,
      });

      // Verify we can retrieve it and it's properly JSON stringified
      const retrieved = logger.getAction(actionLog.id);
      expect(retrieved).toBeDefined();
      expect(retrieved?.action).toEqual(action);
      // Check structure matches - timestamp will be string after JSON serialization
      expect(retrieved?.triggerEvent).toBeDefined();
      expect(retrieved?.triggerEvent?.type).toBe(event.type);
      expect(retrieved?.triggerEvent?.agentId).toBe(event.agentId);
      expect(retrieved?.triggerEvent?.message).toBe('Test error');
    });
  });

  describe('getAction', () => {
    it('should retrieve an action log by ID', () => {
      const event: ErrorEvent = {
        type: 'error',
        agentId: 'agent-1',
        sandboxId: 'sandbox-1',
        timestamp: new Date(),
        message: 'Test error',
        severity: 'error',
      };

      const action: AutonomousAction = {
        type: 'restart_agent',
        agentId: 'agent-1',
      };

      const created = logger.logAction({
        projectId: 'project-1',
        observerId: 'observer-1',
        action,
        triggerEvent: event,
      });

      const retrieved = logger.getAction(created.id);
      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(created.id);
      expect(retrieved?.projectId).toBe(created.projectId);
      expect(retrieved?.outcome).toBe('pending');
    });

    it('should return undefined for non-existent ID', () => {
      const retrieved = logger.getAction('act-nonexistent');
      expect(retrieved).toBeUndefined();
    });
  });

  describe('updateOutcome', () => {
    it('should update outcome to success', () => {
      const event: ErrorEvent = {
        type: 'error',
        agentId: 'agent-1',
        sandboxId: 'sandbox-1',
        timestamp: new Date(),
        message: 'Test error',
        severity: 'error',
      };

      const action: AutonomousAction = {
        type: 'restart_agent',
        agentId: 'agent-1',
      };

      const created = logger.logAction({
        projectId: 'project-1',
        observerId: 'observer-1',
        action,
        triggerEvent: event,
      });

      logger.updateOutcome(created.id, 'success', 'Agent restarted successfully');

      const updated = logger.getAction(created.id);
      expect(updated?.outcome).toBe('success');
      expect(updated?.outcomeDetails).toBe('Agent restarted successfully');
    });

    it('should update outcome to failure', () => {
      const event: ErrorEvent = {
        type: 'error',
        agentId: 'agent-1',
        sandboxId: 'sandbox-1',
        timestamp: new Date(),
        message: 'Test error',
        severity: 'error',
      };

      const action: AutonomousAction = {
        type: 'restart_agent',
        agentId: 'agent-1',
      };

      const created = logger.logAction({
        projectId: 'project-1',
        observerId: 'observer-1',
        action,
        triggerEvent: event,
      });

      logger.updateOutcome(created.id, 'failure', 'Restart timed out');

      const updated = logger.getAction(created.id);
      expect(updated?.outcome).toBe('failure');
      expect(updated?.outcomeDetails).toBe('Restart timed out');
    });

    it('should allow outcome without details', () => {
      const event: ErrorEvent = {
        type: 'error',
        agentId: 'agent-1',
        sandboxId: 'sandbox-1',
        timestamp: new Date(),
        message: 'Test error',
        severity: 'error',
      };

      const action: AutonomousAction = {
        type: 'restart_agent',
        agentId: 'agent-1',
      };

      const created = logger.logAction({
        projectId: 'project-1',
        observerId: 'observer-1',
        action,
        triggerEvent: event,
      });

      logger.updateOutcome(created.id, 'success');

      const updated = logger.getAction(created.id);
      expect(updated?.outcome).toBe('success');
      expect(updated?.outcomeDetails).toBeUndefined();
    });
  });

  describe('recordOverride', () => {
    it('should record human override', () => {
      const event: ErrorEvent = {
        type: 'error',
        agentId: 'agent-1',
        sandboxId: 'sandbox-1',
        timestamp: new Date(),
        message: 'Test error',
        severity: 'error',
      };

      const action: AutonomousAction = {
        type: 'restart_agent',
        agentId: 'agent-1',
      };

      const created = logger.logAction({
        projectId: 'project-1',
        observerId: 'observer-1',
        action,
        triggerEvent: event,
      });

      logger.recordOverride(created.id, {
        overriddenBy: 'user-123',
        overrideAction: 'dismissed',
        reason: 'False alarm - agent is fine',
      });

      const updated = logger.getAction(created.id);
      expect(updated?.humanOverride).toBeDefined();
      expect(updated?.humanOverride?.overriddenBy).toBe('user-123');
      expect(updated?.humanOverride?.overrideAction).toBe('dismissed');
      expect(updated?.humanOverride?.reason).toBe('False alarm - agent is fine');
    });

    it('should allow override without reason', () => {
      const event: ErrorEvent = {
        type: 'error',
        agentId: 'agent-1',
        sandboxId: 'sandbox-1',
        timestamp: new Date(),
        message: 'Test error',
        severity: 'error',
      };

      const action: AutonomousAction = {
        type: 'restart_agent',
        agentId: 'agent-1',
      };

      const created = logger.logAction({
        projectId: 'project-1',
        observerId: 'observer-1',
        action,
        triggerEvent: event,
      });

      logger.recordOverride(created.id, {
        overriddenBy: 'user-123',
        overrideAction: 'blocked',
      });

      const updated = logger.getAction(created.id);
      expect(updated?.humanOverride).toBeDefined();
      expect(updated?.humanOverride?.overriddenBy).toBe('user-123');
      expect(updated?.humanOverride?.reason).toBeUndefined();
    });
  });

  describe('listActions', () => {
    it('should list actions for a project ordered by createdAt DESC', async () => {
      const event: ErrorEvent = {
        type: 'error',
        agentId: 'agent-1',
        sandboxId: 'sandbox-1',
        timestamp: new Date(),
        message: 'Test error',
        severity: 'error',
      };

      const action: AutonomousAction = {
        type: 'restart_agent',
        agentId: 'agent-1',
      };

      const log1 = logger.logAction({
        projectId: 'project-1',
        observerId: 'observer-1',
        action,
        triggerEvent: event,
      });

      // Small delay to ensure different timestamps
      await new Promise((resolve) => setTimeout(resolve, 2));
      const log2 = logger.logAction({
        projectId: 'project-1',
        observerId: 'observer-1',
        action,
        triggerEvent: event,
      });

      const actions = logger.listActions('project-1');
      expect(actions).toHaveLength(2);
      // Most recent first (DESC)
      expect(actions[0].id).toBe(log2.id);
      expect(actions[1].id).toBe(log1.id);
    });

    it('should filter by outcome', () => {
      const event: ErrorEvent = {
        type: 'error',
        agentId: 'agent-1',
        sandboxId: 'sandbox-1',
        timestamp: new Date(),
        message: 'Test error',
        severity: 'error',
      };

      const action: AutonomousAction = {
        type: 'restart_agent',
        agentId: 'agent-1',
      };

      const log1 = logger.logAction({
        projectId: 'project-1',
        observerId: 'observer-1',
        action,
        triggerEvent: event,
      });

      const log2 = logger.logAction({
        projectId: 'project-1',
        observerId: 'observer-1',
        action,
        triggerEvent: event,
      });

      logger.updateOutcome(log1.id, 'success');
      logger.updateOutcome(log2.id, 'failure');

      const successActions = logger.listActions('project-1', { outcome: 'success' });
      expect(successActions).toHaveLength(1);
      expect(successActions[0].id).toBe(log1.id);

      const failureActions = logger.listActions('project-1', { outcome: 'failure' });
      expect(failureActions).toHaveLength(1);
      expect(failureActions[0].id).toBe(log2.id);

      const pendingActions = logger.listActions('project-1', {
        outcome: 'pending',
      });
      expect(pendingActions).toHaveLength(0);
    });

    it('should not list actions from other projects', () => {
      const event: ErrorEvent = {
        type: 'error',
        agentId: 'agent-1',
        sandboxId: 'sandbox-1',
        timestamp: new Date(),
        message: 'Test error',
        severity: 'error',
      };

      const action: AutonomousAction = {
        type: 'restart_agent',
        agentId: 'agent-1',
      };

      logger.logAction({
        projectId: 'project-1',
        observerId: 'observer-1',
        action,
        triggerEvent: event,
      });

      logger.logAction({
        projectId: 'project-2',
        observerId: 'observer-1',
        action,
        triggerEvent: event,
      });

      const actions = logger.listActions('project-1');
      expect(actions).toHaveLength(1);
      expect(actions[0].projectId).toBe('project-1');
    });
  });

  describe('getActionsByAgent', () => {
    it('should filter actions by agent ID using JSON extraction', () => {
      const event1: ErrorEvent = {
        type: 'error',
        agentId: 'agent-1',
        sandboxId: 'sandbox-1',
        timestamp: new Date(),
        message: 'Test error',
        severity: 'error',
      };

      const event2: ErrorEvent = {
        type: 'error',
        agentId: 'agent-2',
        sandboxId: 'sandbox-2',
        timestamp: new Date(),
        message: 'Test error 2',
        severity: 'error',
      };

      const action1: AutonomousAction = {
        type: 'restart_agent',
        agentId: 'agent-1',
      };

      const action2: AutonomousAction = {
        type: 'restart_agent',
        agentId: 'agent-2',
      };

      logger.logAction({
        projectId: 'project-1',
        observerId: 'observer-1',
        action: action1,
        triggerEvent: event1,
      });

      logger.logAction({
        projectId: 'project-1',
        observerId: 'observer-1',
        action: action2,
        triggerEvent: event2,
      });

      const agent1Actions = logger.getActionsByAgent('project-1', 'agent-1');
      expect(agent1Actions).toHaveLength(1);
      expect(agent1Actions[0].triggerEvent.agentId).toBe('agent-1');

      const agent2Actions = logger.getActionsByAgent('project-1', 'agent-2');
      expect(agent2Actions).toHaveLength(1);
      expect(agent2Actions[0].triggerEvent.agentId).toBe('agent-2');
    });

    it('should not list actions from other projects when filtering by agent', () => {
      const event: ErrorEvent = {
        type: 'error',
        agentId: 'agent-1',
        sandboxId: 'sandbox-1',
        timestamp: new Date(),
        message: 'Test error',
        severity: 'error',
      };

      const action: AutonomousAction = {
        type: 'restart_agent',
        agentId: 'agent-1',
      };

      logger.logAction({
        projectId: 'project-1',
        observerId: 'observer-1',
        action,
        triggerEvent: event,
      });

      logger.logAction({
        projectId: 'project-2',
        observerId: 'observer-1',
        action,
        triggerEvent: event,
      });

      const actions = logger.getActionsByAgent('project-1', 'agent-1');
      expect(actions).toHaveLength(1);
      expect(actions[0].projectId).toBe('project-1');
    });
  });

  describe('close', () => {
    it('should close the database connection', () => {
      const event: ErrorEvent = {
        type: 'error',
        agentId: 'agent-1',
        sandboxId: 'sandbox-1',
        timestamp: new Date(),
        message: 'Test error',
        severity: 'error',
      };

      const action: AutonomousAction = {
        type: 'restart_agent',
        agentId: 'agent-1',
      };

      logger.logAction({
        projectId: 'project-1',
        observerId: 'observer-1',
        action,
        triggerEvent: event,
      });

      logger.close();

      // Attempting to use the logger after close should fail
      expect(() => {
        logger.getAction('some-id');
      }).toThrow();
    });
  });
});
