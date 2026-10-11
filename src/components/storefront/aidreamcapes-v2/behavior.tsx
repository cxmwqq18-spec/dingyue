"use client";

// Presentation-only behaviour for Aidreamcapes.com v2 pages (reviewed: no network
// requests, no data loading). All menu links and template cards are server-rendered;
// this only opens/closes menus and hides/shows already-rendered cards.
import { useEffect } from "react";

export function AidreamcapesV2MenuBehavior() {
  useEffect(() => {
    const root = document.querySelector<HTMLElement>(".adc2");
    if (!root) return;
    const nav = root.querySelector<HTMLElement>("#adc2-main-nav");
    const items = Array.from(root.querySelectorAll<HTMLElement>(".nav-item"));
    const desk = window.matchMedia("(min-width:981px)");
    const timers = new WeakMap<HTMLElement, number>();
    const setOpen = (item: HTMLElement, open: boolean, pin = false) => {
      window.clearTimeout(timers.get(item));
      item.classList.toggle("open", open);
      item.dataset.pinned = open && pin ? "1" : "";
      item.querySelector(".nav-btn")?.setAttribute("aria-expanded", String(open));
    };
    const closeAll = (except?: HTMLElement) => items.forEach((item) => { if (item !== except) setOpen(item, false); });
    const cleanups: Array<() => void> = [];
    items.forEach((item) => {
      const button = item.querySelector<HTMLElement>(".nav-btn");
      if (!button) return;
      const onClick = (event: Event) => {
        event.stopPropagation();
        if (item.classList.contains("open") && item.dataset.pinned === "1") setOpen(item, false);
        else { closeAll(item); setOpen(item, true, true); }
      };
      const onEnter = () => {
        if (!desk.matches) return;
        window.clearTimeout(timers.get(item));
        if (!item.classList.contains("open")) { closeAll(item); setOpen(item, true); }
      };
      const onLeave = () => {
        if (!desk.matches || item.dataset.pinned === "1") return;
        window.clearTimeout(timers.get(item));
        timers.set(item, window.setTimeout(() => setOpen(item, false), 350));
      };
      button.addEventListener("click", onClick);
      item.addEventListener("mouseenter", onEnter);
      item.addEventListener("mouseleave", onLeave);
      cleanups.push(() => {
        button.removeEventListener("click", onClick);
        item.removeEventListener("mouseenter", onEnter);
        item.removeEventListener("mouseleave", onLeave);
      });
    });
    const onDocClick = (event: Event) => { if (!(event.target as HTMLElement | null)?.closest(".panel")) closeAll(); };
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") closeAll(); };
    document.addEventListener("click", onDocClick);
    document.addEventListener("keydown", onKey);
    const toggle = root.querySelector<HTMLElement>("#adc2-menu-toggle");
    const onToggle = (event: Event) => {
      event.stopPropagation();
      const show = !nav?.classList.contains("show");
      nav?.classList.toggle("show", show);
      toggle?.setAttribute("aria-expanded", String(show));
    };
    toggle?.addEventListener("click", onToggle);
    return () => {
      cleanups.forEach((fn) => fn());
      document.removeEventListener("click", onDocClick);
      document.removeEventListener("keydown", onKey);
      toggle?.removeEventListener("click", onToggle);
    };
  }, []);
  return null;
}

export function AidreamcapesV2TemplateFilters() {
  useEffect(() => {
    const filters = document.getElementById("adc2-tpl-filters");
    const grid = document.getElementById("adc2-tpl-grid");
    if (!filters || !grid) return;
    const state: Record<string, string> = { type: "all", ind: "all", plat: "all" };
    const params = new URLSearchParams(window.location.search);
    (["type", "ind", "plat"] as const).forEach((key) => { const value = params.get(key); if (value) state[key] = value; });
    const cards = Array.from(grid.querySelectorAll<HTMLElement>(".tc"));
    const count = document.getElementById("adc2-tpl-count");
    const empty = document.getElementById("adc2-tpl-empty");
    const apply = () => {
      let shown = 0;
      cards.forEach((card) => {
        const ok = (state.type === "all" || card.dataset.type === state.type)
          && (state.ind === "all" || ` ${card.dataset.ind ?? ""} `.includes(` ${state.ind} `))
          && (state.plat === "all" || ` ${card.dataset.plat ?? ""} `.includes(` ${state.plat} `));
        card.hidden = !ok;
        if (ok) shown += 1;
      });
      filters.querySelectorAll<HTMLElement>(".chip").forEach((chip) => {
        chip.setAttribute("aria-pressed", String(state[chip.dataset.k ?? ""] === chip.dataset.v));
      });
      if (count) count.textContent = `Showing ${shown} of ${cards.length} templates`;
      if (empty) empty.hidden = shown > 0;
    };
    const onClick = (event: Event) => {
      const chip = (event.target as HTMLElement | null)?.closest<HTMLElement>(".chip");
      if (!chip?.dataset.k || !chip.dataset.v) return;
      state[chip.dataset.k] = chip.dataset.v;
      apply();
    };
    filters.addEventListener("click", onClick);
    apply();
    return () => filters.removeEventListener("click", onClick);
  }, []);
  return null;
}

export function AidreamcapesV2ActorFilters() {
  useEffect(() => {
    const root = document.querySelector<HTMLElement>(".actor-directory-shell");
    if (!root) return;
    const controls = Array.from(root.querySelectorAll<HTMLSelectElement>(".actor-filter-control"));
    const cards = Array.from(root.querySelectorAll<HTMLElement>(".actor-card"));
    const groups = Array.from(root.querySelectorAll<HTMLElement>(".actor-scene-group"));
    const count = root.querySelector<HTMLElement>(".actor-filter-count");
    const apply = () => {
      const state = Object.fromEntries(controls.map((control) => [control.dataset.actorFilter ?? "", control.value]));
      let shown = 0;
      cards.forEach((card) => {
        const matches = Object.entries(state).every(([key, value]) => !value || card.dataset[key] === value);
        card.hidden = !matches;
        if (matches) shown += 1;
      });
      groups.forEach((group) => { group.hidden = !group.querySelector(".actor-card:not([hidden])"); });
      if (count) count.textContent = `${shown} actor${shown === 1 ? "" : "s"}`;
    };
    controls.forEach((control) => control.addEventListener("change", apply));
    apply();
    return () => controls.forEach((control) => control.removeEventListener("change", apply));
  }, []);
  return null;
}

// The actor/scene panel is a plain GET form. This only combines already-rendered
// radio choices into the prompt query value; it never loads public data.
export function AidreamcapesV2ActorScenePicker() {
  useEffect(() => {
    const roots = Array.from(document.querySelectorAll<HTMLElement>("[data-actor-scene-picker]"));
    const cleanups: Array<() => void> = [];
    roots.forEach((root) => {
      const form = root.querySelector<HTMLFormElement>("form");
      const prompt = form?.querySelector<HTMLInputElement>('input[name="prompt"]');
      const actor = form?.querySelector<HTMLInputElement>('input[name="actor"]');
      const scene = form?.querySelector<HTMLInputElement>('input[name="scene"]');
      const apply = () => {
        const selectedActor = root.querySelector<HTMLInputElement>('input[type="radio"][name^="actor-choice-"]:checked');
        const selectedScene = root.querySelector<HTMLInputElement>('input[type="radio"][name^="scene-choice-"]:checked');
        const sceneValue = selectedScene?.value ?? "";
        const template = selectedActor?.dataset.actorPrompt ?? "";
        if (prompt && template) prompt.value = template.replaceAll("{{scene}}", sceneValue);
        if (actor && selectedActor) actor.value = selectedActor.value;
        if (scene && selectedScene) scene.value = selectedScene.value;
      };
      root.addEventListener("change", apply);
      apply();
      cleanups.push(() => root.removeEventListener("change", apply));
    });
    return () => cleanups.forEach((cleanup) => cleanup());
  }, []);
  return null;
}

export function AidreamcapesV2HeroTabs() {
  useEffect(() => {
    const box = document.getElementById("adc2-home-maker");
    if (!box) return;
    const tabs = Array.from(box.querySelectorAll<HTMLElement>("[data-mode]"));
    const panes = Array.from(box.querySelectorAll<HTMLElement>("[data-pane]"));
    const handlers = tabs.map((tab) => {
      const handler = () => {
        tabs.forEach((item) => item.setAttribute("aria-selected", String(item === tab)));
        panes.forEach((pane) => { pane.hidden = pane.dataset.pane !== tab.dataset.mode; });
      };
      tab.addEventListener("click", handler);
      return () => tab.removeEventListener("click", handler);
    });
    return () => handlers.forEach((fn) => fn());
  }, []);
  return null;
}

// The home page loop is muted and decorative. Visitors who ask their device for reduced
// motion get a still poster with normal play controls instead of an automatic loop.
export function AidreamcapesV2MotionPreference() {
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => {
      if (!query.matches) return;
      document.querySelectorAll<HTMLVideoElement>("video[data-adc2-loop]").forEach((video) => {
        video.pause();
        video.removeAttribute("autoplay");
        video.loop = false;
        video.controls = true;
      });
    };
    apply();
    query.addEventListener("change", apply);
    return () => query.removeEventListener("change", apply);
  }, []);
  return null;
}
