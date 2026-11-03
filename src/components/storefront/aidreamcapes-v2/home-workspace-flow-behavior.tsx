"use client";

import { useEffect } from "react";

type LoopRoot = HTMLElement;

const TYPE_MS = 26;

/** Type `text` into `el` one character at a time. Resolves when finished or aborted. */
function typeInto(el: HTMLElement, text: string, aborted: () => boolean): Promise<void> {
  return new Promise((resolve) => {
    let n = 0;
    const tick = () => {
      if (aborted()) return resolve();
      n += 1;
      el.textContent = text.slice(0, n);
      if (n >= text.length) return resolve();
      setTimeout(tick, TYPE_MS);
    };
    tick();
  });
}

const wait = (ms: number, aborted: () => boolean) => new Promise<void>((resolve) => {
  const started = Date.now();
  const tick = () => {
    if (aborted() || Date.now() - started >= ms) return resolve();
    setTimeout(tick, 120);
  };
  tick();
});

/**
 * Replay loops for the workspace-flow section: the assistant conversation, the
 * prompt optimizer and the template handoff. Decoration only — it reads and
 * writes attributes and text on the already-rendered section and requests no
 * data. Visitors who prefer reduced motion keep the static section.
 */
export function HomeWorkspaceFlowBehavior() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const roots = [...document.querySelectorAll<HTMLElement>("[data-wf-chat], [data-wf-opt], [data-wf-tpl]")];
    if (!roots.length) return;

    let disposed = false;
    const aborted = () => disposed;

    // Chat: user line types in, the assistant answers, a follow-up types in, suggestion chips appear.
    async function chatLoop(root: HTMLElement) {
      const u1 = root.querySelector<HTMLElement>("[data-wf-u1] .wf-tx");
      const u2 = root.querySelector<HTMLElement>("[data-wf-u2] .wf-tx");
      if (!u1 || !u2) return;
      const msg1 = u1.textContent ?? "";
      const msg2 = u2.textContent ?? "";
      for (;;) {
        if (aborted()) return;
        root.dataset.s = "0";
        u1.textContent = ""; u2.textContent = "";
        await wait(1100, aborted);
        if (aborted()) return;
        root.dataset.s = "1";
        await typeInto(u1, msg1, aborted);
        if (aborted()) return;
        root.dataset.s = "2";
        await wait(1900, aborted);
        if (aborted()) return;
        root.dataset.s = "3";
        await wait(3000, aborted);
        if (aborted()) return;
        root.dataset.s = "4";
        await typeInto(u2, msg2, aborted);
        if (aborted()) return;
        root.dataset.s = "5";
        await wait(3200, aborted);
      }
    }

    // Prompt optimizer: the idea types in, Optimize presses, a skeleton shimmers, the sections stagger in, the price lands.
    async function optLoop(root: HTMLElement) {
      const idea = root.querySelector<HTMLElement>(".wf-idea-tx");
      if (!idea) return;
      const ideaText = idea.textContent ?? "";
      for (;;) {
        if (aborted()) return;
        root.dataset.s = "draft";
        idea.textContent = "";
        await wait(1100, aborted);
        if (aborted()) return;
        root.dataset.s = "typing";
        await typeInto(idea, ideaText, aborted);
        if (aborted()) return;
        root.dataset.s = "ready";
        await wait(1100, aborted);
        for (const stage of ["opt1", "opt2", "opt3"] as const) {
          if (aborted()) return;
          root.dataset.s = stage;
          await wait(stage === "opt1" ? 1600 : stage === "opt2" ? 2400 : 3600, aborted);
        }
      }
    }

    // Template handoff: card wall, the featured thumbnail flies into the composer, the prompt types in, the price bar lands.
    async function tplLoop(root: HTMLElement) {
      const typed = root.querySelector<HTMLElement>(".wf-wtyped");
      if (!typed) return;
      const prompt = typed.textContent ?? "";
      const stage = (value: string, ms: number) => wait(ms, aborted).then(() => { root.dataset.s = value; });
      for (;;) {
        if (aborted()) return;
        root.dataset.s = "grid";
        await stage("t1", 3400);
        if (aborted()) return;
        await stage("e1", 1050);
        if (aborted()) return;
        await wait(700, aborted);
        if (aborted()) return;
        root.dataset.s = "e2";
        typed.textContent = "";
        await typeInto(typed, prompt, aborted);
        if (aborted()) return;
        root.dataset.s = "e3";
        await wait(4200, aborted);
        if (aborted()) return;
        root.dataset.s = "grid";
        await wait(900, aborted);
      }
    }

    const started = new Set<LoopRoot>();
    const start = (root: HTMLElement) => {
      if (started.has(root)) return;
      started.add(root);
      if (root.hasAttribute("data-wf-chat")) void chatLoop(root);
      else if (root.hasAttribute("data-wf-opt")) void optLoop(root);
      else void tplLoop(root);
    };

    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) if (entry.isIntersecting) start(entry.target as HTMLElement);
    }, { rootMargin: "120px 0px" });

    for (const root of roots) observer.observe(root);

    return () => {
      disposed = true;
      observer.disconnect();
      for (const root of roots) delete root.dataset.s;
    };
  }, []);
  return null;
}
