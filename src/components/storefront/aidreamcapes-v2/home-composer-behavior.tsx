"use client";

import { useEffect } from "react";

/** Presentation-only form controls. No uploads, fetches or generation on public pages. */
export function HomeComposerBehavior() {
  useEffect(() => {
    const form = document.querySelector<HTMLFormElement>("[data-home-composer]");
    if (!form) return;
    const prompt = form.querySelector<HTMLTextAreaElement>('textarea[name="prompt"]');
    const count = form.querySelector<HTMLOutputElement>("[data-demo-count]");
    const view = form.querySelector<HTMLInputElement>("[data-demo-view]");
    const tool = form.querySelector<HTMLInputElement>("[data-demo-tool]");
    const imageTool = form.querySelector<HTMLInputElement>("[data-demo-image-tool]");
    const duration = form.querySelector<HTMLElement>("[data-demo-duration]");
    const scene = form.querySelector<HTMLSelectElement>('select[name="scene"]');
    const updateCount = () => { if (count) count.textContent = String(prompt?.value.length ?? 0); };
    const onClick = (event: MouseEvent) => {
      const tab = event.target instanceof Element ? event.target.closest<HTMLElement>("[data-demo-tab]") : null;
      if (!tab || !view || !tool || !imageTool) return;
      const mode = tab.dataset.demoTab;
      if (mode !== "home" && mode !== "video" && mode !== "images") return;
      form.querySelectorAll<HTMLElement>("[data-demo-tab]").forEach(button => button.setAttribute("aria-pressed", String(button === tab)));
      view.value = mode;
      tool.value = mode === "images" ? "custom" : "video-ads";
      imageTool.disabled = mode !== "images";
      if (scene) scene.disabled = mode === "images";
      if (duration) {
        duration.hidden = mode === "images";
        const select = duration.querySelector("select");
        if (select) select.disabled = mode === "images";
      }
    };
    const onSubmit = () => {
      const product = form.querySelector<HTMLInputElement>("[data-demo-product]")?.value.trim();
      if (product && prompt && !prompt.value.includes(product)) {
        prompt.value = `${prompt.value.trim()}\n\n${product}`.slice(0, 2000);
        updateCount();
      }
    };
    const closeDetails = (event: MouseEvent) => {
      if (event.target instanceof Node) form.querySelectorAll<HTMLDetailsElement>("details[open]").forEach(detail => { if (!detail.contains(event.target as Node)) detail.open = false; });
    };
    const onEscape = (event: KeyboardEvent) => { if (event.key === "Escape") form.querySelectorAll<HTMLDetailsElement>("details[open]").forEach(detail => { detail.open = false; }); };
    form.dataset.demoReady = "true";
    form.addEventListener("click", onClick);
    form.addEventListener("input", updateCount);
    form.addEventListener("submit", onSubmit);
    document.addEventListener("click", closeDetails);
    document.addEventListener("keydown", onEscape);
    updateCount();
    return () => {
      form.removeEventListener("click", onClick);
      form.removeEventListener("input", updateCount);
      form.removeEventListener("submit", onSubmit);
      document.removeEventListener("click", closeDetails);
      document.removeEventListener("keydown", onEscape);
    };
  }, []);
  return null;
}
