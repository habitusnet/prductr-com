/**
 * Simple analytics event tracking for prductr dashboard
 * Bead: gt-ops01 (convoy-000 Launch Readiness)
 *
 * Tracks key events:
 * - signups (user creation)
 * - logins (OAuth success)
 * - agent_connections (first agent registered to org)
 *
 * Implementation: Logs to cost_events table with event_type='analytics'
 * Production: Can be upgraded to PostHog/Mixpanel in Phase 8
 */

import { db } from './db';
import { costEvents } from '@conductor/db/schema';

export type AnalyticsEvent =
  | 'signup'
  | 'login'
  | 'agent_connection'
  | 'agent_heartbeat'
  | 'task_created'
  | 'task_completed'
  | 'conflict_detected'
  | 'escalation_triggered';

interface EventProperties {
  userId?: string;
  organizationId?: string;
  [key: string]: string | number | boolean | undefined;
}

/**
 * Track an analytics event
 * @param event Event name
 * @param properties Event metadata
 */
export async function trackEvent(
  event: AnalyticsEvent,
  properties: EventProperties = {}
): Promise<void> {
  try {
    // In development, just log to console
    if (process.env.NODE_ENV === 'development') {
      console.log('[Analytics]', event, properties);
      return;
    }

    // In production, write to cost_events table (reusing existing table)
    // event_type = 'analytics', cost = 0, metadata contains the event data
    const { organizationId, userId, ...metadata } = properties;

    await db.insert(costEvents).values({
      organizationId: organizationId || null,
      eventType: 'analytics', // Distinguishes from actual cost tracking
      cost: 0, // Analytics events have zero cost
      metadata: {
        event,
        userId,
        timestamp: new Date().toISOString(),
        ...metadata,
      },
    });
  } catch (error) {
    // Never throw on analytics failures - fail silently
    console.error('[Analytics] Failed to track event:', event, error);
  }
}

/**
 * Track a signup event (user creation)
 */
export async function trackSignup(userId: string, method: 'google' | 'github' = 'google'): Promise<void> {
  await trackEvent('signup', {
    userId,
    authMethod: method,
  });
}

/**
 * Track a login event (OAuth success)
 */
export async function trackLogin(userId: string, organizationId?: string): Promise<void> {
  await trackEvent('login', {
    userId,
    organizationId,
  });
}

/**
 * Track first agent connection for an organization
 */
export async function trackAgentConnection(
  organizationId: string,
  agentId: string,
  userId: string
): Promise<void> {
  await trackEvent('agent_connection', {
    organizationId,
    agentId,
    userId,
  });
}

/**
 * Query analytics events from cost_events table
 * @param eventType Filter by event type (optional)
 * @param days Number of days to look back (default 30)
 */
export async function getAnalyticsEvents(
  eventType?: AnalyticsEvent,
  days: number = 30
): Promise<Array<{
  event: AnalyticsEvent;
  timestamp: string;
  userId?: string;
  organizationId?: string;
  metadata: Record<string, any>;
}>> {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const rows = await db
    .select()
    .from(costEvents)
    .where(
      // Filter for analytics events
      (row) => row.eventType === 'analytics' && row.createdAt >= since
    );

  return rows.map((row) => ({
    event: row.metadata?.event as AnalyticsEvent,
    timestamp: row.metadata?.timestamp || row.createdAt.toISOString(),
    userId: row.metadata?.userId,
    organizationId: row.organizationId || undefined,
    metadata: row.metadata || {},
  }));
}
