"use client";

import { useEffect, useState } from "react";
import { csrfHeader } from "@/lib/client-csrf";
import styles from "./music-track-picker.module.css";

export interface MusicTrack {
  id: string;
  name: string;
  mimeType: string;
  url: string;
}
interface Props {
  siteId: string;
  selectedUrl?: string;
  onSelect: (url: string | undefined) => void;
  csrfToken?: string;
  disabled?: boolean;
}
export function MusicTrackPicker({ siteId, selectedUrl, onSelect, csrfToken, disabled = false }: Props) {
  const [tracks, setTracks] = useState<MusicTrack[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const endpoint = `/api/sites/${encodeURIComponent(siteId)}/aivideosugc/music`;
  async function refresh() {
    const response = await fetch(endpoint, { credentials: "same-origin", cache: "no-store" });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Could not load your audio tracks.");
    setTracks(result.tracks as MusicTrack[]);
  }
  useEffect(() => { void refresh().catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Could not load your audio tracks.")); }, [endpoint]);
  async function upload(file?: File) {
    if (!file) return;
    setBusy(true); setError("");
    try {
      const body = new FormData(); body.set("file", file);
      const response = await fetch(endpoint, { method: "POST", credentials: "same-origin", headers: { ...csrfHeader(`customer_csrf_${siteId}`), ...(csrfToken ? { "x-csrf-token": csrfToken } : {}) }, body });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not upload this audio file.");
      const track = result.track as MusicTrack;
      setTracks((current) => [track, ...current]);
      onSelect(track.url);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not upload this audio file."); }
    finally { setBusy(false); }
  }
  return <section className={styles.root} aria-label="Background music">
    <div className={styles.heading}><div><h3>Background music</h3><p>Choose one of your audio files. Your original video audio stays audible.</p></div></div>
    <label className={styles.upload}><span>Upload audio</span><input type="file" accept="audio/mpeg,audio/mp4,audio/wav,audio/x-wav,audio/ogg,audio/webm,audio/aac,audio/flac" disabled={disabled || busy} onChange={(event) => { void upload(event.currentTarget.files?.[0]); event.currentTarget.value = ""; }} /></label>
    <div className={styles.choices}>
      <button type="button" className={`${styles.track} ${!selectedUrl ? styles.selected : ""}`} disabled={disabled || busy} aria-pressed={!selectedUrl} onClick={() => onSelect(undefined)}><span>No background music</span>{!selectedUrl && <span className={styles.check}>Selected</span>}</button>
      {tracks.map((track) => <button key={track.id} type="button" className={`${styles.track} ${selectedUrl === track.url ? styles.selected : ""}`} disabled={disabled || busy} aria-pressed={selectedUrl === track.url} onClick={() => onSelect(track.url)}><span className={styles.name}>{track.name}</span><span className={styles.meta}>{track.mimeType}</span>{selectedUrl === track.url && <span className={styles.check}>Selected</span>}</button>)}
      {!tracks.length && <p className={styles.empty}>Your uploaded tracks will appear here.</p>}
    </div>
    {busy && <p className={styles.message}>Uploading audio…</p>}{error && <p className={styles.error} role="alert">{error}</p>}
  </section>;
}
