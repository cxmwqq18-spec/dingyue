"use client";

import { useEffect, useRef, useState } from "react";

// Copies the prompt the server already rendered on the detail page. The button
// only reads that DOM text: it requests no page, catalog, or customer data.

type CopyState = "idle" | "copied" | "failed";

/** Older browsers and denied permissions fall back to a selection copy. */
function copyWithSelection(text: string): boolean {
  const field = document.createElement("textarea");
  field.value = text;
  field.setAttribute("readonly", "");
  field.style.position = "fixed";
  field.style.opacity = "0";
  document.body.appendChild(field);
  field.select();
  let copied = false;
  try {
    copied = document.execCommand("copy");
  } catch {
    copied = false;
  }
  document.body.removeChild(field);
  return copied;
}

export function MediaDetailPromptCopy({ label, copiedLabel, failedLabel }: {
  label: string;
  copiedLabel: string;
  failedLabel: string;
}) {
  const [state, setState] = useState<CopyState>("idle");
  const [mounted, setMounted] = useState(false);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setMounted(true);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const copy = async () => {
    const panel = buttonRef.current?.closest("[data-detail-prompt]");
    const text = panel?.querySelector("[data-detail-prompt-text]")?.textContent?.trim() ?? "";
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setState("copied");
    } catch {
      setState(copyWithSelection(text) ? "copied" : "failed");
    }
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setState("idle"), 2200);
  };

  // Without JavaScript there is no copy action, so the button stays hidden and
  // the prompt itself remains complete server-rendered text.
  if (!mounted) return null;

  return (
    <button className="v-detail-prompt-copy" onClick={copy} ref={buttonRef} type="button">
      {state === "copied" ? copiedLabel : state === "failed" ? failedLabel : label}
    </button>
  );
}
