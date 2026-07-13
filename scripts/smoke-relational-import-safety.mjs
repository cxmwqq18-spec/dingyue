import assert from "node:assert/strict";
import {
  assertRelationalReplaceSafety,
  relationalReplaceSafetyMessage
} from "./relational-import-safety.mjs";

assert.throws(
  () => assertRelationalReplaceSafety({ replace: true, dryRun: false, allowDataLoss: false }),
  (error) => error instanceof Error && error.message === relationalReplaceSafetyMessage
);

assert.doesNotThrow(() =>
  assertRelationalReplaceSafety({ replace: true, dryRun: true, allowDataLoss: false })
);
assert.doesNotThrow(() =>
  assertRelationalReplaceSafety({ replace: true, dryRun: false, allowDataLoss: true })
);
assert.doesNotThrow(() =>
  assertRelationalReplaceSafety({ replace: false, dryRun: false, allowDataLoss: false })
);

console.log("Relational import destructive-replace safety smoke passed.");
