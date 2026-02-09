import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PatternMatcher } from './pattern-matcher/index.js';
import { DecisionEngine } from './decision-engine/index.js';
import { EscalationQueue } from './escalation-queue/index.js';
import type { DetectionEvent, AuthRequiredEvent } from './types.js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Integration tests for the complete pipeline:
 * PatternMatcher -> DecisionEngine -> EscalationQueue
 *
 * Tests verify:
 * 1. Auth events escalate with critical priority
 * 2. Non-escalating events don't create escalations
 * 3. Escalation events are emitted for SSE streaming
 * 4. Escalations persist across queue instances
 * 5. Resolution lifecycle works (acknowledge -> resolve)
 */
describe('Full Pipeline Integration: PatternMatcher -> DecisionEngine -> EscalationQueue', () => {
  let patternMatcher: PatternMatcher;
  let decisionEngine: DecisionEngine;
  let escalationQueue: EscalationQueue;
  let dbPath: string;
  const projectId = 'test-project-123';
  const observerId = 'test-observer';

  beforeEach(() => {
    // Create a temporary database file for testing
    dbPath = path.join(__dirname, `test-escalation-${Date.now()}.db`);

    // Initialize components
    patternMatcher = new PatternMatcher();
    decisionEngine = new DecisionEngine({ autonomyLevel: 'full_auto' });
    escalationQueue = new EscalationQueue({
      projectId,
      dbPath,
      observerId,
    });

    // Initialize the database schema
    escalationQueue.initialize();

    // Wire the pipeline: PatternMatcher -> DecisionEngine -> EscalationQueue
    patternMatcher.on('detection', (event) => {
      const { decision } = decisionEngine.processEvent(event);
      if (decision.action === 'escalate') {
        escalationQueue.createEscalation(event, decision, 'Console output');
      }
    });
  });

  afterEach(() => {
    patternMatcher.dispose();
    decisionEngine.dispose();
    escalationQueue.dispose();

    // Clean up temporary database file
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
    }
    // Also clean up WAL files created by better-sqlite3
    const walFile = `${dbPath}-wal`;
    const shmFile = `${dbPath}-shm`;
    if (fs.existsSync(walFile)) {
      fs.unlinkSync(walFile);
    }
    if (fs.existsSync(shmFile)) {
      fs.unlinkSync(shmFile);
    }
  });

  describe('Scenario 1: Auth events escalate', () => {
    it('should detect OAuth URL and create escalation with critical priority', () => {
      return new Promise<void>((resolve) => {
        const agentId = 'auth-agent';
        const sandboxId = 'auth-sandbox';

        // Listen for escalation event emission
        escalationQueue.on('escalation', (escalation) => {
          // Verify escalation was created
          expect(escalation.id).toBeDefined();
          expect(escalation.projectId).toBe(projectId);
          expect(escalation.priority).toBe('critical');
          expect(escalation.type).toBe('auth_required');
          expect(escalation.agentId).toBe(agentId);
          expect(escalation.status).toBe('pending');
          expect(escalation.consoleOutput).toBe('Console output');

          const authEvent = escalation.detectionEvent as AuthRequiredEvent;
          expect(authEvent.provider).toBe('github');
          expect(authEvent.authUrl).toContain('github.com/login/oauth');

          resolve();
        });

        // Process OAuth URL through the pipeline
        patternMatcher.processLine(
          agentId,
          sandboxId,
          'Visit https://github.com/login/oauth to authenticate'
        );
      });
    });

    it('should escalate Google OAuth URLs with critical priority', () => {
      return new Promise<void>((resolve) => {
        const agentId = 'google-auth-agent';
        const sandboxId = 'google-sandbox';
        let escalationDetected = false;

        escalationQueue.on('escalation', (escalation) => {
          escalationDetected = true;
          expect(escalation.priority).toBe('critical');

          const authEvent = escalation.detectionEvent as AuthRequiredEvent;
          expect(authEvent.provider).toBe('google');

          resolve();
        });

        patternMatcher.processLine(
          agentId,
          sandboxId,
          'Please authenticate at https://accounts.google.com/o/oauth2'
        );

        // Safety timeout if escalation doesn't fire
        setTimeout(() => {
          if (!escalationDetected) {
            expect.fail('Escalation event was not emitted');
          }
        }, 50);
      });
    });
  });

  describe('Scenario 2: Non-escalating events', () => {
    it('should NOT create escalation for error events (autonomous action taken)', () => {
      return new Promise<void>((resolve) => {
        const agentId = 'error-agent';
        const sandboxId = 'error-sandbox';

        let escalationCreated = false;

        escalationQueue.on('escalation', () => {
          escalationCreated = true;
        });

        // Process error through the pipeline
        patternMatcher.processLine(agentId, sandboxId, 'Error: Connection refused');

        // Wait briefly, then verify no escalation was created
        setTimeout(() => {
          expect(escalationCreated).toBe(false);

          // Verify escalation queue is empty
          const pending = escalationQueue.getPending();
          expect(pending).toHaveLength(0);

          resolve();
        }, 50);
      });
    });

    it('should NOT escalate rate limit events (autonomous backoff)', () => {
      return new Promise<void>((resolve) => {
        const agentId = 'rate-limited-agent';
        const sandboxId = 'rate-sandbox';

        let escalationCreated = false;

        escalationQueue.on('escalation', () => {
          escalationCreated = true;
        });

        // Simulate rate limit message
        patternMatcher.processLine(
          agentId,
          sandboxId,
          'Rate limited by GitHub: Retry-After: 3600'
        );

        setTimeout(() => {
          expect(escalationCreated).toBe(false);
          const pending = escalationQueue.getPending();
          expect(pending).toHaveLength(0);
          resolve();
        }, 50);
      });
    });
  });

  describe('Scenario 3: Escalation event emission for SSE', () => {
    it('should emit escalation event for each escalation created', () => {
      return new Promise<void>((resolve) => {
        const escalations: typeof escalationQueue['getAll'] = [];
        const emittedEscalations: any[] = [];

        escalationQueue.on('escalation', (escalation) => {
          emittedEscalations.push(escalation);
        });

        const agentId = 'auth-agent-1';
        const sandboxId = 'sandbox-1';

        // Create one escalation
        patternMatcher.processLine(
          agentId,
          sandboxId,
          'Visit https://github.com/login/oauth to authenticate'
        );

        setTimeout(() => {
          expect(emittedEscalations).toHaveLength(1);

          const emitted = emittedEscalations[0]!;
          expect(emitted.id).toBeDefined();
          expect(emitted.priority).toBe('critical');
          expect(emitted.agentId).toBe(agentId);

          resolve();
        }, 50);
      });
    });

    it('should emit multiple escalation events for multiple escalations', () => {
      return new Promise<void>((resolve) => {
        const emittedEscalations: any[] = [];

        escalationQueue.on('escalation', (escalation) => {
          emittedEscalations.push(escalation);
        });

        // Create multiple escalations from different agents
        patternMatcher.processLine(
          'agent-1',
          'sandbox-1',
          'Visit https://github.com/login/oauth'
        );

        setTimeout(() => {
          patternMatcher.processLine(
            'agent-2',
            'sandbox-2',
            'Visit https://accounts.google.com/o/oauth2'
          );

          setTimeout(() => {
            expect(emittedEscalations).toHaveLength(2);
            expect(emittedEscalations[0]!.agentId).toBe('agent-1');
            expect(emittedEscalations[1]!.agentId).toBe('agent-2');

            resolve();
          }, 50);
        }, 50);
      });
    });
  });

  describe('Scenario 4: Persistence across queue instances', () => {
    it('should persist escalations to database and retrieve from new instance', () => {
      return new Promise<void>((resolve) => {
        const agentId = 'persistent-agent';
        const sandboxId = 'persistent-sandbox';
        let createdEscalationId = '';

        // Create an escalation
        escalationQueue.on('escalation', (escalation) => {
          createdEscalationId = escalation.id;
        });

        patternMatcher.processLine(
          agentId,
          sandboxId,
          'Visit https://github.com/login/oauth to authenticate'
        );

        setTimeout(() => {
          // Verify escalation exists in queue
          expect(createdEscalationId).toBeTruthy();
          const escalation = escalationQueue.getEscalation(createdEscalationId);
          expect(escalation).toBeDefined();
          expect(escalation?.status).toBe('pending');

          // Dispose the original queue
          escalationQueue.dispose();

          // Create a new queue instance with the same database
          const newQueue = new EscalationQueue({
            projectId,
            dbPath,
            observerId,
          });

          newQueue.initialize();

          // Verify the escalation persists in the new instance
          const persistedEscalation = newQueue.getEscalation(createdEscalationId);
          expect(persistedEscalation).toBeDefined();
          expect(persistedEscalation?.id).toBe(createdEscalationId);
          expect(persistedEscalation?.status).toBe('pending');
          expect(persistedEscalation?.projectId).toBe(projectId);

          newQueue.dispose();
          resolve();
        }, 50);
      });
    });

    it('should maintain multiple escalations across instances', () => {
      return new Promise<void>((resolve) => {
        const createdIds: string[] = [];

        escalationQueue.on('escalation', (escalation) => {
          createdIds.push(escalation.id);
        });

        // Create two escalations
        patternMatcher.processLine(
          'agent-1',
          'sandbox-1',
          'Visit https://github.com/login/oauth'
        );

        setTimeout(() => {
          patternMatcher.processLine(
            'agent-2',
            'sandbox-2',
            'Visit https://accounts.google.com/o/oauth2'
          );

          setTimeout(() => {
            expect(createdIds).toHaveLength(2);

            // Get all escalations
            let allEscalations = escalationQueue.getAll();
            expect(allEscalations).toHaveLength(2);

            escalationQueue.dispose();

            // Create new instance
            const newQueue = new EscalationQueue({
              projectId,
              dbPath,
              observerId,
            });

            newQueue.initialize();

            // Verify both escalations persist
            allEscalations = newQueue.getAll();
            expect(allEscalations).toHaveLength(2);
            expect(allEscalations.map((e) => e.id).sort()).toEqual(
              createdIds.sort()
            );

            newQueue.dispose();
            resolve();
          }, 50);
        }, 50);
      });
    });
  });

  describe('Scenario 5: Resolution lifecycle', () => {
    it('should transition escalation through acknowledge -> resolve', () => {
      return new Promise<void>((resolve) => {
        let escalationId = '';

        escalationQueue.on('escalation', (escalation) => {
          escalationId = escalation.id;
        });

        patternMatcher.processLine(
          'agent-1',
          'sandbox-1',
          'Visit https://github.com/login/oauth'
        );

        setTimeout(() => {
          expect(escalationId).toBeTruthy();

          // Verify initial status is pending
          let escalation = escalationQueue.getEscalation(escalationId)!;
          expect(escalation.status).toBe('pending');

          // Acknowledge the escalation
          escalationQueue.acknowledge(escalationId);

          escalation = escalationQueue.getEscalation(escalationId)!;
          expect(escalation.status).toBe('acknowledged');

          // Resolve the escalation
          escalationQueue.resolve(escalationId, 'user-123', 'Completed OAuth flow');

          escalation = escalationQueue.getEscalation(escalationId)!;
          expect(escalation.status).toBe('resolved');
          expect(escalation.resolvedBy).toBe('user-123');
          expect(escalation.resolution).toBe('Completed OAuth flow');
          expect(escalation.resolvedAt).toBeDefined();

          resolve();
        }, 50);
      });
    });

    it('should track escalation counts by status', () => {
      return new Promise<void>((resolve) => {
        const createdIds: string[] = [];

        escalationQueue.on('escalation', (escalation) => {
          createdIds.push(escalation.id);
        });

        // Create three escalations
        patternMatcher.processLine(
          'agent-1',
          'sandbox-1',
          'Visit https://github.com/login/oauth'
        );

        setTimeout(() => {
          patternMatcher.processLine(
            'agent-2',
            'sandbox-2',
            'Visit https://accounts.google.com/o/oauth2'
          );

          setTimeout(() => {
            patternMatcher.processLine(
              'agent-3',
              'sandbox-3',
              'Visit https://github.com/login/oauth'
            );

            setTimeout(() => {
              expect(createdIds).toHaveLength(3);

              // All three should be pending
              let counts = escalationQueue.getCounts();
              expect(counts.pending).toBe(3);
              expect(counts.acknowledged).toBe(0);
              expect(counts.resolved).toBe(0);
              expect(counts.dismissed).toBe(0);

              // Acknowledge first escalation
              escalationQueue.acknowledge(createdIds[0]!);

              counts = escalationQueue.getCounts();
              expect(counts.pending).toBe(2);
              expect(counts.acknowledged).toBe(1);

              // Resolve second escalation
              escalationQueue.resolve(
                createdIds[1]!,
                'user-123',
                'Completed auth'
              );

              counts = escalationQueue.getCounts();
              expect(counts.pending).toBe(1);
              expect(counts.acknowledged).toBe(1);
              expect(counts.resolved).toBe(1);

              // Dismiss third escalation
              escalationQueue.dismiss(createdIds[2]!);

              counts = escalationQueue.getCounts();
              expect(counts.pending).toBe(0);
              expect(counts.acknowledged).toBe(1);
              expect(counts.resolved).toBe(1);
              expect(counts.dismissed).toBe(1);

              resolve();
            }, 50);
          }, 50);
        }, 50);
      });
    });

    it('should handle resolution lifecycle across queue instances', () => {
      return new Promise<void>((resolve) => {
        let escalationId = '';

        escalationQueue.on('escalation', (escalation) => {
          escalationId = escalation.id;
        });

        patternMatcher.processLine(
          'agent-1',
          'sandbox-1',
          'Visit https://github.com/login/oauth'
        );

        setTimeout(() => {
          escalationQueue.acknowledge(escalationId);

          // Dispose and create new instance
          escalationQueue.dispose();

          const newQueue = new EscalationQueue({
            projectId,
            dbPath,
            observerId,
          });

          newQueue.initialize();

          // Verify acknowledged status persists
          let escalation = newQueue.getEscalation(escalationId);
          expect(escalation?.status).toBe('acknowledged');

          // Resolve in new instance
          newQueue.resolve(escalationId, 'user-456', 'OAuth completed');

          // Verify resolution persists
          escalation = newQueue.getEscalation(escalationId);
          expect(escalation?.status).toBe('resolved');
          expect(escalation?.resolvedBy).toBe('user-456');
          expect(escalation?.resolution).toBe('OAuth completed');

          newQueue.dispose();
          resolve();
        }, 50);
      });
    });
  });

  describe('Integration edge cases', () => {
    it('should handle rapid consecutive escalations from same agent', () => {
      return new Promise<void>((resolve) => {
        const emittedEscalations: any[] = [];

        escalationQueue.on('escalation', (escalation) => {
          emittedEscalations.push(escalation);
        });

        const agentId = 'rapid-agent';
        const sandboxId = 'rapid-sandbox';

        // Process multiple auth URLs rapidly
        patternMatcher.processLine(
          agentId,
          sandboxId,
          'Visit https://github.com/login/oauth'
        );
        patternMatcher.processLine(
          agentId,
          sandboxId,
          'Visit https://accounts.google.com/o/oauth2'
        );

        setTimeout(() => {
          expect(emittedEscalations.length).toBeGreaterThanOrEqual(2);

          // Both should be created for same agent
          const agentEscalations = emittedEscalations.filter(
            (e) => e.agentId === agentId
          );
          expect(agentEscalations.length).toBeGreaterThanOrEqual(2);

          resolve();
        }, 100);
      });
    });

    it('should correctly handle escalation with metadata from detection event', () => {
      return new Promise<void>((resolve) => {
        let escalationId = '';

        escalationQueue.on('escalation', (escalation) => {
          escalationId = escalation.id;

          // Verify all metadata is preserved
          expect(escalation.detectionEvent).toBeDefined();
          expect(escalation.detectionEvent.type).toBe('auth_required');
          expect(escalation.detectionEvent.agentId).toBe('agent-1');
          expect(escalation.detectionEvent.sandboxId).toBe('sandbox-1');
          expect(escalation.detectionEvent.timestamp).toBeInstanceOf(Date);

          const authEvent = escalation.detectionEvent as AuthRequiredEvent;
          expect(authEvent.provider).toBeTruthy();
          expect(authEvent.authUrl).toBeTruthy();

          resolve();
        });

        patternMatcher.processLine(
          'agent-1',
          'sandbox-1',
          'Visit https://github.com/login/oauth to authenticate'
        );
      });
    });
  });
});
