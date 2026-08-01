export function sampleUploadFeedbackCount({
  createdAssetCount,
  primarySampleIds,
  partnerSampleIds
}: {
  createdAssetCount: number;
  primarySampleIds: string[];
  partnerSampleIds: string[];
}) {
  const selectedIds = new Set([...primarySampleIds, ...partnerSampleIds]);
  return selectedIds.size || createdAssetCount;
}
