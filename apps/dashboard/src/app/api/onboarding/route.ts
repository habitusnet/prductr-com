import { NextRequest, NextResponse } from "next/server";
import {
  getApiContext,
  getOnboardingConfig,
  setOnboardingConfig,
} from "@/lib/edge-api-helpers";
import { requireSession } from "@/lib/auth";
import { OnboardingActionSchema, validateBody } from "@/lib/api-validation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const auth = await requireSession();
  if ("error" in auth) return auth.error;

  try {
    const ctx = getApiContext();
    const { config, project } = await getOnboardingConfig(ctx);

    return NextResponse.json({
      projectId: ctx.projectId,
      projectName: project?.name || "Unknown Project",
      config: config || {
        welcomeMessage: "",
        currentFocus: "",
        goals: [],
        styleGuide: "",
        checkpointRules: [],
        checkpointEveryNTasks: 3,
        autoRefreshContext: true,
        agentInstructionsFiles: {},
      },
    });
  } catch (error) {
    console.error("Failed to fetch onboarding config:", error);
    return NextResponse.json(
      { error: "Failed to fetch onboarding config" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireSession();
  if ("error" in auth) return auth.error;

  try {
    const ctx = getApiContext();
    const body = await request.json();

    const parsed = validateBody(OnboardingActionSchema, body);
    if (!parsed.success) {
      return NextResponse.json(parsed.error, { status: 400 });
    }

    const { action, ...data } = parsed.data;

    if (action === "save") {
      await setOnboardingConfig(ctx, {
        welcomeMessage: data.welcomeMessage || undefined,
        currentFocus: data.currentFocus || undefined,
        goals: data.goals || [],
        styleGuide: data.styleGuide || undefined,
        checkpointRules: data.checkpointRules || [],
        checkpointEveryNTasks: data.checkpointEveryNTasks || 3,
        autoRefreshContext: data.autoRefreshContext !== false,
        agentInstructionsFiles: data.agentInstructionsFiles || {},
      });

      return NextResponse.json({
        success: true,
        message: "Onboarding config saved",
      });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    console.error("Failed to update onboarding config:", error);
    return NextResponse.json(
      { error: "Failed to update onboarding config" },
      { status: 500 },
    );
  }
}
