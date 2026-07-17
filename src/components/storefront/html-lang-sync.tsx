"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { isSpanishStorefrontRequestIdentity } from "@/lib/spanish-storefronts";

function isCustomerFacingPath(pathname: string): boolean {
  if (pathname.startsWith("/platform")) return false;
  if (/^\/site\/[^/]+\/admin(?:\/|$)/i.test(pathname)) return false;
  return true;
}

function removeGoogleNoTranslateMeta() {
  document.querySelectorAll<HTMLMetaElement>('meta[name="google"]').forEach((meta) => {
    if (/notranslate/i.test(meta.content)) meta.remove();
  });
}

function ensureContentLanguageMeta(language: string) {
  const existing = document.querySelector<HTMLMetaElement>('meta[http-equiv="Content-Language"], meta[http-equiv="content-language"]');
  if (existing) {
    existing.setAttribute("content", language);
    return;
  }
  const meta = document.createElement("meta");
  meta.setAttribute("http-equiv", "Content-Language");
  meta.setAttribute("content", language);
  document.head.appendChild(meta);
}

export function HtmlLangSync() {
  const pathname = usePathname();

  useEffect(() => {
    const applyLang = () => {
      const identity = `${window.location.hostname} ${window.location.pathname}`.toLowerCase();
      const serverLanguage = document.documentElement.lang.toLowerCase();
      const contentLanguage = document.querySelector<HTMLMetaElement>('meta[http-equiv="Content-Language"], meta[http-equiv="content-language"]')?.content.toLowerCase();
      const spanishXby = isSpanishStorefrontRequestIdentity(identity) || serverLanguage === "es" || contentLanguage === "es";
      const language = spanishXby ? "es" : "en";
      document.documentElement.lang = language;
      document.documentElement.setAttribute("translate", "yes");
      document.body?.setAttribute("translate", "yes");

      if (isCustomerFacingPath(window.location.pathname)) {
        document.documentElement.classList.remove("notranslate");
        document.body?.classList.remove("notranslate");
        removeGoogleNoTranslateMeta();
        ensureContentLanguageMeta(language);
      }
    };
    applyLang();
    window.addEventListener("popstate", applyLang);
    return () => window.removeEventListener("popstate", applyLang);
  }, [pathname]);

  return null;
}
