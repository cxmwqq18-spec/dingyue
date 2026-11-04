"use client";

import { workspaceEntryTarget } from "@/lib/aidreamcapes-workspace/entry-transfer";
import { gateDeferredPosters, showDeferredPoster } from "./deferred-poster";
import { requestDecorationPlay, releaseDecorationSlot } from "./preview-budget";
import { useEffect } from "react";

/** Presentation-only controls over HTML already rendered by the server. */
export function HomeExperienceBehavior() {
  useEffect(() => {
    const focusBeforeDialog = new WeakMap<HTMLDialogElement, HTMLElement>();
    gateDeferredPosters(document);
    const select = (root: HTMLElement, group: string, value: string) => {
      root.querySelectorAll<HTMLElement>("[data-hx-select-group]").forEach((control) => {
        if (control.dataset.hxSelectGroup !== group) return;
        const selected = control.dataset.hxSelectValue === value;
        control.setAttribute("aria-pressed", String(selected));
        control.classList.toggle("is-selected", selected);
        control.classList.toggle("is-active", selected);
      });
      root.querySelectorAll<HTMLElement>("[data-hx-panel-group]").forEach((panel) => {
        if (panel.dataset.hxPanelGroup === group) panel.hidden = panel.dataset.hxPanelValue !== value;
      });
      // Autoplaying previews follow the visible panel; hidden ones stop and rewind.
      root.querySelectorAll<HTMLVideoElement>("video[data-hx-preview]").forEach((video) => {
        const panel = video.closest<HTMLElement>("[data-hx-panel-group]");
        if (!panel || panel.hidden) { video.pause(); video.currentTime = 0; return; }
        if (video.preload === "none") { video.preload = "auto"; video.load(); }
        video.play().catch(() => { /* autoplay refused; the poster stays */ });
      });
    };
    const handleClick = (event: MouseEvent) => {
      if (!(event.target instanceof Element)) return;
      const root = event.target.closest<HTMLElement>("[data-hx-root]");
      if (!root) return;
      const control = event.target.closest<HTMLElement>("button,[data-hx-close]");
      if (control && root.contains(control)) {
        const group = control.dataset.hxSelectGroup;
        const value = control.dataset.hxSelectValue;
        if (group && value) select(root, group, value);
        const destination = control.dataset.hxCtaHref;
        if (destination) root.querySelectorAll<HTMLAnchorElement>("a[data-home-cta]").forEach((cta) => { const target = workspaceEntryTarget(destination); cta.setAttribute("href", target.href); if (target.transfer) cta.dataset.workspaceEntry = JSON.stringify(target.transfer); else delete cta.dataset.workspaceEntry; });
        const filter = control.dataset.hxFilter;
        if (filter) {
          root.querySelectorAll<HTMLElement>("[data-hx-filter]").forEach((button) => {
            const selected = button.dataset.hxFilter === filter;
            button.setAttribute("aria-pressed", String(selected));
            button.classList.toggle("is-selected", selected);
          });
          const cards = [...root.querySelectorAll<HTMLElement>("[data-hx-filter-tags]")];
          cards.forEach((card) => { card.hidden = filter !== "all" && !(card.dataset.hxFilterTags ?? "").split(/\s+/).includes(filter); });
          const visibleCards = cards.filter((card) => !card.hidden);
          root.querySelectorAll<HTMLElement>("[data-hx-empty]").forEach((empty) => { empty.hidden = visibleCards.length > 0; });
          const current = cards.find((card) => card.getAttribute("aria-pressed") === "true");
          const first = visibleCards[0];
          if (current?.hidden && first?.dataset.hxSelectGroup && first.dataset.hxSelectValue) select(root, first.dataset.hxSelectGroup, first.dataset.hxSelectValue);
        }
        const dialogId = control.dataset.hxDialog;
        if (dialogId) {
          const dialog = document.getElementById(dialogId);
          if (dialog instanceof HTMLDialogElement && root.contains(dialog) && !dialog.open) {
            focusBeforeDialog.set(dialog, control);
            dialog.showModal();
            // The clip's poster was deferred while the dialog stayed hidden;
            // assign it now so the frame never opens empty.
            dialog.querySelectorAll<HTMLVideoElement>("video[data-deferred-poster]").forEach(showDeferredPoster);
          }
        }
        if (control.hasAttribute("data-hx-close")) {
          event.preventDefault();
          control.closest("dialog")?.close();
        }
      }
      if (event.target instanceof HTMLDialogElement && event.target.open) {
        const bounds = event.target.getBoundingClientRect();
        if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) event.target.close();
      }
    };
    const handleClose = (event: Event) => {
      if (!(event.target instanceof HTMLDialogElement)) return;
      const trigger = focusBeforeDialog.get(event.target);
      if (trigger?.isConnected) trigger.focus({ preventScroll: true });
    };
    document.querySelectorAll<HTMLElement>("[data-hx-root]").forEach((root) => { root.dataset.hxReady = "true"; root.dataset.localReady = "true"; });
    // Presenter panels are hidden with `hidden`, so lazy images and preload=none
    // videos inside them only fetch at first tab switch. Warm them once the page
    // is idle so switching tabs reveals every panel's media instantly.
    const warmPresenterPanels = () => {
      document.querySelectorAll<HTMLElement>('[data-hx-panel-group="presenter"]').forEach((panel) => {
        panel.querySelectorAll<HTMLImageElement>('img[loading="lazy"]').forEach((img) => { img.loading = "eager"; });
        panel.querySelectorAll<HTMLVideoElement>("video[data-hx-preview]").forEach((video) => {
          if (video.preload !== "auto") { video.preload = "auto"; video.load(); }
        });
      });
    };
    if (typeof window.requestIdleCallback === "function") window.requestIdleCallback(() => warmPresenterPanels(), { timeout: 3000 });
    else window.setTimeout(warmPresenterPanels, 1200);
    // Motion scene cards: loop only while on screen so a grid of clips never
    // decodes off-viewport. Dialog clips pause with their dialog.
    const motionVideos = [...document.querySelectorAll<HTMLVideoElement>("video[data-hx-video]")];
    const motionObserver = new IntersectionObserver(entries => entries.forEach(entry => {
      const video = entry.target as HTMLVideoElement;
      const dialog = video.closest("dialog");
      if (dialog && !dialog.open) { releaseDecorationSlot(video); video.pause(); return; }
      if (entry.isIntersecting && !document.hidden) requestDecorationPlay(video, () => video.play());
      else { releaseDecorationSlot(video); video.pause(); }
    }), { threshold: 0.25 });
    motionVideos.forEach(video => motionObserver.observe(video));
    const motionVisibility = () => { if (document.hidden) motionVideos.forEach(video => video.pause()); };
    document.addEventListener("visibilitychange", motionVisibility);
    document.addEventListener("click", handleClick);
    document.addEventListener("close", handleClose, true);
    return () => {
      motionObserver.disconnect();
      document.removeEventListener("visibilitychange", motionVisibility);
      document.removeEventListener("click", handleClick);
      document.removeEventListener("close", handleClose, true);
    };
  }, []);
  return null;
}
