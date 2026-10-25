const SAFE_RELEASE_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

/**
 * Decide which release directories may be removed.
 *
 * A release is only ever removed when all of these hold:
 * - the currently served release (the `current` symlink target) is known
 *   and lives inside this site's releases directory;
 * - the directory is not referenced by the running service unit;
 * - the directory has no `.keep` marker;
 * - it is not one of the newest `keepCount` releases.
 *
 * Anything unexpected throws instead of guessing, so a broken listing can
 * never delete a live release.
 */
export function planReleaseRetention({ releases, keepCount = 3, currentRelease = "", systemdReleases = [] }) {
  if (!Number.isSafeInteger(keepCount) || keepCount < 1) {
    throw new Error("keepCount must be a positive integer");
  }
  const entries = releases.map((entry) => {
    const name = String(entry.name ?? "");
    const mtime = Number(entry.mtime ?? 0);
    if (!SAFE_RELEASE_NAME.test(name)) throw new Error(`unsafe release directory name: ${JSON.stringify(name)}`);
    if (!Number.isFinite(mtime)) throw new Error(`release ${name} has no usable mtime`);
    return { name, mtime, keepMarker: Boolean(entry.keepMarker) };
  });

  const names = new Set(entries.map((entry) => entry.name));
  const currentName = String(currentRelease ?? "").split("/").filter(Boolean).pop() ?? "";
  if (!currentName || !names.has(currentName)) {
    throw new Error("current release could not be resolved inside the release directory; refusing to prune");
  }

  const protectedNames = new Set([currentName]);
  for (const reference of systemdReleases) {
    const name = String(reference ?? "").split("/").filter(Boolean).pop() ?? "";
    if (name && names.has(name)) protectedNames.add(name);
  }
  for (const entry of entries) {
    if (entry.keepMarker) protectedNames.add(entry.name);
  }

  const newest = [...entries].sort((a, b) => b.mtime - a.mtime).slice(0, keepCount).map((entry) => entry.name);
  for (const name of newest) protectedNames.add(name);

  const keep = entries
    .filter((entry) => protectedNames.has(entry.name))
    .sort((a, b) => b.mtime - a.mtime)
    .map((entry) => entry.name);
  const deleteNames = entries
    .filter((entry) => !protectedNames.has(entry.name))
    .sort((a, b) => a.mtime - b.mtime)
    .map((entry) => entry.name);

  return { current: currentName, keep, delete: deleteNames, keepCount };
}

export function assertSafeReleaseName(name) {
  if (!SAFE_RELEASE_NAME.test(String(name ?? ""))) throw new Error(`unsafe release directory name: ${JSON.stringify(name)}`);
  return name;
}
