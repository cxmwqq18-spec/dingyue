"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { adCloneClient, validatedAdAnalysis, type AdAnalysis, type AdAsset, type AdCapabilities, type AdJob, type AdSegment } from "./ad-clone-client";
import styles from "./ad-clone-workbench.module.css";

export type AdCloneWorkbenchProps = { siteId: string; customerId?: string; csrfToken?: string; loginHref: string; onOpenTask?: (taskId: string) => void };
const activeStates = ["queued", "running", "processing"];
function jobLabel(job: AdJob) {
  return ({ queued: "Queued", running: "Analyzing", processing: "Preparing video", mock_complete: "Simulation complete", succeeded: "Analysis ready", failed: "Analysis failed", cancelled: "Cancelled" } as Record<string, string>)[job.status] ?? "Status unavailable";
}
function privatePreview(url?: string) {
  return Boolean(url?.startsWith("/api/sites/site_aidreamcapes/") && !url.includes("\\"));
}
function validSegments(segments: AdSegment[]) {
  return segments.length > 0 && segments.every((s, i) => s.visual.trim() && Number.isFinite(s.start) && Number.isFinite(s.end) && s.start >= 0 && s.end > s.start && s.end <= 300 && (i === 0 || s.start >= segments[i - 1].end));
}

export function AdCloneWorkbench({ siteId, customerId, csrfToken, loginHref, onOpenTask }: AdCloneWorkbenchProps) {
  const id = useId();
  const request = useMemo(() => adCloneClient(siteId, csrfToken), [siteId, csrfToken]);
  const [capabilities, setCapabilities] = useState<AdCapabilities | null>(null);
  const [maxUploadBytes, setMaxUploadBytes] = useState(32 * 1024 * 1024);
  const [assets, setAssets] = useState<AdAsset[]>([]);
  const [jobs, setJobs] = useState<AdJob[]>([]);
  const [source, setSource] = useState("");
  const [rights, setRights] = useState(false);
  const [job, setJob] = useState<AdJob | null>(null);
  const [analysis, setAnalysis] = useState<AdAnalysis | null>(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [mode, setMode] = useState<"mp4" | "url">("mp4");
  const [product, setProduct] = useState({ url: "", title: "", description: "" });
  const [confirmed, setConfirmed] = useState(false);
  const [draft, setDraft] = useState<{ taskId: string; revision: number } | null>(null);
  const uploadAbort = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  const operation = useRef(false);
  const draftKey = useRef("");
  const confirmedAt = useRef("");
  const selectJob = useCallback((next: AdJob) => { setJob(next); setAnalysis(validatedAdAnalysis(next)); setDraft(null); setConfirmed(false); draftKey.current = ""; confirmedAt.current = ""; }, []);
  const load = useCallback(async (signal?: AbortSignal) => {
    const results = await Promise.allSettled([
      request<AdCapabilities>("", { signal }), request<{ jobs: AdJob[] }>("/jobs", { signal }), request<{ assets: AdAsset[]; limits?: { videoBytes?: number } }>("/assets", { signal }),
    ]);
    if (signal?.aborted || !mounted.current) return;
    const [cap, saved, media] = results;
    if (cap.status === "fulfilled") setCapabilities(cap.value);
    if (saved.status === "fulfilled") {
      const list = saved.value.jobs.filter(item => item.workflow === "ad_reference" && item.status !== "deleted");
      setJobs(list);
      setJob(current => { const next = list.find(item => item.id === current?.id); if (next) return next; return current; });
    }
    if (media.status === "fulfilled") {
      setAssets(media.value.assets.filter(item => item.mimeType === "video/mp4"));
      const limit = media.value.limits?.videoBytes;
      if (typeof limit === "number" && Number.isSafeInteger(limit) && limit > 0) setMaxUploadBytes(limit);
    }
    const failed = results.find(result => result.status === "rejected");
    if (failed?.status === "rejected") setError(failed.reason instanceof Error ? failed.reason.message : "Saved work could not be loaded.");
  }, [request]);
  useEffect(() => {
    mounted.current = true;
    setJob(null); setAnalysis(null); setDraft(null); setJobs([]); setAssets([]); setCapabilities(null); setSource(""); setRights(false); setConfirmed(false);
    if (!customerId || siteId !== "site_aidreamcapes") return;
    const controller = new AbortController();
    void load(controller.signal);
    return () => { mounted.current = false; controller.abort(); uploadAbort.current?.abort(); };
  }, [customerId, siteId, load]);
  const pollJobId = job?.id;
  const pollJobStatus = job?.status;
  useEffect(() => {
    if (!customerId || siteId !== "site_aidreamcapes" || !pollJobId || !pollJobStatus || !activeStates.includes(pollJobStatus)) return;
    const controller = new AbortController();
    const timer = setInterval(() => {
      if (document.visibilityState === "hidden") return;
      void request<{ job: AdJob }>(`/jobs/${encodeURIComponent(pollJobId)}`, { signal: controller.signal }).then(({ job: next }) => {
        if (controller.signal.aborted) return;
        setJob(next); setJobs(current => current.map(item => item.id === next.id ? next : item)); setAnalysis(validatedAdAnalysis(next));
      }).catch(e => { if (!controller.signal.aborted) setError(e.message); });
    }, 5000);
    return () => { clearInterval(timer); controller.abort(); };
  }, [pollJobId, pollJobStatus, request, customerId, siteId]);

  const linkedTaskId = job?.attachedTaskId ?? job?.taskId;
  useEffect(() => {
    if (!customerId || siteId !== "site_aidreamcapes" || !linkedTaskId) return;
    const controller = new AbortController();
    void request<{ task: { taskId: string; revision: number; productBrief?: { sourceUrl: string; title?: { value: string } | null; description?: { value: string } | null }; sourceAnalysis?: { analysisRevision: number; synthetic?: boolean; segments: AdSegment[] } } }>(`/api/sites/${encodeURIComponent(siteId)}/aivideosugc/tasks/${encodeURIComponent(linkedTaskId)}`, { absolute: true, signal: controller.signal }).then(({ task }) => {
      if (controller.signal.aborted) return;
      setDraft({ taskId: task.taskId, revision: task.revision });
      if (task.productBrief) setProduct({ url: task.productBrief.sourceUrl, title: task.productBrief.title?.value ?? "", description: task.productBrief.description?.value ?? "" });
      if (task.sourceAnalysis && validSegments(task.sourceAnalysis.segments)) setAnalysis({ revision: task.sourceAnalysis.analysisRevision, synthetic: task.sourceAnalysis.synthetic, segments: task.sourceAnalysis.segments });
    }).catch(e => { if (!controller.signal.aborted) setError(e.message); });
    return () => controller.abort();
  }, [linkedTaskId, request, siteId, customerId]);

  async function perform(label: string, work: () => Promise<void>) {
    if (operation.current || !customerId || siteId !== "site_aidreamcapes") return;
    operation.current = true; setBusy(label); setError(""); setNotice("");
    try { await work(); } catch (e) { if (!(e instanceof DOMException && e.name === "AbortError")) setError(e instanceof Error ? e.message : "That step could not be completed."); }
    finally { operation.current = false; if (mounted.current) setBusy(""); }
  }
  function storeJob(next: AdJob) {
    selectJob(next); setJobs(current => [next, ...current.filter(item => item.id !== next.id)]);
  }
  async function upload(file?: File) {
    if (!file) return;
    if (!/\.mp4$/i.test(file.name) || (file.type && file.type !== "video/mp4")) { setError("Choose an MP4 video file."); return; }
    if (file.size === 0 || file.size > (capabilities?.adUpload?.maxBytes ?? maxUploadBytes)) { setError("Choose a non-empty MP4 within the upload limit."); return; }
    await perform("Uploading and checking video…", async () => {
      const body = new FormData(); body.append("file", file); body.append("workflow", "ad_reference");
      const controller = new AbortController(); uploadAbort.current = controller;
      try {
        const { asset } = await request<{ asset: AdAsset }>("/assets", { method: "POST", body, signal: controller.signal });
        if (!asset?.id || asset.mimeType !== "video/mp4") throw new Error("The upload did not return a usable MP4. Please try another video.");
        setAssets(current => [asset, ...current.filter(item => item.id !== asset.id)]); setSource(asset.id); setRights(false); setNotice("Video uploaded. Confirm your permission before queuing.");
      } finally { uploadAbort.current = null; }
    });
  }
  async function queue() {
    await perform("Saving authorization and queuing…", async () => {
      if (!source || !rights) return;
      const { consent } = await request<{ consent: { id: string; revision: number } }>("/consents", { method: "POST", body: { workflow: "ad_reference", scope: "ad_reference", sourceAssetId: source, rightsConfirmed: true } });
      const { job: next } = await request<{ job: AdJob }>("/ad-references/queue", { method: "POST", key: crypto.randomUUID(), body: { consentId: consent.id, consentRevision: consent.revision, mockMode: true } });
      storeJob(next); setNotice("Simulation queued. No video analysis or generation has run.");
    });
  }
  async function jobAction(action: "run-mock" | "cancel" | "retry" | "delete") {
    if (!job) return;
    await perform(action === "delete" ? "Deleting saved analysis…" : "Updating analysis…", async () => {
      const path = `/jobs/${encodeURIComponent(job.id)}${action === "delete" ? "" : `/${action}`}`;
      const result = await request<{ job: AdJob }>(path, { method: action === "delete" ? "DELETE" : "POST", revision: job.revision, body: { revision: job.revision, mockMode: true, ...(action === "retry" ? { idempotencyKey: crypto.randomUUID() } : {}) } });
      if (action === "delete") { setJobs(current => current.filter(item => item.id !== job.id)); setJob(null); setAnalysis(null); setNotice("Saved analysis deleted."); }
      else { storeJob(result.job); setNotice(action === "run-mock" ? "Simulation complete. The timeline is an example, not an analysis of your video." : "Analysis updated."); }
    });
  }
  async function attach() {
    if (!job || !analysis || !confirmed || (linkedTaskId && !draft) || !validSegments(analysis.segments)) return;
    await perform("Saving your product draft…", async () => {
      const url = new URL(product.url);
      if (url.protocol !== "https:" || url.username || url.password || url.hash) throw new Error("Enter a public HTTPS page for your own product.");
      let target = draft;
      if (!target) {
        if (!draftKey.current) { draftKey.current = crypto.randomUUID(); confirmedAt.current = new Date().toISOString(); }
        const field = (value: string) => ({ value: value.trim(), sourceUrl: url.toString(), sourceLabel: "Provided by you", confidence: "high", confirmed: false });
        const { task } = await request<{ task: { taskId: string; revision: number } }>(`/api/sites/${encodeURIComponent(siteId)}/aivideosugc/tasks`, { absolute: true, method: "POST", key: draftKey.current, body: {
          sceneId: "process_demo", title: product.title.trim(), productBrief: { sourceUrl: url.toString(), fetchedPageUrl: url.toString(), title: field(product.title), description: field(product.description), possiblePrice: null, selectionConfirmed: true, priceConfirmed: false, reviewRequired: true, customerConfirmedAt: confirmedAt.current },
        } });
        target = task; setDraft(target);
      }
      const result = await request<{ task: { taskId: string; revision: number }; job?: AdJob }>(`/jobs/${encodeURIComponent(job.id)}/attach-draft`, { method: "POST", revision: job.revision, body: { revision: job.revision, taskId: target.taskId, taskRevision: target.revision, mockMode: analysis.synthetic === true, confirmedProductFacts: true, analysisRevision: analysis.revision, segments: analysis.segments } });
      if (!result.task?.taskId) throw new Error("The draft association could not be verified. Reload before trying again.");
      setDraft(result.task); setJob(current => current ? { ...current, attachedTaskId: result.task.taskId, ...(result.job ?? {}) } : current); setNotice("Draft saved with your confirmed product facts and a separate reference timeline. Continue editing before generation.");
    });
  }
  const selected = assets.find(asset => asset.id === source);
  const disabled = Boolean(busy);
  const mockOnly = capabilities?.adReference?.available !== true;
  const storageUnavailable = capabilities?.components?.database?.available === false || capabilities?.mockAvailable === false || capabilities?.analysisBeforeTask === false;
  if (siteId !== "site_aidreamcapes") return null;
  return <section className={styles.workbench} aria-labelledby={`${id}-heading`}>
    <header className={styles.heading}><div><span className={styles.eyebrow}>CREATIVE WORKSPACE / AD CLONE</span><h1 id={`${id}-heading`}>Start with a structure.<br />Make it your own.</h1><p>Review a reference timeline, then build a draft around your own product.</p></div><span className={styles.badge}>{mockOnly ? "Simulation only" : "Analysis available"}</span></header>
    {!customerId ? <div className={styles.guest}><h2>Your references stay in your workspace</h2><p>Sign in to upload your own MP4, manage permission, and save a draft.</p><a href={loginHref}><span>Sign in to continue</span></a></div> : <>
      <div className={styles.status} role="status" aria-live="polite"><span>{busy || notice || (storageUnavailable ? "Saved analyses need storage setup. Try again later." : mockOnly ? "Video analysis is not connected. You can test the workflow with an explicitly simulated timeline; no video is read and no credits are charged." : "Choose a reference video to begin.")}</span></div>
      {error ? <div className={styles.error} role="alert"><span>{error}</span><button type="button" disabled={disabled} onClick={() => void perform("Reloading saved analyses…", () => load())}><span>Try reload</span></button><a href={loginHref}><span>Sign in again</span></a></div> : null}
      <div className={styles.layout}><div className={styles.main}>
        <section className={styles.card}><div className={styles.sectionTitle}><span className={styles.number}>01</span><h2>Your reference</h2></div>
          <div className={styles.tabs} role="tablist" aria-label="Reference video source"><button role="tab" aria-selected={mode === "mp4"} onClick={() => setMode("mp4")}><span>Upload an MP4</span></button><button role="tab" aria-selected={mode === "url"} onClick={() => setMode("url")}><span>Video link (unavailable)</span></button></div>
          {mode === "url" ? <div className={styles.unavailable}><p className={styles.note}>Importing an ad video from a link is not supported here. This workspace does not fetch or parse video URLs. Upload an MP4 that you own or have permission to use as a reference.</p><p className={styles.note}>The product page URL in step 03 is a separate field for your product information. It does not import an ad video.</p><button type="button" className={styles.primary} onClick={() => setMode("mp4")}><span>Upload an MP4 instead</span></button></div> : <>
            <label className={styles.upload}><span>＋ Upload your MP4</span><small>Video files are checked before use · up to {Math.round((capabilities?.adUpload?.maxBytes ?? maxUploadBytes) / 1024 / 1024)} MB</small><input type="file" accept="video/mp4,.mp4" aria-label="Upload reference MP4" disabled={disabled || storageUnavailable || capabilities?.adUpload?.available === false} onChange={e => { void upload(e.target.files?.[0]); e.target.value = ""; }} /></label>
            {uploadAbort.current ? <button disabled={!busy} onClick={() => uploadAbort.current?.abort()}><span>Cancel upload</span></button> : null}
            <label className={styles.field}><span>Or select a saved video</span><select value={source} disabled={disabled} onChange={e => { setSource(e.target.value); setRights(false); }}><option value="">Choose your video</option>{assets.map(asset => <option key={asset.id} value={asset.id}>{asset.label || "Untitled video"}</option>)}</select></label>
            {selected ? <><p className={styles.note}><span>Selected: {selected.label}</span></p>{privatePreview(selected.previewUrl) ? <video className={styles.preview} controls preload="none" src={selected.previewUrl} aria-label="Your reference video" /> : null}</> : null}
            <label className={styles.check}><input type="checkbox" checked={rights} disabled={disabled} onChange={e => setRights(e.target.checked)} /><span>I own this video or have permission to use it as a reference.</span></label>
            <button className={styles.primary} disabled={disabled || !source || !rights || !capabilities || storageUnavailable} onClick={() => void queue()}><span>{mockOnly ? "Queue simulated analysis" : "Queue analysis"}</span></button>
          </>}
        </section>
        {job ? <section className={styles.card} aria-label="Selected analysis"><div className={styles.sectionTitle}><span className={styles.number}>02</span><h2>Review the structure</h2></div><div className={styles.actions}><span className={styles.badge}>{jobLabel(job)}</span>{job.status === "queued" && mockOnly ? <button disabled={disabled} onClick={() => void jobAction("run-mock")}><span>Run simulation</span></button> : null}{activeStates.includes(job.status) ? <button disabled={disabled} onClick={() => void jobAction("cancel")}><span>Cancel analysis</span></button> : null}{["failed", "cancelled"].includes(job.status) ? <button disabled={disabled} onClick={() => void jobAction("retry")}><span>Retry analysis</span></button> : null}<button disabled={disabled} onClick={() => void jobAction("delete")}><span>Delete saved analysis</span></button></div>
          {activeStates.includes(job.status) ? <p role="status">{job.status === "queued" ? "Waiting to start. You can cancel this job." : "Preparing your reference. Status updates automatically."}</p> : null}
          {job.status === "failed" ? <p className={styles.note}>The analysis could not finish. Retry or choose a different MP4.</p> : null}
          {analysis ? <><p className={styles.note}>{analysis.synthetic ? "Example timeline — no video was read. These sections are simulated and can be edited for a workflow test." : "Review and edit the structure below. Reference claims are not facts about your product."}</p><div className={styles.timeline}>{analysis.segments.map((segment, index) => <fieldset key={index} className={styles.segment} disabled={disabled}><legend><span>{segment.role === "cta" ? "CTA" : segment.role === "hook" ? "Hook" : "Body"}</span></legend><div className={styles.timing}><label><span>Start (seconds)</span><input type="number" min="0" max="300" step="0.1" value={segment.start} onChange={e => setAnalysis(current => current ? { ...current, segments: current.segments.map((s, i) => i === index ? { ...s, start: e.target.valueAsNumber } : s) } : current)} /></label><label><span>End (seconds)</span><input type="number" min="0" max="300" step="0.1" value={segment.end} onChange={e => setAnalysis(current => current ? { ...current, segments: current.segments.map((s, i) => i === index ? { ...s, end: e.target.valueAsNumber } : s) } : current)} /></label></div><label className={styles.field}><span>{segment.role === "cta" ? "CTA" : segment.role === "hook" ? "Hook" : "Body"} direction</span><textarea maxLength={2000} value={segment.visual} onChange={e => setAnalysis(current => current ? { ...current, segments: current.segments.map((s, i) => i === index ? { ...s, visual: e.target.value } : s) } : current)} /></label></fieldset>)}</div>{!validSegments(analysis.segments) ? <p role="alert">Use non-overlapping times between 0 and 300 seconds, with an end after each start and a direction for every section.</p> : null}</> : !activeStates.includes(job.status) ? <p className={styles.note}>No verified timeline is available for this job. A simulated completion does not contain a real video analysis.</p> : null}
        </section> : null}
        {analysis ? <section className={styles.card}><div className={styles.sectionTitle}><span className={styles.number}>03</span><h2>Your product, your facts</h2></div><p className={styles.note}>Enter information about the product you want to advertise. These facts are saved separately from the reference structure. The product page URL identifies your product; it does not import or analyze a reference video.</p>{([['url', 'Your product page URL (HTTPS)', 2048], ['title', 'Product name', 180], ['description', 'Confirmed product facts', 2000]] as const).map(([key, label, max]) => <label key={key} className={styles.field}><span>{label}</span>{key === "description" ? <textarea maxLength={max} disabled={disabled || Boolean(draft)} value={product[key]} onChange={e => { setProduct(p => ({ ...p, [key]: e.target.value })); setConfirmed(false); }} /> : <input type={key === "url" ? "url" : "text"} maxLength={max} disabled={disabled || Boolean(draft)} value={product[key]} onChange={e => { setProduct(p => ({ ...p, [key]: e.target.value })); setConfirmed(false); }} />}</label>)}<label className={styles.check}><input type="checkbox" checked={confirmed} disabled={disabled} onChange={e => setConfirmed(e.target.checked)} /><span>I have reviewed these product facts and confirm they describe my product.</span></label><div className={styles.actions}><button className={styles.primary} disabled={disabled || Boolean(linkedTaskId && !draft) || !confirmed || !product.url || !product.title.trim() || !product.description.trim() || !validSegments(analysis.segments)} onClick={() => void attach()}><span>{draft && !linkedTaskId ? "Retry draft association" : "Save structure to product draft"}</span></button>{(linkedTaskId || draft) && onOpenTask ? <button disabled={disabled} onClick={() => onOpenTask(linkedTaskId || draft!.taskId)}><span>Open product draft</span></button> : null}</div></section> : null}
      </div><aside className={styles.library}><div className={styles.libraryHeading}><h2>Saved analyses</h2><button disabled={disabled} onClick={() => void perform("Reloading saved analyses…", () => load())}><span>Reload</span></button></div>{jobs.length ? <div className={styles.savedList}>{jobs.map(item => <button key={item.id} className={job?.id === item.id ? styles.selectedJob : styles.savedJob} disabled={disabled} onClick={() => { selectJob(item); setError(""); setNotice(""); }}><span>{assets.find(asset => asset.id === item.sourceAssetId)?.label || "Reference video"}</span><small>{jobLabel(item)}</small>{(item.attachedTaskId ?? item.taskId) ? <small>Linked to product draft</small> : null}</button>)}</div> : <div className={styles.empty}><span>No saved analyses yet</span><p>Your reference jobs will appear here after you queue one.</p></div>}<p className={styles.privacy}>Only your workspace references are shown. Deleting an analysis does not delete its source video.</p></aside></div>
    </>}
  </section>;
}
