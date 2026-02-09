import { NextRequest, NextResponse } from "next/server";
import {
  getApiContext,
  getAccessRequests,
  approveAccessRequest,
  denyAccessRequest,
  expireOldRequests,
} from "@/lib/edge-api-helpers";
import { requireSession } from "@/lib/auth";
import {
  AccessRequestStatusSchema,
  AccessRequestActionSchema,
  validateBody,
} from "@/lib/api-validation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Types for access requests
interface AccessRequestResponse {
  id: string;
  agentId: string;
  agentName: string;
  agentType: string;
  capabilities: string[];
  requestedRole: string;
  status: "pending" | "approved" | "denied" | "expired";
  requestedAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
  expiresAt?: string;
  denialReason?: string;
}

/**
 * GET /api/access-requests
 * List all access requests for the current project
 */
export async function GET(request: NextRequest) {
  const auth = await requireSession();
  if ("error" in auth) return auth.error;

  try {
    const ctx = getApiContext();
    const { searchParams } = new URL(request.url);
    const rawStatus = searchParams.get("status") || undefined;
    const statusParsed = AccessRequestStatusSchema.safeParse(rawStatus);
    if (!statusParsed.success) {
      return NextResponse.json(
        { error: "Invalid status parameter", details: statusParsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }
    const status = statusParsed.data;

    const { requests, summary } = await getAccessRequests(
      ctx,
      status ? { status } : undefined,
    );

    const formattedRequests: AccessRequestResponse[] = requests.map((req) => ({
      id: req.id,
      agentId: req.agentId,
      agentName: req.agentName,
      agentType: req.agentType,
      capabilities: req.capabilities,
      requestedRole: req.requestedRole,
      status: req.status,
      requestedAt: req.requestedAt.toISOString(),
      reviewedAt: req.reviewedAt?.toISOString(),
      reviewedBy: req.reviewedBy,
      expiresAt: req.expiresAt?.toISOString(),
      denialReason: req.denialReason,
    }));

    return NextResponse.json({
      requests: formattedRequests,
      summary,
    });
  } catch (error) {
    console.error("Failed to fetch access requests:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch access requests",
        requests: [],
        summary: { total: 0, pending: 0, approved: 0, denied: 0, expired: 0 },
      },
      { status: 500 },
    );
  }
}

/**
 * POST /api/access-requests
 * Approve or deny an access request
 */
export async function POST(request: NextRequest) {
  const auth = await requireSession();
  if ("error" in auth) return auth.error;

  try {
    const ctx = getApiContext();
    const body = await request.json();

    const parsed = validateBody(AccessRequestActionSchema, body);
    if (!parsed.success) {
      return NextResponse.json(parsed.error, { status: 400 });
    }

    const { action } = parsed.data;

    switch (action) {
      case "approve": {
        const { requestId, reviewedBy } = parsed.data;
        const result = await approveAccessRequest(
          ctx,
          requestId,
          reviewedBy || "dashboard-user",
        );
        return NextResponse.json({
          success: true,
          message: "Access approved",
          request: {
            id: result.id,
            status: result.status,
          },
        });
      }

      case "deny": {
        const { requestId, reviewedBy, reason } = parsed.data;
        const result = await denyAccessRequest(
          ctx,
          requestId,
          reviewedBy || "dashboard-user",
          reason,
        );
        return NextResponse.json({
          success: true,
          message: "Access denied",
          request: {
            id: result.id,
            status: result.status,
          },
        });
      }

      case "expire_old": {
        const olderThanHours = parsed.data.olderThanHours || 24;
        const expiredCount = await expireOldRequests(ctx, olderThanHours);
        return NextResponse.json({
          success: true,
          message: `Expired ${expiredCount} old request(s)`,
          expiredCount,
        });
      }

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 },
        );
    }
  } catch (error) {
    console.error("Failed to process access request action:", error);
    return NextResponse.json(
      { error: "Failed to process action" },
      { status: 500 },
    );
  }
}
