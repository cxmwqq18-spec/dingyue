import type { NextRequest } from "next/server";
import { workspaceAuth } from "@/lib/aidreamcapes-workspace/auth";
import { workspaceResponse, workspaceFailure } from "@/lib/aidreamcapes-workspace/api";
import { listActivePromptSkills } from "@/lib/prompt-skills";

export async function GET(request: NextRequest, { params }: { params: Promise<{ siteId: string }> }) {
  try {
    const { siteId } = await params;
    const auth = await workspaceAuth(request, siteId);
    if (!auth.ok) return auth.response;
    const skills = await listActivePromptSkills(siteId);
    return workspaceResponse({ ok: true, skills });
  } catch (error) { return workspaceFailure(error); }
}

export const dynamic = "force-dynamic";
