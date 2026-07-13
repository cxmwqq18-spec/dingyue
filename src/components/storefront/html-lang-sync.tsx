"use client";

import { useEffect } from "react";

export function HtmlLangSync() {
  useEffect(() => {
    const applyLang = () => {
      const identity = `${window.location.hostname} ${window.location.pathname}`.toLowerCase();
      const spanishXby = /\b(?:aidreamcapes|mydreamshoots)-xby\b/.test(identity);
      if (spanishXby) {
        document.documentElement.lang = "es";
      }
      document.documentElement.setAttribute("translate", "yes");
    };
    applyLang();
    window.addEventListener("popstate", applyLang);
    return () => window.removeEventListener("popstate", applyLang);
  }, []);

  return null;
}
