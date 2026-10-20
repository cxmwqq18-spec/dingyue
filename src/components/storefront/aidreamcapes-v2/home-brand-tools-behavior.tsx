"use client";

import { workspaceEntryTarget } from "@/lib/aidreamcapes-workspace/entry-transfer";
import { useEffect } from "react";

/** Reviewed presentation-only enhancement of page-owned SSR HTML. No data requests. */
export function HomeBrandToolsBehavior() {
  useEffect(() => {
    const root = document.querySelector<HTMLElement>("[data-home-brand-tools]");
    if (!root) return;
    const form = root.querySelector<HTMLFormElement>("[data-tools-form]");
    const prompt = form?.querySelector<HTMLTextAreaElement>('textarea[name="prompt"]');
    const mediaDialog = root.querySelector<HTMLDialogElement>("#adc-tools-media-dialog");
    const briefDialog = root.querySelector<HTMLDialogElement>("#adc-tools-brief-dialog");
    const previousFocus = new WeakMap<HTMLDialogElement, HTMLElement>();
    let timer: ReturnType<typeof setInterval> | undefined;
    const show = (dialog: HTMLDialogElement | null | undefined, control: HTMLElement) => {
      if (!dialog || dialog.open) return;
      previousFocus.set(dialog, control);
      dialog.showModal();
    };
    const stop = () => {
      if (timer) clearInterval(timer);
      timer = undefined;
      const button = root.querySelector<HTMLElement>("[data-tools-play-story]");
      button?.setAttribute("aria-pressed", "false");
      if (button?.dataset.playLabel) button.setAttribute("aria-label", button.dataset.playLabel);
      root.querySelector<HTMLElement>("[data-tools-storyboard]")?.removeAttribute("data-playing");
    };
    const selectShot = (id: string) => {
      const buttons = root.querySelectorAll<HTMLElement>("[data-tools-shot]");
      let label = "";
      buttons.forEach(button => {
        const selected = button.dataset.toolsShot === id;
        button.setAttribute("aria-pressed", String(selected));
        if (selected && button.dataset.toolsShotName) label = button.dataset.toolsShotName;
      });
      const current = root.querySelector<HTMLElement>("[data-tools-shot-label]");
      if (current) current.textContent = label;
      const preview = root.querySelector<HTMLElement>("[data-tools-active-shot]");
      if (preview) preview.dataset.toolsOpen = `shot-${id}`;
    };
    const preview = (id: string, control: HTMLElement, script?: string) => {
      root.querySelectorAll<HTMLElement>("[data-tools-media]").forEach(panel => { panel.hidden = panel.dataset.toolsMedia !== id; });
      const output = root.querySelector<HTMLElement>("[data-tools-script-output]");
      if (output) { output.hidden = !script; output.textContent = script ?? ""; }
      show(mediaDialog, control);
    };
    const click = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      const button = target?.closest<HTMLButtonElement>("button");
      if (button && root.contains(button)) {
        const openId = button.dataset.toolsOpen;
        if (openId) preview(openId, button);
        if (button.hasAttribute("data-tools-import")) {
          const container = button.closest<HTMLElement>("[data-imported]");
          const imported = container?.dataset.imported !== "true";
          if (container) container.dataset.imported = String(imported);
          button.setAttribute("aria-pressed", String(imported));
          container?.querySelectorAll<HTMLElement>("[data-tools-import-before]").forEach(el => { el.hidden = imported; });
          container?.querySelectorAll<HTMLElement>("[data-tools-import-after]").forEach(el => { el.hidden = !imported; });
        }
        if (button.dataset.toolsMode) {
          const mode = button.dataset.toolsMode;
          root.querySelectorAll<HTMLElement>("[data-tools-mode]").forEach(el => el.setAttribute("aria-pressed", String(el === button)));
          const view = form?.querySelector<HTMLInputElement>("[data-tools-view]");
          if (view) view.value = mode;
          const tool = form?.querySelector<HTMLInputElement>("[data-tools-tool]");
          if (tool) tool.value = mode === "images" ? "custom" : "video-ads";
          const imageTool = form?.querySelector<HTMLInputElement>("[data-tools-image-tool]");
          if (imageTool) imageTool.disabled = mode !== "images";
          const length = form?.querySelector<HTMLElement>("[data-tools-duration]");
          if (length) { length.hidden = mode === "images"; const select = length.querySelector("select"); if (select) select.disabled = mode === "images"; }
        }
        if (button.hasAttribute("data-tools-brief") && form && prompt && form.reportValidity()) {
          const output = root.querySelector<HTMLElement>("[data-tools-brief-output]");
          if (output) output.textContent = prompt.value;
          const link = root.querySelector<HTMLAnchorElement>("[data-tools-continue]");
          if (link) { const url = new URL(form.action); new FormData(form).forEach((value, key) => { if (typeof value === "string") url.searchParams.set(key, value); }); const target = workspaceEntryTarget(url.toString()); link.href = target.href; if (target.transfer) link.dataset.workspaceEntry = JSON.stringify(target.transfer); else delete link.dataset.workspaceEntry; }
          show(briefDialog, button);
        }
        if (button.dataset.toolsShot) { stop(); selectShot(button.dataset.toolsShot); }
        if (button.hasAttribute("data-tools-play-story")) {
          if (timer) stop();
          else {
            const shots = [...root.querySelectorAll<HTMLElement>(".adc-tools-shots [data-tools-shot]")];
            let index = Math.max(0, shots.findIndex(shot => shot.getAttribute("aria-pressed") === "true"));
            button.setAttribute("aria-pressed", "true");
            if (button.dataset.pauseLabel) button.setAttribute("aria-label", button.dataset.pauseLabel);
            root.querySelector<HTMLElement>("[data-tools-storyboard]")?.setAttribute("data-playing", "true");
            timer = setInterval(() => { index = (index + 1) % shots.length; const id = shots[index]?.dataset.toolsShot; if (id) selectShot(id); }, 1600);
          }
        }
        if (button.hasAttribute("data-tools-motion")) {
          const pressed = button.getAttribute("aria-pressed") !== "true";
          button.setAttribute("aria-pressed", String(pressed));
          button.closest(".adc-tools-phone,.adc-tools-result-frame")?.toggleAttribute("data-motion-playing", pressed);
          const label = pressed ? button.dataset.pauseLabel : button.dataset.playLabel;
          if (label) button.setAttribute("aria-label", label);
        }
        if (button.dataset.toolsActor) {
          root.querySelectorAll<HTMLElement>("[data-tools-actor]").forEach(el => el.setAttribute("aria-pressed", String(el === button)));
          const label = root.querySelector<HTMLElement>("span[data-tools-actor-label]");
          if (label) label.textContent = button.dataset.toolsActorLabel ?? "";
          const previewButton = root.querySelector<HTMLElement>("[data-tools-presenter-preview]");
          if (previewButton) previewButton.dataset.toolsSelectedActor = button.dataset.toolsActor;
        }
        if (button.hasAttribute("data-tools-presenter-preview")) preview(`actor-${button.dataset.toolsSelectedActor}`, button, root.querySelector<HTMLTextAreaElement>("#adc-tools-script")?.value);
      }
      if (target instanceof HTMLDialogElement && target.open) { const box = target.getBoundingClientRect(); if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) target.close(); }
      root.querySelectorAll<HTMLDetailsElement>("details[open]").forEach(detail => { if (target && !detail.contains(target)) detail.open = false; });
    };
    const input = (event: Event) => {
      const target = event.target;
      if (target === prompt) { const count = root.querySelector<HTMLElement>("[data-tools-count]"); if (count) count.textContent = String(prompt?.value.length ?? 0); }
      if (target instanceof HTMLInputElement && target.hasAttribute("data-tools-compare")) root.querySelector<HTMLElement>(".adc-tools-compare")?.style.setProperty("--compare", `${target.value}%`);
    };
    const close = (event: Event) => { if (event.target instanceof HTMLDialogElement) previousFocus.get(event.target)?.focus({ preventScroll: true }); };
    const visibility = () => { if (document.hidden) stop(); };
    const observer = new IntersectionObserver(entries => { if (!entries[0]?.isIntersecting) stop(); });
    const storyboard = root.querySelector<HTMLElement>("[data-tools-storyboard]");
    if (storyboard) observer.observe(storyboard);
    root.dataset.toolsReady = "true";
    root.addEventListener("click", click);
    root.addEventListener("input", input);
    root.addEventListener("close", close, true);
    document.addEventListener("visibilitychange", visibility);
    return () => { stop(); observer.disconnect(); root.removeEventListener("click", click); root.removeEventListener("input", input); root.removeEventListener("close", close, true); document.removeEventListener("visibilitychange", visibility); };
  }, []);
  return null;
}
