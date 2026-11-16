"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { AudioLines, ImagePlus, Upload } from "lucide-react";
import { csrfHeader } from "@/lib/client-csrf";
import { activeTwinConsent, ownedTwinAssets, preferredTwinPortraits, twinError, twinStatus, type TwinActor, type TwinAsset, type TwinCapabilities, type TwinConsent, type TwinJob } from "./twin-client";
import styles from "./twin-workbench.module.css";

export type TwinWorkbenchProps = { siteId: string; customerId?: string; csrfToken?: string; loginHref: string; onUseActor?: (actorId: string) => void };

export function TwinWorkbench(props: TwinWorkbenchProps) {
  return <TwinWorkspace key={`${props.siteId}:${props.customerId ?? "guest"}`} {...props} />;
}

function TwinWorkspace({ siteId, customerId, csrfToken, loginHref, onUseActor }: TwinWorkbenchProps) {
  const [actors, setActors] = useState<TwinActor[]>([]);
  const [assets, setAssets] = useState<TwinAsset[]>([]);
  const [jobs, setJobs] = useState<TwinJob[]>([]);
  const [consents, setConsents] = useState<TwinConsent[]>([]);
  const [capabilities, setCapabilities] = useState<TwinCapabilities | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [notice, setNotice] = useState("");
  const [name, setName] = useState("");
  const [portrait, setPortrait] = useState("");
  const [audio, setAudio] = useState("");
  const [actorId, setActorId] = useState("");
  const [gender, setGender] = useState("female");
  const [ageRange, setAgeRange] = useState("25-34");
  const [language, setLanguage] = useState("en");
  const [rights, setRights] = useState(false);
  const [demo, setDemo] = useState(false);
  const [brokenPortraits, setBrokenPortraits] = useState<ReadonlySet<string>>(new Set());
  const lock = useRef(false);
  const generation = useRef(0);
  const mounted = useRef(true);
  const base = `/api/sites/${encodeURIComponent(siteId)}/aivideosugc`;
  const assetPath = `/api/sites/${encodeURIComponent(siteId)}/customers/${encodeURIComponent(customerId ?? "")}/assets`;
  const allowed = siteId === "site_aidreamcapes" && Boolean(customerId);

  const request = useCallback(async <T,>(path: string, init: RequestInit = {}): Promise<T> => {
    const mutation = Boolean(init.method && init.method !== "GET");
    if (!allowed) throw new Error("Log in to manage your personal profiles.");
    const headers = new Headers(init.headers);
    if (mutation) {
      const token = csrfToken || csrfHeader(`customer_csrf_${siteId}`)["x-csrf-token"];
      if (!token) throw new Error(twinError("csrf_missing"));
      headers.set("x-csrf-token", token);
      if (!(init.body instanceof FormData)) headers.set("Content-Type", "application/json");
    }
    const response = await fetch(path, { ...init, headers, credentials: "same-origin", cache: "no-store" });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(twinError(String(result.error ?? "request_failed"), response.status));
    return result as T;
  }, [allowed, csrfToken, siteId]);

  const refresh = useCallback(async (silent = false) => {
    if (!allowed) return;
    const current = ++generation.current;
    if (!silent) { setLoading(true); setMessage(""); }
    try {
      const [cap, actorData, assetData, jobData, consentData] = await Promise.all([
        request<TwinCapabilities>(`${base}/clones`), request<{ actors: TwinActor[] }>(`${base}/actors`),
        request<{ assets: TwinAsset[] }>(`${base}/clones/assets`),
        request<{ jobs: TwinJob[] }>(`${base}/clones/jobs`), request<{ consents: TwinConsent[] }>(`${base}/clones/consents`),
      ]);
      if (!mounted.current || current !== generation.current) return;
      if ((cap.components?.database ?? cap.database)?.available === false) throw new Error(twinError("database_unavailable"));
      setCapabilities(cap); setActors(actorData.actors.filter(actor => actor.actorId.startsWith("custom-")));
      setAssets(assetData.assets); setJobs(jobData.jobs.filter(job => job.workflow === "voice_twin")); setBrokenPortraits(new Set());
      setConsents(consentData.consents.filter(consent => consent.workflow === "voice_twin")); setLoaded(true);
    } catch (error) {
      if (mounted.current && current === generation.current) { setMessage((error as Error).message); setLoaded(false); }
    } finally { if (mounted.current && current === generation.current) setLoading(false); }
  }, [allowed, base, request]);

  useEffect(() => { const epochs = generation; mounted.current = true; void refresh(); return () => { mounted.current = false; epochs.current++; }; }, [refresh]);
  const pending = jobs.some(job => ["queued", "running"].includes(job.status));
  useEffect(() => {
    if (!pending || !loaded) return;
    const timer = window.setInterval(() => { if (!lock.current && document.visibilityState === "visible") void refresh(true); }, 6000);
    return () => window.clearInterval(timer);
  }, [pending, loaded, refresh]);

  async function mutate(action: () => Promise<void>) {
    if (lock.current || !allowed) return;
    lock.current = true; generation.current++; setBusy(true); setLoading(false); setMessage(""); setNotice("");
    try { await action(); }
    catch (error) { if (mounted.current) setMessage((error as Error).message); }
    finally { lock.current = false; if (mounted.current) setBusy(false); }
  }

  async function create(event: FormEvent) {
    event.preventDefault();
    await mutate(async () => {
      if (!rights || !demo || !loaded || capabilities?.voiceTwin?.state !== "mock_only") return;
      let selected = actors.find(actor => actor.actorId === actorId);
      if (!selected) {
        const image = assets.find(asset => asset.id === portrait);
        const reference = assets.find(asset => asset.id === audio);
        if (!image || !reference || !name.trim()) return;
        const result = await request<{ actor: TwinActor }>(`${base}/actors`, { method: "POST", body: JSON.stringify({ name: name.trim(), gender, ageRange, languages: [language], imageUrl: image.previewUrl, refAudio: reference.previewUrl }) });
        selected = result.actor; setActors(previous => [...previous, result.actor]); setActorId(selected.actorId);
      }
      const { consent } = await request<{ consent: TwinConsent }>(`${base}/clones/consents`, { method: "POST", body: JSON.stringify({ workflow: "voice_twin", scope: "voice_twin", actorId: selected.actorId, rightsConfirmed: true }) });
      setConsents(previous => [consent, ...previous]);
      await queue(consent);
      setRights(false); setDemo(false); setNotice("Simulation queued. No voice is trained and no generation credits are used.");
    });
  }

  async function queue(consent: TwinConsent) {
    const { job } = await request<{ job: TwinJob }>(`${base}/clones/voice-twins/queue`, { method: "POST", headers: { "Idempotency-Key": `twin-ui:${consent.id}:${consent.revision}` }, body: JSON.stringify({ consentId: consent.id, consentRevision: consent.revision }) });
    setJobs(previous => [job, ...previous.filter(item => item.id !== job.id)]);
  }

  async function jobAction(job: TwinJob, action: "cancel" | "run-mock" | "delete") {
    if (action === "delete" && !window.confirm("Delete this saved request? Your personal presenter and original uploads will be kept. Consent audit records are retained.")) return;
    await mutate(async () => {
      const { job: next } = await request<{ job: TwinJob }>(`${base}/clones/jobs/${encodeURIComponent(job.id)}${action === "delete" ? "" : `/${action}`}`, { method: action === "delete" ? "DELETE" : "POST", headers: { "If-Match": String(job.revision) } });
      setJobs(previous => previous.map(item => item.id === job.id ? next : item));
      setNotice(action === "delete" ? "Request deleted. Your original media and presenter are kept." : action === "cancel" ? "Request cancelled." : "Simulation complete. No audio was processed and no cloned voice was created.");
    });
  }

  async function revoke(consent: TwinConsent) {
    if (!window.confirm("Revoke permission for this voice request? It cannot be used for new requests after revocation.")) return;
    await mutate(async () => {
      const { consent: next } = await request<{ consent: TwinConsent }>(`${base}/clones/consents/${encodeURIComponent(consent.id)}`, { method: "PATCH", headers: { "If-Match": String(consent.revision) }, body: JSON.stringify({ action: "revoke" }) });
      setConsents(previous => previous.map(item => item.id === consent.id ? next : item)); setNotice("Permission revoked. New requests using this consent are blocked.");
    });
  }

  async function uploadPortrait(file?: File) {
    if (!file) return;
    await mutate(async () => {
      if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size > 32 * 1024 * 1024) throw new Error("Choose a JPG, PNG or WebP portrait under 32 MB.");
      const body = new FormData(); body.append("file", file); body.append("label", file.name.replace(/\.[^.]+$/, "")); body.append("role", "input"); body.append("subjectRole", "twin_portrait");
      const { asset } = await request<{ asset: TwinAsset }>(assetPath, { method: "POST", body });
      setAssets(previous => [asset, ...previous.filter(item => item.id !== asset.id)]); setPortrait(asset.id);
    });
  }

  async function uploadAudio(file?: File) {
    if (!file) return;
    await mutate(async () => {
      if (!file.type.startsWith("audio/") || file.size > 20 * 1024 * 1024) throw new Error("Choose an audio recording under 20 MB and 5 minutes.");
      const body = new FormData(); body.append("file", file); body.append("workflow", "voice_twin");
      const { asset } = await request<{ asset: TwinAsset }>(`${base}/clones/assets`, { method: "POST", body });
      setAssets(previous => [asset, ...previous.filter(item => item.id !== asset.id)]); setAudio(asset.id);
    });
  }

  async function retry(job: TwinJob) {
    await mutate(async () => {
      const { job: next } = await request<{ job: TwinJob }>(`${base}/clones/jobs/${encodeURIComponent(job.id)}/retry`, { method: "POST", headers: { "If-Match": String(job.revision) }, body: JSON.stringify({ revision: job.revision, idempotencyKey: `twin-retry:${job.id}:${job.revision}`, mockMode: true }) });
      setJobs(previous => [next, ...previous.filter(item => item.id !== next.id)]); setNotice("A new simulation request has been saved.");
    });
  }

  async function bind(job: TwinJob) {
    if (!job.actorId) return;
    await mutate(async () => {
      const { actor } = await request<{ actor: TwinActor }>(`${base}/clones/jobs/${encodeURIComponent(job.id)}/bind-actor`, { method: "POST", headers: { "If-Match": String(job.revision) }, body: JSON.stringify({ revision: job.revision, actorId: job.actorId, mockMode: true }) });
      setActors(previous => previous.map(item => item.actorId === actor.actorId ? actor : item));
      setNotice("Simulation linked to your presenter for testing. Its voice is still a placeholder; real voice cloning is unavailable.");
    });
  }

  async function deletePresenter(actor: TwinActor) {
    if (!window.confirm(`Delete “${actor.name}” and revoke its active voice permissions? Original uploads and request audit history will be kept.`)) return;
    await mutate(async () => {
      for (const consent of consents.filter(item => item.actorId === actor.actorId && activeTwinConsent(item))) {
        const { consent: next } = await request<{ consent: TwinConsent }>(`${base}/clones/consents/${encodeURIComponent(consent.id)}`, { method: "PATCH", headers: { "If-Match": String(consent.revision) }, body: JSON.stringify({ action: "revoke" }) });
        setConsents(previous => previous.map(item => item.id === next.id ? next : item));
      }
      await request(`${base}/actors/${encodeURIComponent(actor.actorId)}`, { method: "DELETE" });
      setActors(previous => previous.filter(item => item.actorId !== actor.actorId));
      if (actorId === actor.actorId) { setActorId(""); setRights(false); }
      setNotice("Personal presenter deleted and active voice permissions revoked. Your original uploads and request history are kept.");
    });
  }

  const portraits = preferredTwinPortraits(assets).filter(asset => !brokenPortraits.has(asset.id));
  const visibleJobs = jobs.filter(job => job.status !== "deleted");
  const recordings = ownedTwinAssets(assets, "audio");
  const selectedActor = actors.find(actor => actor.actorId === actorId);
  const selectedImage = selectedActor?.imageUrl || portraits.find(asset => asset.id === portrait)?.previewUrl;
  const selectedAudio = selectedActor?.voice.refAudio || recordings.find(asset => asset.id === audio)?.previewUrl;
  const canCreate = loaded && capabilities?.voiceTwin?.state === "mock_only" && (selectedActor ? Boolean(selectedActor.voice.refAudio) : Boolean(name.trim() && portrait && audio)) && rights && demo && !busy;

  return <section className={styles.workbench} aria-label="AI Twin workbench">
    <header className={styles.heading}><div><span className={styles.eyebrow}>YOUR PRIVATE STUDIO</span><h1><span>AI Twin</span></h1><p><span>Keep your portrait and voice reference together in a personal presenter profile.</span></p></div><span className={styles.badge}>Private profiles</span></header>
    <div className={styles.explanation}><span className={styles.mark} aria-hidden="true">◎</span><div><h2><span>Your likeness. Your permission.</span></h2><p><span>A portrait profile is not a trained digital twin. Voice training and talking-video capabilities must be available before a cloned voice can be used.</span></p></div></div>
    {!allowed ? <div className={styles.guest}><h2><span>Build your personal presenter</span></h2><p><span>Choose your own portrait and recording, confirm permission, and track saved requests here. Your uploads and requests require an account.</span></p><a className={styles.primary} href={loginHref}><span>Log in to continue</span></a></div> : <>
      <div className={styles.toolbar}><div><strong><span>{loaded && capabilities?.voiceTwin?.state === "mock_only" ? "Simulation workspace" : "Workspace availability"}</span></strong><p><span>{loaded && capabilities?.voiceTwin?.state === "mock_only" ? "Real voice cloning is unavailable. Simulations test the saved workflow without training a voice." : loading ? "Checking saved profiles and service availability." : "Voice training is unavailable here. Refresh to check availability; saved profiles are kept."}</span></p></div><button type="button" className={styles.button} disabled={busy || loading} onClick={() => void refresh()}><span>{loading ? "Refreshing…" : "Refresh"}</span></button></div>
      {message ? <div role="alert" className={styles.error}><span>{message}</span><a href={loginHref}><span>Log in again</span></a></div> : null}
      {notice ? <p role="status" className={styles.notice}><span>{notice}</span></p> : null}
      <div className={styles.columns}>
        <form className={styles.panel} onSubmit={event => void create(event)}><div className={styles.sectionTitle}><span className={styles.step}>01</span><h2><span>Create a request</span></h2></div>
          <fieldset disabled={!loaded || busy}><label className={styles.field}><span>Personal presenter</span><select aria-label="Personal presenter" value={actorId} onChange={event => { setActorId(event.target.value); setRights(false); }}><option value="">Create a new presenter</option>{actors.map(actor => <option key={actor.actorId} value={actor.actorId}>{actor.name}</option>)}</select></label>
          {!selectedActor ? <><label className={styles.field}><span>Presenter name</span><input value={name} maxLength={80} required onChange={event => setName(event.target.value)} placeholder="Your personal presenter" /></label>
          <div className={styles.mediaField}>
            <div className={styles.mediaHeading}><span>Portrait photo</span><span>{portraits.length} uploaded</span></div>
            <div className={styles.mediaGrid} role="group" aria-label="Choose a portrait from your uploads">
              {portraits.map(asset => <button key={asset.id} type="button" className={`${styles.mediaAsset} ${portrait === asset.id ? styles.mediaAssetSelected : ""}`} aria-pressed={portrait === asset.id} onClick={() => { setPortrait(asset.id); setRights(false); }}>
                {/* Private, authenticated customer assets cannot use the public image optimizer. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={asset.previewUrl} alt="" loading="lazy" onError={() => setBrokenPortraits(previous => new Set(previous).add(asset.id))} />
                <span>{asset.label || "Portrait"}</span>
              </button>)}
              <label className={styles.mediaUpload}>
                <input className={styles.mediaInput} type="file" accept="image/jpeg,image/png,image/webp" aria-label="Upload a portrait photo" onChange={event => { void uploadPortrait(event.target.files?.[0]); event.target.value = ""; }} />
                <span className={styles.mediaUploadIcon}><ImagePlus size={20} /></span><strong>Upload portrait</strong><small>JPG, PNG or WebP</small>
              </label>
            </div>
          </div>
          <div className={styles.mediaField}>
            <div className={styles.mediaHeading}><span>Voice recording</span><span>{recordings.length} uploaded</span></div>
            <div className={styles.audioGrid} role="group" aria-label="Choose a voice recording from your uploads">
              {recordings.map(asset => <button key={asset.id} type="button" className={`${styles.audioAsset} ${audio === asset.id ? styles.mediaAssetSelected : ""}`} aria-pressed={audio === asset.id} onClick={() => { setAudio(asset.id); setRights(false); }}>
                <AudioLines size={20} aria-hidden="true" /><span>{asset.label || "Voice recording"}</span><small>{asset.mimeType.replace(/^audio\//, "").toUpperCase()}</small>
              </button>)}
              <label className={styles.mediaUpload}>
                <input className={styles.mediaInput} type="file" accept="audio/mpeg,audio/wav,audio/x-wav,audio/mp4,audio/ogg,audio/webm,audio/aac,audio/flac" aria-label="Upload a voice recording" onChange={event => { void uploadAudio(event.target.files?.[0]); event.target.value = ""; }} />
                <span className={styles.mediaUploadIcon}><Upload size={20} /></span><strong>Upload recording</strong><small>MP3, WAV, M4A or similar</small>
              </label>
            </div>
            <p className={styles.help}><span>Use a clear recording of your own voice, up to 20 MB and 5 minutes. Files are checked on upload. Simulations do not read or train on the audio.</span></p>
          </div>
          <div className={styles.metadata}><label className={styles.field}><span>Voice profile</span><select value={gender} onChange={event => setGender(event.target.value)}><option value="female">Female</option><option value="male">Male</option></select></label><label className={styles.field}><span>Adult age range</span><select value={ageRange} onChange={event => setAgeRange(event.target.value)}>{["18-24", "25-34", "35-44", "45-54", "55-64", "65-74", "75-90"].map(value => <option key={value}>{value}</option>)}</select></label></div>
          <label className={styles.field}><span>Recording language</span><select value={language} onChange={event => setLanguage(event.target.value)}>{[["en", "English"], ["zh", "Chinese"], ["es", "Spanish"], ["pt", "Portuguese"], ["ja", "Japanese"], ["ko", "Korean"], ["th", "Thai"], ["vi", "Vietnamese"], ["id", "Indonesian"]].map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label></> : null}
          {selectedImage ? <div className={styles.preview}><img src={selectedImage} alt="Selected personal portrait" width={76} height={90} /><div><strong><span>{selectedActor?.name || name || "Your presenter"}</span></strong><p><span>Personal portrait · voice reference attached separately</span></p></div></div> : null}
          {selectedAudio ? <audio controls preload="none" src={selectedAudio} aria-label="Your voice reference" /> : null}
          {selectedActor && !selectedActor.voice.refAudio ? <p className={styles.help}><span>This presenter has no owned voice recording. Create a new presenter with a recording to continue.</span></p> : null}
          <label className={styles.check}><input type="checkbox" checked={rights} onChange={event => setRights(event.target.checked)} /><span>I am the adult shown and heard in these files, and I authorize use of my portrait and voice reference for this personal presenter. I can revoke this voice permission later.</span></label>
          <label className={styles.check}><input type="checkbox" checked={demo} onChange={event => setDemo(event.target.checked)} /><span>I understand this is a simulation. It will not train a voice, verify my identity, or create a talking video.</span></label>
          <button className={styles.primary} type="submit" disabled={!canCreate}><span>{busy ? "Saving…" : "Save & queue simulation"}</span></button>
          </fieldset>
        </form>
        <div className={styles.library}><div className={styles.sectionTitle}><span className={styles.step}>02</span><h2><span>My saved requests</span></h2><span className={styles.count}>{visibleJobs.length}</span></div>
          {!visibleJobs.length ? <div className={styles.empty}><span className={styles.emptyMark} aria-hidden="true">◎</span><h3><span>{loading ? "Loading your requests…" : "Your next on-screen self starts here"}</span></h3><p><span>Saved requests reappear when you return. Start with a personal portrait and your own voice recording.</span></p></div> : visibleJobs.map(job => {
            const actor = actors.find(item => item.actorId === job.actorId);
            const consent = consents.find(item => item.id === job.consentId);
            const active = activeTwinConsent(consent) && consent?.revision === job.consentRevision;
            return <article className={styles.card} key={job.id}><div className={styles.cardHead}>{actor?.imageUrl ? <img src={actor.imageUrl} alt="" width={52} height={62} loading="lazy" /> : <span className={styles.avatar} aria-hidden="true">◎</span>}<div><h3><span>{actor?.name || "Personal presenter request"}</span></h3><time dateTime={job.createdAt}><span>{new Date(job.createdAt).toLocaleDateString()}</span></time></div></div><p className={styles.status}><span>{twinStatus(job)}</span></p><p className={styles.help}><span>{consent?.status === "revoked" ? "Permission revoked. This request cannot be used for new generation." : job.capabilityState === "mock_only" ? "Simulation only. No cloned voice or video output is available." : "A completed request does not confirm that a voice is available for video generation."}</span></p>
            {job.status === "running" ? <progress aria-label="Voice request processing" /> : null}
            {job.status === "failed" ? <p className={styles.error}><span>{twinError(job.error ?? "request_failed")}</span></p> : null}
            <div className={styles.actions}>
              {job.status === "queued" && job.capabilityState === "mock_only" && active ? <button type="button" className={styles.button} disabled={busy || !loaded} onClick={() => void jobAction(job, "run-mock")}><span>Run simulation</span></button> : null}
              {["cancelled", "mock_complete"].includes(job.status) && job.capabilityState === "mock_only" && active ? <button type="button" className={styles.button} disabled={busy || !loaded} onClick={() => void retry(job)}><span>Retry simulation</span></button> : null}
              {job.status === "mock_complete" && job.capabilityState === "mock_only" && actor && active ? <button type="button" className={styles.button} disabled={busy || !loaded} onClick={() => void bind(job)}><span>Link simulation to presenter</span></button> : null}
              {job.status === "mock_complete" && actor && active && onUseActor ? <button type="button" className={styles.button} disabled={busy || !loaded} onClick={() => onUseActor(actor.actorId)}><span>Use portrait presenter</span></button> : null}
              {["queued", "running"].includes(job.status) ? <button type="button" className={styles.button} disabled={busy || !loaded} onClick={() => void jobAction(job, "cancel")}><span>Cancel request</span></button> : null}
              {consent && activeTwinConsent(consent) ? <button type="button" className={styles.button} disabled={busy || !loaded} onClick={() => void revoke(consent)}><span>Revoke permission</span></button> : null}
              <button type="button" className={styles.danger} disabled={busy || !loaded} onClick={() => void jobAction(job, "delete")}><span>Delete request</span></button>
              {actor && active && job.status === "succeeded" && job.capabilityState !== "mock_only" && capabilities?.voiceTwin?.available && actor.voice.voiceId && !actor.voice.voiceId.startsWith("mock:") && onUseActor ? <button type="button" className={styles.primary} onClick={() => onUseActor(actor.actorId)}><span>Use presenter</span></button> : null}
            </div></article>;
          })}
          {consents.filter(consent => activeTwinConsent(consent) && !jobs.some(job => job.consentId === consent.id)).map(consent => <article key={consent.id} className={styles.card}><h3><span>{actors.find(actor => actor.actorId === consent.actorId)?.name || "Saved permission"}</span></h3><p className={styles.help}><span>Permission saved without a visible request. You can queue a simulation or revoke permission.</span></p><div className={styles.actions}><button type="button" className={styles.button} disabled={busy || !loaded || capabilities?.voiceTwin?.state !== "mock_only"} onClick={() => void mutate(() => queue(consent))}><span>Queue simulation</span></button><button type="button" className={styles.button} disabled={busy || !loaded} onClick={() => void revoke(consent)}><span>Revoke permission</span></button></div></article>)}
          <p className={styles.help}><span>Deleting a request keeps original uploads, your presenter, and consent audit history. It does not delete a provider voice. No provider voice is created by a simulation.</span></p>
          {actors.length ? <section className={styles.profiles} aria-label="Personal presenters"><h2><span>Personal presenters</span></h2><p className={styles.help}><span>Portrait profiles with attached references. These profiles do not confirm identity or a trained voice.</span></p>{actors.map(actor => <div key={actor.actorId} className={styles.profileRow}><span>{actor.name}</span><button type="button" className={styles.danger} disabled={busy || !loaded} aria-label={`Delete personal presenter ${actor.name}`} onClick={() => void deletePresenter(actor)}><span>Delete presenter</span></button></div>)}</section> : null}
        </div>
      </div>
    </>}
  </section>;
}
