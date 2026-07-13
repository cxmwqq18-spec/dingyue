export const relationalReplaceSafetyMessage =
  "Refusing destructive relational replace without --allow-data-loss. " +
  "The replace operation deletes customer accounts, sessions, credits, jobs, and assets before importing the source snapshot. " +
  "Create and verify a database backup, inspect a dry run, then pass --allow-data-loss explicitly.";

export function assertRelationalReplaceSafety({ replace, dryRun, allowDataLoss }) {
  if (replace && !dryRun && !allowDataLoss) {
    throw new Error(relationalReplaceSafetyMessage);
  }
}
