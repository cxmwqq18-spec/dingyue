"use client";

import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import type { HomeComposerImageInput } from "./home-composer";

export function useImageDraft(siteId: string, customerId: string | undefined, input: HomeComposerImageInput, setInput: Dispatch<SetStateAction<HomeComposerImageInput>>, hasEntryInput = false) {
  const key = `aidreamcapes:image-draft:${encodeURIComponent(siteId)}:${encodeURIComponent(customerId ?? "guest")}`;
  const [readyKey, setReadyKey] = useState("");
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const resumingGuestDraft = customerId !== undefined && params.get("resumeDraft") === "1";
      const explicitInput = !resumingGuestDraft && (hasEntryInput || ["source", "preset", "prompt", "tool", "tool_id"].some((name) => params.has(name)));
      const raw = sessionStorage.getItem(key);
      const guestKey = `aidreamcapes:image-draft:${encodeURIComponent(siteId)}:guest`;
      const guestRaw = customerId && (resumingGuestDraft || (!raw && !explicitInput)) ? sessionStorage.getItem(guestKey) : null;
      const decode = (savedRaw: string, requireFresh: boolean): HomeComposerImageInput | undefined => {
        const saved = JSON.parse(savedRaw) as { version?: unknown; savedAt?: unknown; input?: unknown };
        if (saved.version !== 1 || !saved.input || typeof saved.input !== "object") return requireFresh ? undefined : saved as unknown as HomeComposerImageInput;
        const age = Date.now() - Number(saved.savedAt);
        if (requireFresh && (!Number.isFinite(saved.savedAt) || age < 0 || age >= 30 * 60 * 1000)) return undefined;
        return saved.input as HomeComposerImageInput;
      };
      const guestInput = guestRaw ? decode(guestRaw, true) : undefined;
      const value = guestInput ?? (raw && !explicitInput ? decode(raw, !customerId) : undefined);
      if (value) {
        if (typeof value.prompt === "string" && value.prompt.length <= 4000 &&
            ["custom", "white-background", "change-background", "lifestyle-photos", "model-photos"].includes(value.toolId) &&
            ["1:1", "9:16", "16:9"].includes(value.aspect) && Array.isArray(value.assetUrls) && value.assetUrls.length <= 4 &&
            value.assetUrls.every((url) => typeof url === "string" && url.length <= 2048)) {
          setInput(value);
          if (guestInput) sessionStorage.removeItem(guestKey);
        }
      }
    } catch { /* The form remains usable when browser storage is unavailable. */ }
    setReadyKey(key);
  }, [customerId, hasEntryInput, key, setInput, siteId]);
  useEffect(() => {
    if (readyKey !== key) return;
    try { sessionStorage.setItem(key, JSON.stringify({ version: 1, savedAt: Date.now(), input })); } catch { /* Private browser modes may disable storage. */ }
  }, [input, key, readyKey]);
}
