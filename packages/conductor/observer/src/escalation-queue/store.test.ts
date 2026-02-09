import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { EscalationStore } from './store';
import type { Escalation, ErrorEvent } from '../types';

describe('EscalationStore', () => {
  let store: EscalationStore;
  let dbPath: string;

  beforeEach(async () => {
    // Create a temporary database for each test
    dbPath = path.join('/tmp', `test-escalations-${randomUUID()}.db`);
    store = new EscalationStore(dbPath);
    store.initialize();
  });

  afterEach(() => {
    store.close();
    // Clean up test database
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
    }
  });

  describe('createEscalation', () => {
    it('should create an escalation with generated ID', async () => {
      const event: ErrorEvent = {
        type: 'error',
        agentId: 'agent-1',
        sandboxId: 'sandbox-1',
        timestamp: new Date(),
        message: 'Test error',
        severity: 'error',
      };

      const escalation = store.createEscalation({
        projectId: 'project-1',
        priority: 'high',
        type: 'error',
        title: 'Test Escalation',
        agentId: 'agent-1',
        detectionEvent: event,
        consoleOutput: 'Error output',
        attemptedActions: [],
      });

      expect(escalation).toBeDefined();
      expect(escalation.id).toMatch(/^esc-[a-f0-9-]+$/);
      expect(escalation.projectId).toBe('project-1');
      expect(escalation.priority).toBe('high');
      expect(escalation.status).toBe('pending');
      expect(escalation.createdAt).toBeInstanceOf(Date);
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

      const esc1 = store.createEscalation({
        projectId: 'project-1',
        priority: 'normal',
        type: 'error',
        title: 'Escalation 1',
        detectionEvent: event,
        consoleOutput: 'output',
        attemptedActions: [],
      });

      const esc2 = store.createEscalation({
        projectId: 'project-1',
        priority: 'normal',
        type: 'error',
        title: 'Escalation 2',
        detectionEvent: event,
        consoleOutput: 'output',
        attemptedActions: [],
      });

      expect(esc1.id).not.toBe(esc2.id);
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

      const created = store.createEscalation({
        projectId: 'project-1',
        priority: 'critical',
        type: 'error',
        title: 'Critical Issue',
        agentId: 'agent-1',
        detectionEvent: event,
        consoleOutput: 'Critical error',
        attemptedActions: [],
      });

      const retrieved = store.getEscalation(created.id);

      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(created.id);
      expect(retrieved?.title).toBe('Critical Issue');
      expect(retrieved?.priority).toBe('critical');
    });

    it('should return undefined for non-existent ID', () => {
      const result = store.getEscalation('esc-nonexistent');
      expect(result).toBeUndefined();
    });
  });

  describe('listEscalations', () => {
    it('should list all escalations for a project', () => {
      const event: ErrorEvent = {
        type: 'error',
        agentId: 'agent-1',
        sandboxId: 'sandbox-1',
        timestamp: new Date(),
        message: 'Test error',
        severity: 'error',
      };

      store.createEscalation({
        projectId: 'project-1',
        priority: 'normal',
        type: 'error',
        title: 'Issue 1',
        detectionEvent: event,
        consoleOutput: 'output',
        attemptedActions: [],
      });

      store.createEscalation({
        projectId: 'project-1',
        priority: 'high',
        type: 'error',
        title: 'Issue 2',
        detectionEvent: event,
        consoleOutput: 'output',
        attemptedActions: [],
      });

      store.createEscalation({
        projectId: 'project-2',
        priority: 'critical',
        type: 'error',
        title: 'Issue 3',
        detectionEvent: event,
        consoleOutput: 'output',
        attemptedActions: [],
      });

      const results = store.listEscalations('project-1');

      expect(results).toHaveLength(2);
      expect(results.every((e) => e.projectId === 'project-1')).toBe(true);
    });

    it('should order results by priority then createdAt', () => {
      const event: ErrorEvent = {
        type: 'error',
        agentId: 'agent-1',
        sandboxId: 'sandbox-1',
        timestamp: new Date(),
        message: 'Test error',
        severity: 'error',
      };

      const normal1 = store.createEscalation({
        projectId: 'project-1',
        priority: 'normal',
        type: 'error',
        title: 'Normal 1',
        detectionEvent: event,
        consoleOutput: 'output',
        attemptedActions: [],
      });

      // Small delay to ensure different timestamps
      const normal2 = (() => {
        const e = store.createEscalation({
          projectId: 'project-1',
          priority: 'normal',
          type: 'error',
          title: 'Normal 2',
          detectionEvent: event,
          consoleOutput: 'output',
          attemptedActions: [],
        });
        return e;
      })();

      const high = store.createEscalation({
        projectId: 'project-1',
        priority: 'high',
        type: 'error',
        title: 'High Priority',
        detectionEvent: event,
        consoleOutput: 'output',
        attemptedActions: [],
      });

      const critical = store.createEscalation({
        projectId: 'project-1',
        priority: 'critical',
        type: 'error',
        title: 'Critical',
        detectionEvent: event,
        consoleOutput: 'output',
        attemptedActions: [],
      });

      const results = store.listEscalations('project-1');

      // Should be ordered: critical, high, normal (by priority)
      expect(results[0].priority).toBe('critical');
      expect(results[1].priority).toBe('high');
      expect(results[2].priority).toBe('normal');
      expect(results[3].priority).toBe('normal');

      // Within same priority, should be ordered by createdAt
      if (results[2].createdAt && results[3].createdAt) {
        expect(results[2].createdAt.getTime()).toBeLessThanOrEqual(
          results[3].createdAt.getTime()
        );
      }
    });

    it('should filter by status', () => {
      const event: ErrorEvent = {
        type: 'error',
        agentId: 'agent-1',
        sandboxId: 'sandbox-1',
        timestamp: new Date(),
        message: 'Test error',
        severity: 'error',
      };

      const esc1 = store.createEscalation({
        projectId: 'project-1',
        priority: 'normal',
        type: 'error',
        title: 'Issue 1',
        detectionEvent: event,
        consoleOutput: 'output',
        attemptedActions: [],
      });

      const esc2 = store.createEscalation({
        projectId: 'project-1',
        priority: 'normal',
        type: 'error',
        title: 'Issue 2',
        detectionEvent: event,
        consoleOutput: 'output',
        attemptedActions: [],
      });

      // Update one to resolved
      store.updateEscalation(esc2.id, {
        status: 'resolved',
        resolvedBy: 'user-1',
        resolution: 'Fixed issue',
      });

      const pending = store.listEscalations('project-1', { status: 'pending' });
      const resolved = store.listEscalations('project-1', {
        status: 'resolved',
      });

      expect(pending).toHaveLength(1);
      expect(pending[0].id).toBe(esc1.id);

      expect(resolved).toHaveLength(1);
      expect(resolved[0].id).toBe(esc2.id);
    });

    it('should filter by priority', () => {
      const event: ErrorEvent = {
        type: 'error',
        agentId: 'agent-1',
        sandboxId: 'sandbox-1',
        timestamp: new Date(),
        message: 'Test error',
        severity: 'error',
      };

      store.createEscalation({
        projectId: 'project-1',
        priority: 'normal',
        type: 'error',
        title: 'Normal',
        detectionEvent: event,
        consoleOutput: 'output',
        attemptedActions: [],
      });

      store.createEscalation({
        projectId: 'project-1',
        priority: 'critical',
        type: 'error',
        title: 'Critical',
        detectionEvent: event,
        consoleOutput: 'output',
        attemptedActions: [],
      });

      const critical = store.listEscalations('project-1', {
        priority: 'critical',
      });

      expect(critical).toHaveLength(1);
      expect(critical[0].priority).toBe('critical');
    });
  });

  describe('updateEscalation', () => {
    it('should update escalation status', () => {
      const event: ErrorEvent = {
        type: 'error',
        agentId: 'agent-1',
        sandboxId: 'sandbox-1',
        timestamp: new Date(),
        message: 'Test error',
        severity: 'error',
      };

      const escalation = store.createEscalation({
        projectId: 'project-1',
        priority: 'high',
        type: 'error',
        title: 'Test Issue',
        detectionEvent: event,
        consoleOutput: 'output',
        attemptedActions: [],
      });

      store.updateEscalation(escalation.id, { status: 'acknowledged' });

      const updated = store.getEscalation(escalation.id);
      expect(updated?.status).toBe('acknowledged');
    });

    it('should update resolution fields', () => {
      const event: ErrorEvent = {
        type: 'error',
        agentId: 'agent-1',
        sandboxId: 'sandbox-1',
        timestamp: new Date(),
        message: 'Test error',
        severity: 'error',
      };

      const escalation = store.createEscalation({
        projectId: 'project-1',
        priority: 'high',
        type: 'error',
        title: 'Test Issue',
        detectionEvent: event,
        consoleOutput: 'output',
        attemptedActions: [],
      });

      const resolvedAt = new Date();
      store.updateEscalation(escalation.id, {
        status: 'resolved',
        resolvedBy: 'user-1',
        resolvedAt,
        resolution: 'Fixed the issue',
      });

      const updated = store.getEscalation(escalation.id);
      expect(updated?.status).toBe('resolved');
      expect(updated?.resolvedBy).toBe('user-1');
      expect(updated?.resolution).toBe('Fixed the issue');
    });

    it('should partially update escalation', () => {
      const event: ErrorEvent = {
        type: 'error',
        agentId: 'agent-1',
        sandboxId: 'sandbox-1',
        timestamp: new Date(),
        message: 'Test error',
        severity: 'error',
      };

      const escalation = store.createEscalation({
        projectId: 'project-1',
        priority: 'high',
        type: 'error',
        title: 'Test Issue',
        agentId: 'agent-1',
        detectionEvent: event,
        consoleOutput: 'output',
        attemptedActions: [],
      });

      store.updateEscalation(escalation.id, { status: 'acknowledged' });

      const updated = store.getEscalation(escalation.id);
      expect(updated?.status).toBe('acknowledged');
      expect(updated?.agentId).toBe('agent-1');
      expect(updated?.title).toBe('Test Issue');
    });
  });

  describe('deleteEscalation', () => {
    it('should delete an escalation by ID', () => {
      const event: ErrorEvent = {
        type: 'error',
        agentId: 'agent-1',
        sandboxId: 'sandbox-1',
        timestamp: new Date(),
        message: 'Test error',
        severity: 'error',
      };

      const escalation = store.createEscalation({
        projectId: 'project-1',
        priority: 'normal',
        type: 'error',
        title: 'Test Issue',
        detectionEvent: event,
        consoleOutput: 'output',
        attemptedActions: [],
      });

      const retrieved = store.getEscalation(escalation.id);
      expect(retrieved).toBeDefined();

      store.deleteEscalation(escalation.id);

      const deleted = store.getEscalation(escalation.id);
      expect(deleted).toBeUndefined();
    });

    it('should not throw when deleting non-existent ID', () => {
      expect(() => {
        store.deleteEscalation('esc-nonexistent');
      }).not.toThrow();
    });
  });

  describe('countByStatus', () => {
    it('should count escalations by status', () => {
      const event: ErrorEvent = {
        type: 'error',
        agentId: 'agent-1',
        sandboxId: 'sandbox-1',
        timestamp: new Date(),
        message: 'Test error',
        severity: 'error',
      };

      const esc1 = store.createEscalation({
        projectId: 'project-1',
        priority: 'normal',
        type: 'error',
        title: 'Issue 1',
        detectionEvent: event,
        consoleOutput: 'output',
        attemptedActions: [],
      });

      const esc2 = store.createEscalation({
        projectId: 'project-1',
        priority: 'normal',
        type: 'error',
        title: 'Issue 2',
        detectionEvent: event,
        consoleOutput: 'output',
        attemptedActions: [],
      });

      const esc3 = store.createEscalation({
        projectId: 'project-1',
        priority: 'normal',
        type: 'error',
        title: 'Issue 3',
        detectionEvent: event,
        consoleOutput: 'output',
        attemptedActions: [],
      });

      store.updateEscalation(esc2.id, { status: 'resolved' });
      store.updateEscalation(esc3.id, { status: 'acknowledged' });

      const counts = store.countByStatus('project-1');

      expect(counts.pending).toBe(1);
      expect(counts.acknowledged).toBe(1);
      expect(counts.resolved).toBe(1);
      expect(counts.dismissed).toBe(0);
    });

    it('should return zero counts for non-existent project', () => {
      const counts = store.countByStatus('project-nonexistent');

      expect(counts.pending).toBe(0);
      expect(counts.acknowledged).toBe(0);
      expect(counts.resolved).toBe(0);
      expect(counts.dismissed).toBe(0);
    });

    it('should isolate counts by project', () => {
      const event: ErrorEvent = {
        type: 'error',
        agentId: 'agent-1',
        sandboxId: 'sandbox-1',
        timestamp: new Date(),
        message: 'Test error',
        severity: 'error',
      };

      store.createEscalation({
        projectId: 'project-1',
        priority: 'normal',
        type: 'error',
        title: 'Issue 1',
        detectionEvent: event,
        consoleOutput: 'output',
        attemptedActions: [],
      });

      store.createEscalation({
        projectId: 'project-2',
        priority: 'normal',
        type: 'error',
        title: 'Issue 2',
        detectionEvent: event,
        consoleOutput: 'output',
        attemptedActions: [],
      });

      const counts1 = store.countByStatus('project-1');
      const counts2 = store.countByStatus('project-2');

      expect(counts1.pending).toBe(1);
      expect(counts2.pending).toBe(1);
    });
  });

  describe('database persistence', () => {
    it('should persist escalations across instances', () => {
      const event: ErrorEvent = {
        type: 'error',
        agentId: 'agent-1',
        sandboxId: 'sandbox-1',
        timestamp: new Date(),
        message: 'Test error',
        severity: 'error',
      };

      const escalation = store.createEscalation({
        projectId: 'project-1',
        priority: 'high',
        type: 'error',
        title: 'Persistent Issue',
        detectionEvent: event,
        consoleOutput: 'output',
        attemptedActions: [],
      });

      const escId = escalation.id;

      store.close();

      // Create new store instance with same database
      const store2 = new EscalationStore(dbPath);
      store2.initialize();

      const retrieved = store2.getEscalation(escId);
      expect(retrieved).toBeDefined();
      expect(retrieved?.title).toBe('Persistent Issue');

      store2.close();
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

      store.createEscalation({
        projectId: 'project-1',
        priority: 'normal',
        type: 'error',
        title: 'Test',
        detectionEvent: event,
        consoleOutput: 'output',
        attemptedActions: [],
      });

      store.close();

      // Attempting to query after close should throw
      expect(() => {
        store.listEscalations('project-1');
      }).toThrow();
    });
  });
});
