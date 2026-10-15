"use client";

import { useEffect, useMemo, useState } from "react";
import { customerJsonHeaders } from "@/lib/client-csrf";
import type { WorkspaceTask } from "@/lib/aidreamcapes-workspace/types";
import styles from "./music-catalog-picker.module.css";

type CatalogTrack = {
  id: string; title: string; artist: string; genre: string; moods: string[];
  durationSeconds: number; bpm: number | null; demoOnly: boolean; licenseStatus: string;
  license: null | { territories: string[]; usageTypes: string[]; attributionRequired: boolean; attributionText: string | null };
  eligibleForRequestedUse: boolean; attributionText?: string; previewUrl: string | null; notice?: string;
};
type Props = { siteId: string; task: WorkspaceTask; csrfToken?: string; disabled?: boolean; onTaskUpdated: (task: WorkspaceTask) => void };
const SITE_ID = "site_aidreamcapes";

function errorMessage(code: string): string {
  const messages: Record<string, string> = {
    music_source_conflict: "This task already uses uploaded music. Remove that audio before attaching a catalog track.",
    revision_conflict: "This task changed in another window. Reload the latest version before attaching music.",
    music_license_required: "This track has no active license for your account.",
    music_territory_not_covered: "This license does not cover the selected territory.",
    music_ads_not_permitted: "This license does not allow advertising use.",
    music_attribution_unavailable: "Required attribution is unavailable, so this track cannot be attached.",
    workspace_auth_required: "Sign in to browse and attach licensed music.",
    customer_auth_required: "Sign in to browse and attach licensed music.",
  };
  return messages[code] ?? "The music catalog could not complete that request. Please try again.";
}

export function MusicCatalogPicker({ siteId, task, csrfToken, disabled = false, onTaskUpdated }: Props) {
  const [tracks, setTracks] = useState<CatalogTrack[]>([]);
  const [query, setQuery] = useState("");
  const [territory, setTerritory] = useState("US");
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState("");
  const [previewId, setPreviewId] = useState("");
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const endpoint = `/api/sites/${SITE_ID}/aivideosugc/music/catalog`;
  const identity = `${siteId}/${task.taskId}`;
  const hasCustomMusic = Boolean(task.input.musicUrl);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true); setError("");
      try {
        const params = new URLSearchParams({ q: query.trim(), territory, usage: "ads", take: "100" });
        const response = await fetch(`${endpoint}?${params}`, { credentials: "same-origin", cache: "no-store", signal: controller.signal });
        const result = await response.json();
        if (!response.ok) throw new Error(typeof result.error === "string" ? result.error : "request_failed");
        setTracks(Array.isArray(result.tracks) ? result.tracks : []);
      } catch (reason) {
        if (!controller.signal.aborted) { setTracks([]); setError(reason instanceof Error ? errorMessage(reason.message) : "The music catalog could not be loaded."); }
      } finally { if (!controller.signal.aborted) setLoading(false); }
    }, query ? 180 : 0);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [endpoint, identity, query, territory]);

  const visibleTracks = useMemo(() => tracks.filter((track) => !query || `${track.title} ${track.artist} ${track.genre} ${track.moods.join(" ")}`.toLocaleLowerCase().includes(query.toLocaleLowerCase())), [tracks, query]);
  async function attach(track: CatalogTrack) {
    if (!track.eligibleForRequestedUse || track.demoOnly || hasCustomMusic || disabled || busyId) return;
    setBusyId(track.id); setError(""); setStatus("");
    try {
      const headers = new Headers(customerJsonHeaders(SITE_ID));
      headers.set("content-type", "application/json"); headers.set("if-match", String(task.revision));
      if (csrfToken) headers.set("x-csrf-token", csrfToken);
      const response = await fetch(`${endpoint}/${encodeURIComponent(track.id)}/attach`, {
        method: "POST", credentials: "same-origin", headers,
        body: JSON.stringify({ taskId: task.taskId, revision: task.revision, territory, usage: "ads" }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(typeof result.error === "string" ? result.error : "request_failed");
      if (result.task) onTaskUpdated(result.task as WorkspaceTask);
      setStatus(`${track.title} is attached to this task.`);
    } catch (reason) { setError(reason instanceof Error ? errorMessage(reason.message) : "The track could not be attached."); }
    finally { setBusyId(""); }
  }

  return <section className={styles.root} aria-label="Music catalog">
    <header className={styles.heading}><div><span className={styles.eyebrow}>LICENSED MUSIC</span><h2>Choose a catalog track</h2><p>Check territory and ad-use rights before adding music to this task.</p></div><span className={styles.revision}>Task revision {task.revision}</span></header>
    {hasCustomMusic && <p className={styles.conflict} role="status">This task has uploaded music selected. Remove it before attaching a catalog track.</p>}
    <div className={styles.filters}>
      <label className={styles.search}>Search catalog<input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Track, artist, mood" /></label>
      <label className={styles.territory}>Territory (ISO code)<input value={territory} maxLength={2} autoCapitalize="characters" onChange={(event) => setTerritory(event.target.value.toUpperCase().replace(/[^A-Z]/g, ""))} /></label>
      <span className={styles.useFilter}>Use <strong>Advertising</strong></span>
    </div>
    {error && <p className={styles.error} role="alert">{error}</p>}{status && <p className={styles.success} role="status">{status}</p>}
    {loading && <p className={styles.message} role="status">Loading tracks…</p>}
    {!loading && !error && !visibleTracks.length && <p className={styles.empty}>No tracks match these filters.</p>}
    <div className={styles.list}>
      {visibleTracks.map((track) => {
        const eligible = track.eligibleForRequestedUse && track.licenseStatus === "licensed" && !track.demoOnly;
        const label = track.demoOnly ? "Demo · not licensed" : eligible ? "Licensed · eligible for ads" : `Not eligible · ${track.licenseStatus.replaceAll("_", " ")}`;
        const attribution = track.attributionText ?? (track.license?.attributionRequired ? track.license.attributionText : null);
        return <article className={styles.card} key={track.id}>
          <div className={styles.trackInfo}><h3>{track.title}</h3><p>{track.artist} · {track.genre} · {Math.floor(track.durationSeconds / 60)}:{String(track.durationSeconds % 60).padStart(2, "0")}</p><span className={eligible ? styles.eligible : styles.ineligible}>{label}</span>
            {track.notice && <p className={styles.notice}>{track.notice}</p>}
            {track.license && <p className={styles.rights}>Territories: {track.license.territories.join(", ") || "none"}. Uses: {track.license.usageTypes.join(", ") || "none"}.</p>}
            {track.license?.attributionRequired && <p className={styles.attribution}><strong>Attribution required:</strong> {attribution || "Required attribution text was not supplied."}</p>}
          </div>
          <div className={styles.actions}>
            {track.previewUrl && <button type="button" className={styles.preview} disabled={disabled || Boolean(busyId)} onClick={() => setPreviewId(previewId === track.id ? "" : track.id)}>{previewId === track.id ? "Hide preview" : "Preview"}</button>}
            <button type="button" className={styles.attach} disabled={!eligible || disabled || Boolean(busyId) || hasCustomMusic} onClick={() => void attach(track)}>{busyId === track.id ? "Adding…" : "Add to task"}</button>
          </div>
          {previewId === track.id && track.previewUrl && <audio className={styles.audio} controls preload="none" src={track.previewUrl}>Audio preview</audio>}
        </article>;
      })}
    </div>
  </section>;
}
