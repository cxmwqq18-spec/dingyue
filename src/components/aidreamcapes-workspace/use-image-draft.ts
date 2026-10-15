"use client";

import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import type { HomeComposerImageInput } from "./home-composer";

export function useImageDraft(siteId: string, customerId: string | undefined, input: HomeComposerImageInput, setInput: Dispatch<SetStateAction<HomeComposerImageInput>>) {
  const key = `aidreamcapes:image-draft:${encodeURIComponent(siteId)}:${encodeURIComponent(customerId ?? "guest")}`;
  const [readyKey, setReadyKey] = useState("");
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const explicitInput = ["source", "preset", "prompt", "tool", "tool_id"].some((name) => params.has(name));
      const raw = sessionStorage.getItem(key);
      if (raw && !explicitInput) {
        const value = JSON.parse(raw) as HomeComposerImageInput;
        if (typeof value.prompt === "string" && value.prompt.length <= 4000 &&
            ["custom", "white-background", "change-background", "lifestyle-photos", "model-photos"].includes(value.toolId) &&
            ["1:1", "9:16", "16:9"].includes(value.aspect) && Array.isArray(value.assetUrls) && value.assetUrls.length <= 4 &&
            value.assetUrls.every((url) => typeof url === "string" && url.length <= 2048)) setInput(value);
      }
    } catch { /* The form remains usable when browser storage is unavailable. */ }
    setReadyKey(key);
  }, [key, setInput]);
  useEffect(() => {
    if (readyKey !== key) return;
    try { sessionStorage.setItem(key, JSON.stringify(input)); } catch { /* Private browser modes may disable storage. */ }
  }, [input, key, readyKey]);
}
