import assert from "node:assert/strict";
import { sampleUploadFeedbackCount } from "../src/lib/customer-workspace-sample-selection.ts";

const selectedCount = sampleUploadFeedbackCount({
  createdAssetCount: 1,
  primarySampleIds: ["sample-1", "sample-2"],
  partnerSampleIds: []
});

assert.equal(selectedCount, 2, "upload feedback should report the current selected sample count");

assert.equal(
  sampleUploadFeedbackCount({
    createdAssetCount: 2,
    primarySampleIds: ["sample-1"],
    partnerSampleIds: ["sample-2"]
  }),
  2,
  "selected samples should be counted across both training groups"
);

assert.equal(
  sampleUploadFeedbackCount({
    createdAssetCount: 0,
    primarySampleIds: ["sample-1", "sample-1"],
    partnerSampleIds: ["sample-1"]
  }),
  1,
  "a sample selected in both groups should only count once"
);

console.log("customer workspace sample selection regression checks passed");
