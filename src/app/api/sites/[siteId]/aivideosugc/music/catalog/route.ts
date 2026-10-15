import type { NextRequest } from "next/server";
import { workspaceAuth } from "@/lib/aidreamcapes-workspace/auth";
import { workspaceFailure, workspaceResponse } from "@/lib/aidreamcapes-workspace/api";
import { listMusicCatalogForCustomer } from "@/lib/aidreamcapes-workspace/music-catalog";
import { normalizeMusicTerritory } from "@/lib/aidreamcapes-workspace/music-catalog-rights";
import { WorkspaceError, type MusicUsage } from "@/lib/aidreamcapes-workspace/types";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ siteId: string }> };

function normalizedText(value: string): string {
  return value.normalize("NFKD").toLocaleLowerCase("en").trim();
}

export async function GET(request: NextRequest, { params }: Context) {
  try {
    const { siteId } = await params;
    const auth = await workspaceAuth(request, siteId);
    if (!auth.ok) return auth.response;

    const query = request.nextUrl.searchParams;
    const q = query.get("q")?.trim().slice(0, 120) ?? "";
    const genre = query.get("genre")?.trim().slice(0, 80).toLocaleLowerCase("en") ?? "";
    const mood = query.get("mood")?.trim().slice(0, 80).toLocaleLowerCase("en") ?? "";
    const rawTerritory = query.get("territory");
    const territory = rawTerritory ? normalizeMusicTerritory(rawTerritory) : undefined;
    if (rawTerritory && !territory) throw new WorkspaceError("music_territory_invalid");

    const rawUsage = query.get("usage");
    if (rawUsage && rawUsage !== "ads" && rawUsage !== "organic") throw new WorkspaceError("music_usage_invalid");
    const usage = rawUsage as MusicUsage | null;
    const rawLicensedOnly = query.get("licensedOnly");
    if (rawLicensedOnly && rawLicensedOnly !== "true" && rawLicensedOnly !== "false") throw new WorkspaceError("music_filter_invalid");
    const licensedOnly = rawLicensedOnly === "true";
    const takeValue = Number(query.get("take") ?? 50);
    const offsetValue = Number(query.get("offset") ?? 0);
    if (!Number.isSafeInteger(takeValue) || takeValue < 1 || takeValue > 100 ||
        !Number.isSafeInteger(offsetValue) || offsetValue < 0 || offsetValue > 10000) {
      throw new WorkspaceError("music_pagination_invalid");
    }

    const catalog = await listMusicCatalogForCustomer(siteId, auth.current.customer.id, { territory, usage: usage ?? undefined });
    const needle = normalizedText(q);
    const filtered = catalog.filter((track) => {
      const searchText = normalizedText(`${track.title} ${track.artist} ${track.genre} ${track.moods.join(" ")}`);
      if (needle && !searchText.includes(needle)) return false;
      if (genre && track.genre.toLocaleLowerCase("en") !== genre) return false;
      if (mood && !track.moods.some((value) => value.toLocaleLowerCase("en") === mood)) return false;
      if (licensedOnly && track.licenseStatus !== "licensed") return false;
      if (territory && track.license && !track.license.territories.some((value) => value === "*" || value.toUpperCase() === territory)) return false;
      if (usage && track.license && !track.license.usageTypes.includes(usage)) return false;
      return true;
    });

    return workspaceResponse({
      tracks: filtered.slice(offsetValue, offsetValue + takeValue),
      page: { total: filtered.length, take: takeValue, offset: offsetValue },
      filters: { q, genre: genre || undefined, mood: mood || undefined, territory, usage: usage ?? undefined, licensedOnly },
    });
  } catch (error) {
    return workspaceFailure(error);
  }
}
