import type { NextRequest } from "next/server";
import { assertWorkspaceSite } from "@/lib/aidreamcapes-workspace/store";
import { workspaceResponse, workspaceFailure } from "@/lib/aidreamcapes-workspace/api";
import { getAidreamcapesInspirationCards } from "@/lib/aidreamcapes-inspirations";
import { inspirationCreateHref, type InspirationExample } from "@/lib/aidreamcapes-inspirations-types";
export const dynamic = "force-dynamic";

// Public example gallery used by the workspace's embedded Inspiration tab.
// Same relational source as the standalone /app/inspirations page.
export async function GET(_request: NextRequest, { params }: { params: Promise<{ siteId: string }> }) {
  try {
    const { siteId } = await params;
    assertWorkspaceSite(siteId);
    const cards = await getAidreamcapesInspirationCards();
    const examples: InspirationExample[] = cards.map((card) => ({
      id: card.id,
      label: card.label,
      imageSrc: card.imageSrc,
      imageAlt: card.imageAlt,
      pageTitle: card.pageTitle,
      kind: card.kind,
      description: card.description,
      category: card.category,
      createHref: inspirationCreateHref(card),
    }));
    return workspaceResponse({ cards: examples });
  } catch (error) {
    return workspaceFailure(error);
  }
}
