"use client";

import { useEffect } from "react";

/** Presentation-only controls over HTML already rendered by the server. */
export function HomeExperienceBehavior() {
  useEffect(() => {
    const focusBeforeDialog = new WeakMap<HTMLDialogElement, HTMLElement>();
    const select = (root: HTMLElement, group: string, value: string) => {
      root.querySelectorAll<HTMLElement>("[data-hx-select-group]").forEach((control) => {
        if (control.dataset.hxSelectGroup !== group) return;
        const selected = control.dataset.hxSelectValue === value;
        control.setAttribute("aria-pressed", String(selected));
        control.classList.toggle("is-selected", selected);
      });
      root.querySelectorAll<HTMLElement>("[data-hx-panel-group]").forEach((panel) => {
        if (panel.dataset.hxPanelGroup === group) panel.hidden = panel.dataset.hxPanelValue !== value;
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
        if (destination) root.querySelectorAll<HTMLAnchorElement>("a[data-home-cta]").forEach((cta) => cta.setAttribute("href", destination));
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
    document.addEventListener("click", handleClick);
    document.addEventListener("close", handleClose, true);
    return () => {
      document.removeEventListener("click", handleClick);
      document.removeEventListener("close", handleClose, true);
    };
  }, []);
  return null;
}
