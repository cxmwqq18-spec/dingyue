import "server-only";
import { prisma } from "@/lib/prisma";
import { toPlatformAiProvider } from "@/lib/stores/prisma-mappers";
import type { PlatformAiProviderType } from "@/lib/ai-provider-type";

type ProviderRow = Parameters<typeof toPlatformAiProvider>[0];

/** Read current relational rows without requiring optional runtime columns on older installations. */
export async function listWorkspaceProviderRows(params: { providerType?: PlatformAiProviderType } = {}) {
  const rows = await prisma.$queryRaw<{ data: ProviderRow }[]>`
    SELECT to_jsonb(provider) AS data
    FROM "PlatformAiProvider" AS provider
    ORDER BY provider."providerType" ASC, provider."enabled" DESC,
      provider."priority" ASC, provider."preferred" DESC, provider."label" ASC
  `;
  return rows.map(({ data }) => {
    const provider = toPlatformAiProvider(data);
    // Explicit capability exclusions must survive the legacy row normalizer.
    if (Array.isArray(data.videoDurations)) provider.videoDurations = data.videoDurations.filter((value) => Number.isSafeInteger(value) && value > 0);
    if (Array.isArray(data.videoAspectRatios)) provider.videoAspectRatios = data.videoAspectRatios.filter((value) => ["9:16", "1:1", "16:9"].includes(value));
    return provider;
  }).filter((provider) => !params.providerType || provider.providerType === params.providerType);
}

export async function getWorkspaceProviderRow(providerId?: string) {
  if (!providerId) return undefined;
  return (await listWorkspaceProviderRows()).find((provider) => provider.id === providerId);
}
