"use client";

import { useEffect } from "react";

/** Local storyboard playback; no content or runtime data is requested by the browser. */
export function HomeWorkflowBehavior() {
  useEffect(() => {
    const dialog = document.getElementById("adc-workflow-sequence");
    const control = dialog?.querySelector<HTMLButtonElement>("[data-workflow-play]");
    const frames = [...(dialog?.querySelectorAll<HTMLElement>("[data-workflow-frame]") ?? [])];
    if (!dialog || !control || !frames.length) return;
    let timer: ReturnType<typeof setInterval> | undefined;
    let frame = 0;
    const stop = () => {
      if (timer) clearInterval(timer);
      timer = undefined;
      control.setAttribute("aria-pressed", "false");
      const text = control.querySelector("span");
      if (text) text.textContent = control.dataset.playLabel ?? "";
    };
    const play = () => {
      if (timer) return stop();
      control.setAttribute("aria-pressed", "true");
      const text = control.querySelector("span");
      if (text) text.textContent = control.dataset.pauseLabel ?? "";
      timer = setInterval(() => {
        frame = (frame + 1) % frames.length;
        frames.forEach((item, i) => { item.hidden = frame !== i; });
      }, 1800);
    };
    const visibility = () => { if (document.hidden) stop(); };
    control.addEventListener("click", play);
    dialog.addEventListener("close", stop);
    document.addEventListener("visibilitychange", visibility);
    return () => { stop(); control.removeEventListener("click", play); dialog.removeEventListener("close", stop); document.removeEventListener("visibilitychange", visibility); };
  }, []);
  return null;
}
