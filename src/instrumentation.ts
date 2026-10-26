// Runs once per server process boot, before the first request. Storefront and
// worker share one process per service, so a crash/restart leaves video jobs
// with accepted dispatch claims but no live runner; settle them honestly.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  // Only the live service may settle orphans. Deployment candidates boot with
  // the same database while the current service is still generating jobs, so
  // they must never run this recovery scan.
  if (process.env.WORKSPACE_WORKER_RECOVERY !== "1") return;
  const { recoverInterruptedWorkspaceJobs } = await import("@/lib/stores/workspace-worker-recovery");
  await recoverInterruptedWorkspaceJobs();
}
