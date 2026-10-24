import "server-only";
import { prisma } from "@/lib/prisma";
import { toPlatformAiProvider } from "@/lib/stores/prisma-mappers";
import type { PlatformAiProviderType } from "@/lib/ai-provider-type";
import { isValidAiProviderVideoAspectRatio, isValidAiProviderVideoDuration } from "@/lib/ai-provider-video-options";

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
    if (Array.isArray(data.videoDurations)) provider.videoDurations = data.videoDurations.filter((value) => isValidAiProviderVideoDuration(value));
    if (Array.isArray(data.videoAspectRatios)) provider.videoAspectRatios = data.videoAspectRatios.filter((value) => isValidAiProviderVideoAspectRatio(value));
    // 模型级价格是较晚新增的可选列，旧库没有这些列时按"未定价"处理。
    if (data.priceEnabled === undefined) provider.priceEnabled = false;
    return provider;
  }).filter((provider) => !params.providerType || provider.providerType === params.providerType);
}

export async function getWorkspaceProviderRow(providerId?: string) {
  if (!providerId) return undefined;
  return (await listWorkspaceProviderRows()).find((provider) => provider.id === providerId);
}
