import "server-only";

import { prisma } from "@/lib/prisma";
import { WAN30_PROMPT_SKILL_MD, WAN30_PROMPT_SKILL_VERSION } from "@/lib/wan30-prompt-skill";
import type { Wan30PromptSkillRef } from "@/lib/wan30-video-prompt-optimizer";

export type PromptSkillOption = {
  slug: string;
  title: string;
  summary: string;
  isDefault: boolean;
};

/** The built-in fallback used when a site has no PromptSkill rows yet. */
export function builtInPromptSkill(): Wan30PromptSkillRef & { summary: string; isDefault: true } {
  return {
    slug: "wan30-ecommerce",
    title: "Wan3.0 e-commerce video",
    summary: "Seven-discipline Wan3.0 e-commerce video prompt structure.",
    isDefault: true,
    skillMd: WAN30_PROMPT_SKILL_MD,
    version: WAN30_PROMPT_SKILL_VERSION
  };
}

export async function listActivePromptSkills(siteId: string): Promise<PromptSkillOption[]> {
  const rows = await prisma.promptSkill.findMany({
    where: { siteId, status: "active" },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
    select: { slug: true, title: true, summary: true, isDefault: true }
  });
  if (rows.length) return rows.map((row) => ({ slug: row.slug, title: row.title, summary: row.summary ?? "", isDefault: row.isDefault }));
  const builtIn = builtInPromptSkill();
  return [{ slug: builtIn.slug, title: builtIn.title, summary: builtIn.summary, isDefault: true }];
}

/**
 * Resolve the skill the optimizer should read: the chosen active row, else the
 * site's default active row, else the built-in Wan3.0 skill. Throws
 * "prompt_skill_not_found" when the caller names a skill that is missing or
 * retired so the route can surface a clean 400.
 */
export async function resolvePromptSkill(siteId: string, slug?: string): Promise<Wan30PromptSkillRef> {
  const normalized = slug?.trim();
  if (normalized) {
    const row = await prisma.promptSkill.findUnique({ where: { siteId_slug: { siteId, slug: normalized } }, select: { slug: true, title: true, skillMd: true, version: true, status: true } });
    if (row && row.status === "active") return { slug: row.slug, title: row.title, skillMd: row.skillMd, version: row.version };
    throw new Error("prompt_skill_not_found");
  }
  const row = await prisma.promptSkill.findFirst({ where: { siteId, status: "active", isDefault: true }, select: { slug: true, title: true, skillMd: true, version: true } })
    ?? await prisma.promptSkill.findFirst({ where: { siteId, status: "active" }, orderBy: { createdAt: "asc" }, select: { slug: true, title: true, skillMd: true, version: true } });
  if (row) return { slug: row.slug, title: row.title, skillMd: row.skillMd, version: row.version };
  const builtIn = builtInPromptSkill();
  return { slug: builtIn.slug, title: builtIn.title, skillMd: builtIn.skillMd, version: builtIn.version };
}
