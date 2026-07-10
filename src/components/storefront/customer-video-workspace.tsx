"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, CheckCircle2, Film, GripVertical, ImagePlus, Play, Trash2, Upload } from "lucide-react";
import { csrfHeader, customerJsonHeaders } from "@/lib/client-csrf";
import type { PublicCustomer, ThemeRuntimeAsset, VideoTheme, VideoThemeCategory } from "@/lib/types";

type SubscriptionStatus = "loading" | "active" | "required" | "admin";
type LocalFrameAsset = ThemeRuntimeAsset & { localStatus?: "uploading" | "failed" | "ready" };

function vt(spanish: boolean, english: string, spanishText: string) {
  return spanish ? spanishText : english;
}

function uploadLabelFor(file: File, index: number) {
  return file.name.replace(/\.[^.]+$/, "") || `video frame ${index + 1}`;
}

function errorText(error: string | undefined, status: number, spanish: boolean) {
  if (error === "subscription_required") return vt(spanish, "Choose a subscription before generating video.", "Elige una suscripcion antes de generar video.");
  if (error === "insufficient_credits") return vt(spanish, "Not enough credits for this video theme.", "No hay creditos suficientes para este tema de video.");
  if (error === "video_theme_required") return vt(spanish, "Choose a video theme before generating.", "Elige un tema de video antes de generar.");
  if (error === "video_frames_required") return vt(spanish, "Select at least one frame image.", "Selecciona al menos una imagen de fotograma.");
  if (error === "too_many_video_frames") return vt(spanish, "This theme allows fewer frame images.", "Este tema permite menos imagenes de fotograma.");
  if (status === 409) return vt(spanish, "Another request is already running. Check the All tab before starting a new one.", "Ya hay otra solicitud en ejecucion. Revisa la pestana Todo antes de iniciar otra.");
  return vt(spanish, "Video generation could not start. Please check the frame images and try again.", "No se pudo iniciar el video. Revisa las imagenes e intentalo de nuevo.");
}

export function CustomerVideoWorkspace({
  assets,
  customer,
  onJobCreated,
  siteId,
  spanish = false,
  subscriptionStatus
}: {
  assets: ThemeRuntimeAsset[];
  customer: PublicCustomer;
  siteId: string;
  subscriptionStatus: SubscriptionStatus;
  spanish?: boolean;
  onJobCreated: (jobId: string) => void;
}) {
  const [categories, setCategories] = useState<VideoThemeCategory[]>([]);
  const [themes, setThemes] = useState<VideoTheme[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedThemeId, setSelectedThemeId] = useState("");
  const [frameAssets, setFrameAssets] = useState<LocalFrameAsset[]>(() => assets.filter((asset) => asset.mimeType.startsWith("image/")));
  const [selectedFrameIds, setSelectedFrameIds] = useState<string[]>([]);
  const [draggedFrameId, setDraggedFrameId] = useState<string | null>(null);
  const [promptNote, setPromptNote] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const uploadInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setFrameAssets((current) => {
      const next = new Map(current.map((asset) => [asset.id, asset]));
      assets.filter((asset) => asset.mimeType.startsWith("image/")).forEach((asset) => next.set(asset.id, asset));
      return Array.from(next.values()).sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
    });
  }, [assets]);

  useEffect(() => {
    const controller = new AbortController();
    async function loadThemes() {
      try {
        const [categoryResponse, themeResponse] = await Promise.all([
          fetch(`/api/sites/${siteId}/video-theme-categories`, { cache: "no-store", signal: controller.signal }),
          fetch(`/api/sites/${siteId}/video-themes`, { cache: "no-store", signal: controller.signal })
        ]);
        const categoryPayload = (await categoryResponse.json().catch(() => ({}))) as { categories?: VideoThemeCategory[] };
        const themePayload = (await themeResponse.json().catch(() => ({}))) as { themes?: VideoTheme[] };
        if (!categoryResponse.ok || !themeResponse.ok) throw new Error("video_themes_unavailable");
        setCategories(categoryPayload.categories ?? []);
        setThemes(themePayload.themes ?? []);
        setSelectedThemeId((current) => current || themePayload.themes?.[0]?.id || "");
      } catch {
        if (!controller.signal.aborted) {
          setMessage(vt(spanish, "Video themes could not load. Refresh this page and try again.", "No se pudieron cargar los temas de video. Actualiza la pagina e intentalo de nuevo."));
        }
      }
    }
    void loadThemes();
    return () => controller.abort();
  }, [siteId, spanish]);

  const selectedTheme = themes.find((theme) => theme.id === selectedThemeId);
  const maxFrames = Math.min(4, Math.max(1, selectedTheme?.maxFrames ?? 4));
  const visibleThemes = selectedCategory === "all"
    ? themes
    : themes.filter((theme) => theme.category?.slug === selectedCategory);
  const availableFrames = frameAssets.filter((asset) => asset.localStatus !== "failed");
  const selectedFrames = selectedFrameIds
    .map((assetId) => availableFrames.find((asset) => asset.id === assetId))
    .filter((asset): asset is LocalFrameAsset => Boolean(asset));

  useEffect(() => {
    if (selectedFrameIds.length > maxFrames) setSelectedFrameIds((current) => current.slice(0, maxFrames));
  }, [maxFrames, selectedFrameIds.length]);

  function toggleFrame(asset: LocalFrameAsset) {
    if (asset.localStatus === "uploading") return;
    setSelectedFrameIds((current) => {
      if (current.includes(asset.id)) return current.filter((id) => id !== asset.id);
      if (current.length >= maxFrames) {
        setMessage(vt(spanish, `This theme supports up to ${maxFrames} frame images.`, `Este tema permite hasta ${maxFrames} imagenes de fotograma.`));
        return current;
      }
      return [...current, asset.id];
    });
  }

  function moveFrame(assetId: string, direction: -1 | 1) {
    setSelectedFrameIds((current) => {
      const index = current.indexOf(assetId);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= current.length) return current;
      const next = [...current];
      [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
      return next;
    });
  }

  function dropFrame(targetId: string) {
    if (!draggedFrameId || draggedFrameId === targetId) return;
    setSelectedFrameIds((current) => {
      const sourceIndex = current.indexOf(draggedFrameId);
      const targetIndex = current.indexOf(targetId);
      if (sourceIndex < 0 || targetIndex < 0) return current;
      const next = [...current];
      const [item] = next.splice(sourceIndex, 1);
      next.splice(targetIndex, 0, item);
      return next;
    });
    setDraggedFrameId(null);
  }

  async function uploadFrameFiles(files: FileList | null) {
    const imageFiles = Array.from(files ?? []).filter((file) => file.type.startsWith("image/"));
    if (!imageFiles.length) {
      setMessage(vt(spanish, "Choose one or more image files before uploading.", "Elige una o mas imagenes antes de subir."));
      return;
    }
    setUploading(true);
    setMessage(vt(spanish, `Uploading ${imageFiles.length} frame image${imageFiles.length === 1 ? "" : "s"}...`, `Subiendo ${imageFiles.length} imagen${imageFiles.length === 1 ? "" : "es"} de fotograma...`));
    const createdAssets: ThemeRuntimeAsset[] = [];
    for (const [index, file] of imageFiles.entries()) {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("label", uploadLabelFor(file, index));
      formData.append("role", "input");
      formData.append("subjectRole", "reference");
      const response = await fetch(`/api/sites/${siteId}/customers/${customer.id}/assets`, {
        method: "POST",
        headers: csrfHeader(`customer_csrf_${siteId}`),
        body: formData
      });
      const result = (await response.json().catch(() => ({}))) as { asset?: ThemeRuntimeAsset; error?: string };
      if (!response.ok || !result.asset) {
        setUploading(false);
        setMessage(vt(spanish, `We could not upload ${file.name}. Please try again.`, `No pudimos subir ${file.name}. Intentalo de nuevo.`));
        return;
      }
      createdAssets.push(result.asset);
    }
    setFrameAssets((current) => [...createdAssets, ...current.filter((asset) => !createdAssets.some((created) => created.id === asset.id))]);
    setSelectedFrameIds((current) => Array.from(new Set([...current, ...createdAssets.map((asset) => asset.id)])).slice(0, maxFrames));
    setMessage(vt(spanish, `${createdAssets.length} frame image${createdAssets.length === 1 ? "" : "s"} uploaded.`, `${createdAssets.length} imagen${createdAssets.length === 1 ? "" : "es"} subida${createdAssets.length === 1 ? "" : "s"}.`));
    setUploading(false);
    window.dispatchEvent(new CustomEvent("customer-assets:updated"));
  }

  async function deleteFrame(asset: LocalFrameAsset) {
    const confirmed = window.confirm(vt(spanish, `Delete "${asset.label}" from your private frame images?`, `Eliminar "${asset.label}" de tus imagenes privadas?`));
    if (!confirmed) return;
    setFrameAssets((current) => current.filter((item) => item.id !== asset.id));
    setSelectedFrameIds((current) => current.filter((id) => id !== asset.id));
    const response = await fetch(`/api/sites/${siteId}/customers/${customer.id}/assets/${asset.id}`, {
      method: "DELETE",
      headers: csrfHeader(`customer_csrf_${siteId}`)
    });
    if (!response.ok) {
      setMessage(vt(spanish, "We could not delete that frame image. Refresh and try again.", "No pudimos eliminar esa imagen. Actualiza e intentalo de nuevo."));
      window.dispatchEvent(new CustomEvent("customer-assets:updated"));
      return;
    }
    setMessage(vt(spanish, "Frame image deleted.", "Imagen eliminada."));
    window.dispatchEvent(new CustomEvent("customer-assets:updated"));
  }

  async function generateVideo() {
    if (pending) return;
    if (subscriptionStatus === "loading") {
      setMessage(vt(spanish, "We are still checking your subscription. Try again in a moment.", "Aun estamos revisando tu suscripcion. Intentalo en un momento."));
      return;
    }
    if (subscriptionStatus === "required") {
      setMessage(vt(spanish, "Choose a subscription before generating video.", "Elige una suscripcion antes de generar video."));
      return;
    }
    if (!selectedTheme) {
      setMessage(vt(spanish, "Choose a video theme before generating.", "Elige un tema de video antes de generar."));
      return;
    }
    if (!selectedFrameIds.length) {
      setMessage(vt(spanish, "Select at least one frame image.", "Selecciona al menos una imagen de fotograma."));
      return;
    }
    if (selectedTheme.creditCost > customer.balance.available && subscriptionStatus !== "admin") {
      setMessage(vt(spanish, `This theme needs ${selectedTheme.creditCost} credits, but ${customer.balance.available} are available.`, `Este tema necesita ${selectedTheme.creditCost} creditos, pero hay ${customer.balance.available} disponibles.`));
      return;
    }
    setPending(true);
    setMessage(vt(spanish, "Creating your video request and reserving credits...", "Creando tu solicitud de video y reservando creditos..."));
    const response = await fetch(`/api/sites/${siteId}/ai/jobs`, {
      method: "POST",
      headers: customerJsonHeaders(siteId),
      body: JSON.stringify({
        customerId: customer.id,
        aiAppSlug: "video_generator",
        params: {
          mode: "video",
          outputType: "video",
          videoThemeId: selectedTheme.id,
          assetIds: selectedFrameIds,
          fields: {
            mode: "video",
            outputType: "video",
            videoThemeId: selectedTheme.id,
            videoThemeName: selectedTheme.name,
            videoThemePrompt: selectedTheme.prompt,
            frameAssetIds: selectedFrameIds,
            duration: String(selectedTheme.durationSeconds),
            promptNote: promptNote.trim()
          }
        }
      })
    });
    const result = (await response.json().catch(() => ({}))) as { job?: { id: string }; error?: string };
    setPending(false);
    if (!response.ok || !result.job) {
      setMessage(errorText(result.error, response.status, spanish));
      return;
    }
    window.dispatchEvent(new CustomEvent("customer-assets:updated"));
    onJobCreated(result.job.id);
  }

  return (
    <section className="scroll-mt-28 overflow-hidden rounded-[22px] border border-white/10 bg-[#0c0f16] shadow-[0_28px_90px_-60px_rgba(0,0,0,0.92)]" id="step-video">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 px-5 py-4">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-[14px] bg-[#182435] text-[#31d4ff]">
            <Film className="h-5 w-5" strokeWidth={1.8} />
          </span>
          <div>
            <h2 className="text-base font-semibold">{vt(spanish, "Create an image-to-video clip", "Crear un clip de imagen a video")}</h2>
            <p className="mt-1 text-xs text-white/50">{vt(spanish, "Choose ordered frame images, select a video theme, then generate one private MP4.", "Elige fotogramas ordenados, selecciona un tema y genera un MP4 privado.")}</p>
          </div>
        </div>
        <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-white/58">
          {customer.balance.available} {vt(spanish, "credits", "creditos")}
        </span>
      </div>

      <div className="grid gap-5 p-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] xl:p-5">
        <div className="grid gap-4">
          <div className="rounded-[18px] border border-white/10 bg-black/18 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#31d4ff]">{vt(spanish, "Step 01", "Paso 01")}</p>
                <h3 className="mt-2 text-lg font-semibold">{vt(spanish, "Select frame images", "Seleccionar fotogramas")}</h3>
                <p className="mt-2 max-w-xl text-sm leading-6 text-white/58">
                  {vt(spanish, `Use 1-${maxFrames} images. Drag selected frames to control the visual order.`, `Usa 1-${maxFrames} imagenes. Arrastra los fotogramas seleccionados para ordenar.`)}
                </p>
              </div>
              <button
                className="inline-flex min-h-10 items-center gap-2 rounded-[10px] border border-white/14 bg-white/[0.06] px-4 text-sm font-semibold text-white transition hover:bg-white/[0.1] disabled:cursor-wait disabled:opacity-55"
                disabled={uploading}
                onClick={() => uploadInputRef.current?.click()}
                type="button"
              >
                <Upload className="h-4 w-4" strokeWidth={1.8} />
                {uploading ? vt(spanish, "Uploading", "Subiendo") : vt(spanish, "Upload", "Subir")}
              </button>
              <input
                accept="image/*"
                className="sr-only"
                multiple
                onChange={(event) => {
                  void uploadFrameFiles(event.target.files);
                  event.target.value = "";
                }}
                ref={uploadInputRef}
                type="file"
              />
            </div>

            <div className="mt-4 grid gap-3">
              {selectedFrames.length ? (
                selectedFrames.map((asset, index) => (
                  <div
                    className="grid grid-cols-[88px_minmax(0,1fr)_auto] items-center gap-3 rounded-[12px] border border-white/12 bg-white/[0.035] p-2"
                    draggable
                    key={asset.id}
                    onDragEnd={() => setDraggedFrameId(null)}
                    onDragOver={(event) => event.preventDefault()}
                    onDragStart={() => setDraggedFrameId(asset.id)}
                    onDrop={() => dropFrame(asset.id)}
                  >
                    <div className="relative aspect-[4/3] overflow-hidden rounded-[8px] bg-white/[0.06]">
                      <img alt="" className="h-full w-full object-cover" src={asset.previewUrl} />
                      <span className="absolute left-1.5 top-1.5 rounded-full bg-[#31d4ff] px-2 py-0.5 text-[10px] font-bold text-[#041014]">
                        {index + 1}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-white">{asset.label}</p>
                      <p className="mt-1 truncate text-xs text-white/42">{vt(spanish, "Frame order", "Orden")} {index + 1}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <GripVertical className="h-4 w-4 text-white/34" strokeWidth={1.8} />
                      <button className="grid h-8 w-8 place-items-center rounded-[8px] border border-white/10 text-white/64 hover:bg-white/[0.08] hover:text-white" onClick={() => moveFrame(asset.id, -1)} type="button"><ArrowUp className="h-4 w-4" /></button>
                      <button className="grid h-8 w-8 place-items-center rounded-[8px] border border-white/10 text-white/64 hover:bg-white/[0.08] hover:text-white" onClick={() => moveFrame(asset.id, 1)} type="button"><ArrowDown className="h-4 w-4" /></button>
                    </div>
                  </div>
                ))
              ) : (
                <button
                  className="grid min-h-[132px] place-items-center rounded-[14px] border border-dashed border-white/18 bg-black/16 px-5 text-center text-sm leading-6 text-white/54 transition hover:border-[#31d4ff]/55 hover:text-white"
                  onClick={() => uploadInputRef.current?.click()}
                  type="button"
                >
                  <span className="grid gap-2 justify-items-center">
                    <ImagePlus className="h-6 w-6" strokeWidth={1.8} />
                    {vt(spanish, "Upload images or choose existing images below.", "Sube imagenes o elige imagenes existentes abajo.")}
                  </span>
                </button>
              )}
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-2 2xl:grid-cols-3">
              {availableFrames.slice(0, 18).map((asset) => {
                const selected = selectedFrameIds.includes(asset.id);
                return (
                  <div className={`group relative overflow-hidden rounded-[12px] border bg-black/20 transition ${selected ? "border-[#31d4ff] ring-2 ring-[#31d4ff]/30" : "border-white/10 hover:border-white/25"}`} key={asset.id}>
                    <button className="block w-full text-left" onClick={() => toggleFrame(asset)} type="button">
                      <span className="relative block aspect-square overflow-hidden">
                        <img alt="" className="h-full w-full object-cover" src={asset.previewUrl} />
                        <span className={`absolute left-2 top-2 grid h-6 w-6 place-items-center rounded-full border ${selected ? "border-[#31d4ff] bg-[#31d4ff] text-[#041014]" : "border-white/45 bg-black/58 text-white/60"}`}>
                          {selected ? <CheckCircle2 className="h-4 w-4" strokeWidth={2.2} /> : null}
                        </span>
                      </span>
                      <span className="block truncate px-2 py-2 text-xs font-semibold text-white/76">{asset.label}</span>
                    </button>
                    <button
                      aria-label={`Delete ${asset.label}`}
                      className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full border border-white/15 bg-black/58 text-white/70 opacity-0 transition hover:bg-rose-500/24 hover:text-rose-50 group-hover:opacity-100"
                      onClick={() => void deleteFrame(asset)}
                      type="button"
                    >
                      <Trash2 className="h-3.5 w-3.5" strokeWidth={1.9} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="grid content-start gap-4">
          <div className="rounded-[18px] border border-white/10 bg-black/18 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#31d4ff]">{vt(spanish, "Step 02", "Paso 02")}</p>
            <h3 className="mt-2 text-lg font-semibold">{vt(spanish, "Choose a video theme", "Elegir tema de video")}</h3>
            <div className="mt-4 flex flex-wrap gap-2">
              <button className={`rounded-full px-3 py-1.5 text-xs font-semibold ${selectedCategory === "all" ? "bg-white text-[#101114]" : "border border-white/12 bg-white/[0.04] text-white/62"}`} onClick={() => setSelectedCategory("all")} type="button">
                {vt(spanish, "All themes", "Todos")}
              </button>
              {categories.map((category) => (
                <button className={`rounded-full px-3 py-1.5 text-xs font-semibold ${selectedCategory === category.slug ? "bg-white text-[#101114]" : "border border-white/12 bg-white/[0.04] text-white/62"}`} key={category.id} onClick={() => setSelectedCategory(category.slug)} type="button">
                  {category.label}
                </button>
              ))}
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {visibleThemes.map((theme) => {
                const selected = theme.id === selectedThemeId;
                return (
                  <button className={`overflow-hidden rounded-[14px] border text-left transition ${selected ? "border-[#31d4ff] bg-[#31d4ff]/8 ring-2 ring-[#31d4ff]/22" : "border-white/10 bg-white/[0.035] hover:border-white/24"}`} key={theme.id} onClick={() => setSelectedThemeId(theme.id)} type="button">
                    <span className="block aspect-[16/9] bg-white/[0.06]">
                      {theme.imageUrl ? <img alt="" className="h-full w-full object-cover" src={theme.imageUrl} /> : null}
                    </span>
                    <span className="block p-3">
                      <span className="block truncate text-sm font-semibold text-white">{theme.name}</span>
                      <span className="mt-1 line-clamp-2 block min-h-10 text-xs leading-5 text-white/52">{theme.description}</span>
                      <span className="mt-3 flex flex-wrap gap-2">
                        <span className="rounded-full bg-white/[0.08] px-2.5 py-1 text-[11px] font-semibold text-white/70">{theme.creditCost} {vt(spanish, "credits", "creditos")}</span>
                        <span className="rounded-full bg-white/[0.08] px-2.5 py-1 text-[11px] font-semibold text-white/70">{theme.durationSeconds}s</span>
                        <span className="rounded-full bg-white/[0.08] px-2.5 py-1 text-[11px] font-semibold text-white/70">{vt(spanish, "Max", "Max")} {theme.maxFrames}</span>
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-[18px] border border-white/10 bg-black/18 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#31d4ff]">{vt(spanish, "Step 03", "Paso 03")}</p>
            <h3 className="mt-2 text-lg font-semibold">{vt(spanish, "Confirm video", "Confirmar video")}</h3>
            <div className="mt-3 grid gap-2 text-sm leading-6 text-white/62">
              <p>{vt(spanish, "Theme", "Tema")}: <span className="font-semibold text-white">{selectedTheme?.name ?? vt(spanish, "None selected", "Sin seleccionar")}</span></p>
              <p>{vt(spanish, "Frame images", "Fotogramas")}: <span className="font-semibold text-white">{selectedFrameIds.length}/{maxFrames}</span></p>
              <p>{vt(spanish, "Credit cost", "Costo")}: <span className="font-semibold text-white">{selectedTheme?.creditCost ?? 0}</span></p>
            </div>
            <label className="mt-4 block">
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-white/44">{vt(spanish, "Optional direction", "Direccion opcional")}</span>
              <textarea
                className="mt-2 min-h-[92px] w-full resize-y rounded-[12px] border border-white/10 bg-black/30 px-3 py-3 text-sm leading-6 text-white outline-none transition placeholder:text-white/28 focus:border-[#31d4ff]/70"
                maxLength={600}
                onChange={(event) => setPromptNote(event.target.value)}
                placeholder={vt(spanish, "Add a motion note, mood, or camera direction.", "Anade movimiento, ambiente o direccion de camara.")}
                value={promptNote}
              />
            </label>
            {selectedTheme ? (
              <p className="mt-3 line-clamp-3 text-xs leading-5 text-white/42">{selectedTheme.prompt}</p>
            ) : null}
            <button
              className="mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-[12px] bg-[#2f6fed] px-5 text-sm font-semibold text-white transition hover:bg-[#4380ff] disabled:cursor-not-allowed disabled:opacity-50"
              disabled={pending || uploading || !selectedTheme || !selectedFrameIds.length}
              onClick={() => void generateVideo()}
              type="button"
            >
              <Play className="h-4 w-4" strokeWidth={1.8} />
              {pending ? vt(spanish, "Starting video", "Iniciando video") : vt(spanish, "Generate video", "Generar video")}
            </button>
            <p className="mt-3 min-h-5 text-xs leading-5 text-white/52" role="status">{message}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
