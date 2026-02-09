import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { EscalationQueue } from './escalation-queue';
import type { ErrorEvent, Decision } from '../types';

describe('EscalationQueue', () => {
  let queue: EscalationQueue;
  let dbPath: string;
  const projectId = 'project-1';
  const observerId = 'observer-1';

  beforeEach(() => {
    dbPath = path.join('/tmp', `test-queue-${randomUUID()}.db`);
    queue = new EscalationQueue({
      projectId,
      dbPath,
      observerId,
    });
    queue.initialize();
  });

  afterEach(() => {
    queue.dispose();
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
    }
  });

  describe('initialization', () => {
    it('should initialize without errors', () => {
      expect(queue).toBeDefined();
    });

    it('should extend EventEmitter', () => {
      expect(typeof queue.on).toBe('function');
      expect(typeof queue.emit).toBe('function');
    });
  });

  describe('createEscalation', () => {
    it('should create an escalation and emit event', async () => {
      const event: ErrorEvent = {
        type: 'error',
        agentId: 'agent-1',
        sandboxId: 'sandbox-1',
        timestamp: new Date(),
        message: 'Test error',
        severity: 'error',
      };

      const decision: Decision = {
        action: 'escalate',
        priority: 'high',
        reason: 'Manual escalation needed',
      };

      const emitSpy = vi.fn();
      queue.on('escalation', emitSpy);

      const escalation = queue.createEscalation(
        event,
        decision,
        'console output',
        []
      );

      expect(escalation).toBeDefined();
      expect(escalation.id).toMatch(/^esc-[a-f0-9-]+$/);
      expect(escalation.agentId).toBe('agent-1');
      expect(escalation.priority).toBe('high');
      expect(escalation.status).toBe('pending');
      expect(escalation.title).toMatch(/Error in agent agent-1/);
      expect(emitSpy).toHaveBeenCalledWith(escalation);
    });

    it('should generate title for auth_required event', () => {
      const event: any = {
        type: 'auth_required',
        agentId: 'agent-1',
        sandboxId: 'sandbox-1',
        timestamp: new Date(),
        provider: 'github',
      };

      const decision: Decision = {
        action: 'escalate',
        priority: 'critical',
        reason: 'Auth required',
      };

      const escalation = queue.createEscalation(event, decision, '', []);
      expect(escalation.title).toBe('Authentication required for github');
    });

    it('should generate title for stuck event', () => {
      const event: any = {
        type: 'stuck',
        agentId: 'agent-2',
        sandboxId: 'sandbox-1',
        timestamp: new Date(),
        silentDurationMs: 30000,
      };

      const decision: Decision = {
        action: 'escalate',
        priority: 'high',
        reason: 'Agent appears stuck',
      };

      const escalation = queue.createEscalation(event, decision, '', []);
      expect(escalation.title).toBe('Agent agent-2 appears stuck');
    });

    it('should generate title for crash event', () => {
      const event: any = {
        type: 'crash',
        agentId: 'agent-3',
        sandboxId: 'sandbox-1',
        timestamp: new Date(),
        exitCode: 1,
      };

      const decision: Decision = {
        action: 'escalate',
        priority: 'critical',
        reason: 'Agent crashed',
      };

      const escalation = queue.createEscalation(event, decision, '', []);
      expect(escalation.title).toBe('Agent agent-3 crashed');
    });

    it('should generate title for test_failure event', () => {
      const event: any = {
        type: 'test_failure',
        agentId: 'agent-4',
        sandboxId: 'sandbox-1',
        timestamp: new Date(),
        failedTests: 5,
        output: 'test output',
      };

      const decision: Decision = {
        action: 'escalate',
        priority: 'high',
        reason: 'Tests failed',
      };

      const escalation = queue.createEscalation(event, decision, '', []);
      expect(escalation.title).toBe('Test failures in agent agent-4');
    });

    it('should generate title for build_failure event', () => {
      const event: any = {
        type: 'build_failure',
        agentId: 'agent-5',
        sandboxId: 'sandbox-1',
        timestamp: new Date(),
        output: 'build output',
      };

      const decision: Decision = {
        action: 'escalate',
        priority: 'high',
        reason: 'Build failed',
      };

      const escalation = queue.createEscalation(event, decision, '', []);
      expect(escalation.title).toBe('Build failed for agent agent-5');
    });

    it('should generate title for rate_limited event', () => {
      const event: any = {
        type: 'rate_limited',
        agentId: 'agent-6',
        sandboxId: 'sandbox-1',
        timestamp: new Date(),
        provider: 'openai',
      };

      const decision: Decision = {
        action: 'escalate',
        priority: 'normal',
        reason: 'Rate limited',
      };

      const escalation = queue.createEscalation(event, decision, '', []);
      expect(escalation.title).toBe('Agent agent-6 rate limited by openai');
    });

    it('should generate title for git_conflict event', () => {
      const event: any = {
        type: 'git_conflict',
        agentId: 'agent-7',
        sandboxId: 'sandbox-1',
        timestamp: new Date(),
        files: ['file1.ts', 'file2.ts'],
      };

      const decision: Decision = {
        action: 'escalate',
        priority: 'high',
        reason: 'Git conflict',
      };

      const escalation = queue.createEscalation(event, decision, '', []);
      expect(escalation.title).toBe('Git conflict in agent agent-7');
    });

    it('should generate title for heartbeat_timeout event', () => {
      const event: any = {
        type: 'heartbeat_timeout',
        agentId: 'agent-8',
        sandboxId: 'sandbox-1',
        timestamp: new Date(),
        lastHeartbeat: new Date(),
      };

      const decision: Decision = {
        action: 'escalate',
        priority: 'critical',
        reason: 'Heartbeat timeout',
      };

      const escalation = queue.createEscalation(event, decision, '', []);
      expect(escalation.title).toBe('Heartbeat timeout for agent agent-8');
    });

    it('should include attempted actions in escalation', () => {
      const event: ErrorEvent = {
        type: 'error',
        agentId: 'agent-1',
        sandboxId: 'sandbox-1',
        timestamp: new Date(),
        message: 'Test error',
        severity: 'error',
      };

      const decision: Decision = {
        action: 'escalate',
        priority: 'high',
        reason: 'Escalation reason',
      };

      const actions = [
        {
          id: 'act-1',
          projectId,
          observerId,
          action: { type: 'restart_agent' as const, agentId: 'agent-1' },
          triggerEvent: event,
          outcome: 'failure' as const,
          createdAt: new Date(),
        },
      ];

      const escalation = queue.createEscalation(event, decision, '', actions);
      expect(escalation.attemptedActions).toEqual(actions);
    });
  });

  describe('getEscalation', () => {
    it('should retrieve an escalation by ID', () => {
      const event: ErrorEvent = {
        type: 'error',
        agentId: 'agent-1',
        sandboxId: 'sandbox-1',
        timestamp: new Date(),
        message: 'Test error',
        severity: 'error',
      };

      const decision: Decision = {
        action: 'escalate',
        priority: 'high',
        reason: 'Test',
      };

      const created = queue.createEscalation(event, decision, '', []);
      const retrieved = queue.getEscalation(created.id);

      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(created.id);
      expect(retrieved?.title).toBe(created.title);
    });

    it('should return undefined for non-existent ID', () => {
      const result = queue.getEscalation('esc-nonexistent');
      expect(result).toBeUndefined();
    });
  });

  describe('getPending', () => {
    it('should return all pending escalations', () => {
      const event: ErrorEvent = {
        type: 'error',
        agentId: 'agent-1',
        sandboxId: 'sandbox-1',
        timestamp: new Date(),
        message: 'Test error',
        severity: 'error',
      };

      const decision: Decision = {
        action: 'escalate',
        priority: 'high',
        reason: 'Test',
      };

      const esc1 = queue.createEscalation(event, decision, '', []);
      const esc2 = queue.createEscalation(event, decision, '', []);

      queue.acknowledge(esc2.id);

      const pending = queue.getPending();

      expect(pending).toHaveLength(1);
      expect(pending[0].id).toBe(esc1.id);
      expect(pending[0].status).toBe('pending');
    });

    it('should return empty array when no pending escalations', () => {
      const pending = queue.getPending();
      expect(pending).toEqual([]);
    });
  });

  describe('getAll', () => {
    it('should return all escalations', () => {
      const event: ErrorEvent = {
        type: 'error',
        agentId: 'agent-1',
        sandboxId: 'sandbox-1',
        timestamp: new Date(),
        message: 'Test error',
        severity: 'error',
      };

      const decision: Decision = {
        action: 'escalate',
        priority: 'high',
        reason: 'Test',
      };

      queue.createEscalation(event, decision, '', []);
      queue.createEscalation(event, decision, '', []);

      const all = queue.getAll();
      expect(all).toHaveLength(2);
    });
  });

  describe('acknowledge', () => {
    it('should update escalation status to acknowledged', () => {
      const event: ErrorEvent = {
        type: 'error',
        agentId: 'agent-1',
        sandboxId: 'sandbox-1',
        timestamp: new Date(),
        message: 'Test error',
        severity: 'error',
      };

      const decision: Decision = {
        action: 'escalate',
        priority: 'high',
        reason: 'Test',
      };

      const escalation = queue.createEscalation(event, decision, '', []);
      queue.acknowledge(escalation.id);

      const updated = queue.getEscalation(escalation.id);
      expect(updated?.status).toBe('acknowledged');
    });
  });

  describe('resolve', () => {
    it('should update escalation status to resolved with details', () => {
      const event: ErrorEvent = {
        type: 'error',
        agentId: 'agent-1',
        sandboxId: 'sandbox-1',
        timestamp: new Date(),
        message: 'Test error',
        severity: 'error',
      };

      const decision: Decision = {
        action: 'escalate',
        priority: 'high',
        reason: 'Test',
      };

      const escalation = queue.createEscalation(event, decision, '', []);
      queue.resolve(escalation.id, 'user-1', 'Issue was fixed');

      const updated = queue.getEscalation(escalation.id);
      expect(updated?.status).toBe('resolved');
      expect(updated?.resolvedBy).toBe('user-1');
      expect(updated?.resolution).toBe('Issue was fixed');
      expect(updated?.resolvedAt).toBeInstanceOf(Date);
    });
  });

  describe('dismiss', () => {
    it('should update escalation status to dismissed', () => {
      const event: ErrorEvent = {
        type: 'error',
        agentId: 'agent-1',
        sandboxId: 'sandbox-1',
        timestamp: new Date(),
        message: 'Test error',
        severity: 'error',
      };

      const decision: Decision = {
        action: 'escalate',
        priority: 'high',
        reason: 'Test',
      };

      const escalation = queue.createEscalation(event, decision, '', []);
      queue.dismiss(escalation.id);

      const updated = queue.getEscalation(escalation.id);
      expect(updated?.status).toBe('dismissed');
    });
  });

  describe('getCounts', () => {
    it('should return counts by status', () => {
      const event: ErrorEvent = {
        type: 'error',
        agentId: 'agent-1',
        sandboxId: 'sandbox-1',
        timestamp: new Date(),
        message: 'Test error',
        severity: 'error',
      };

      const decision: Decision = {
        action: 'escalate',
        priority: 'high',
        reason: 'Test',
      };

      const esc1 = queue.createEscalation(event, decision, '', []);
      const esc2 = queue.createEscalation(event, decision, '', []);
      const esc3 = queue.createEscalation(event, decision, '', []);

      queue.acknowledge(esc2.id);
      queue.resolve(esc3.id, 'user-1', 'Fixed');

      const counts = queue.getCounts();

      expect(counts.pending).toBe(1);
      expect(counts.acknowledged).toBe(1);
      expect(counts.resolved).toBe(1);
      expect(counts.dismissed).toBe(0);
    });

    it('should return zero counts initially', () => {
      const counts = queue.getCounts();

      expect(counts.pending).toBe(0);
      expect(counts.acknowledged).toBe(0);
      expect(counts.resolved).toBe(0);
      expect(counts.dismissed).toBe(0);
    });
  });

  describe('dispose', () => {
    it('should clean up resources', () => {
      const event: ErrorEvent = {
        type: 'error',
        agentId: 'agent-1',
        sandboxId: 'sandbox-1',
        timestamp: new Date(),
        message: 'Test error',
        severity: 'error',
      };

      const decision: Decision = {
        action: 'escalate',
        priority: 'high',
        reason: 'Test',
      };

      queue.createEscalation(event, decision, '', []);
      queue.dispose();

      // Attempting to query after dispose should throw
      expect(() => {
        queue.getAll();
      }).toThrow();
    });
  });

  describe('event emission', () => {
    it('should emit escalation event on creation', async () => {
      const emitSpy = vi.fn();
      queue.on('escalation', emitSpy);

      const event: ErrorEvent = {
        type: 'error',
        agentId: 'agent-1',
        sandboxId: 'sandbox-1',
        timestamp: new Date(),
        message: 'Test error',
        severity: 'error',
      };

      const decision: Decision = {
        action: 'escalate',
        priority: 'high',
        reason: 'Test',
      };

      const escalation = queue.createEscalation(event, decision, '', []);

      expect(emitSpy).toHaveBeenCalledOnce();
      expect(emitSpy).toHaveBeenCalledWith(escalation);
    });

    it('should allow multiple listeners', () => {
      const spy1 = vi.fn();
      const spy2 = vi.fn();

      queue.on('escalation', spy1);
      queue.on('escalation', spy2);

      const event: ErrorEvent = {
        type: 'error',
        agentId: 'agent-1',
        sandboxId: 'sandbox-1',
        timestamp: new Date(),
        message: 'Test error',
        severity: 'error',
      };

      const decision: Decision = {
        action: 'escalate',
        priority: 'high',
        reason: 'Test',
      };

      queue.createEscalation(event, decision, '', []);

      expect(spy1).toHaveBeenCalledOnce();
      expect(spy2).toHaveBeenCalledOnce();
    });
  });

  describe('suggested actions', () => {
    it('should suggest action for auth_required', () => {
      const event: any = {
        type: 'auth_required',
        agentId: 'agent-1',
        sandboxId: 'sandbox-1',
        timestamp: new Date(),
        provider: 'github',
      };

      const decision: Decision = {
        action: 'escalate',
        priority: 'critical',
        reason: 'Auth required',
      };

      const escalation = queue.createEscalation(event, decision, '', []);
      expect(escalation.suggestedAction).toBe(
        'Complete OAuth flow in browser'
      );
    });

    it('should suggest action for stuck event', () => {
      const event: any = {
        type: 'stuck',
        agentId: 'agent-1',
        sandboxId: 'sandbox-1',
        timestamp: new Date(),
        silentDurationMs: 30000,
      };

      const decision: Decision = {
        action: 'escalate',
        priority: 'high',
        reason: 'Agent stuck',
      };

      const escalation = queue.createEscalation(event, decision, '', []);
      expect(escalation.suggestedAction).toBe(
        'Check agent logs and restart if needed'
      );
    });

    it('should suggest action for crash event', () => {
      const event: any = {
        type: 'crash',
        agentId: 'agent-1',
        sandboxId: 'sandbox-1',
        timestamp: new Date(),
        exitCode: 1,
      };

      const decision: Decision = {
        action: 'escalate',
        priority: 'critical',
        reason: 'Agent crashed',
      };

      const escalation = queue.createEscalation(event, decision, '', []);
      expect(escalation.suggestedAction).toBe(
        'Review crash logs and restart agent'
      );
    });

    it('should suggest action for git_conflict', () => {
      const event: any = {
        type: 'git_conflict',
        agentId: 'agent-1',
        sandboxId: 'sandbox-1',
        timestamp: new Date(),
        files: ['file1.ts'],
      };

      const decision: Decision = {
        action: 'escalate',
        priority: 'high',
        reason: 'Git conflict',
      };

      const escalation = queue.createEscalation(event, decision, '', []);
      expect(escalation.suggestedAction).toBe('Manually resolve git conflicts');
    });
  });
});
