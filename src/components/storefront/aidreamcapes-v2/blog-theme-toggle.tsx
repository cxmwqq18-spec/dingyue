"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "aivideosugc-blog-theme";

/** Ink is the server-rendered default; Paper is a per-visitor preference.
 * The attribute lives on <html> so the article surface can repaint without a
 * flash, and the choice survives navigation and reloads. */
export function BlogThemeToggle() {
  const [theme, setTheme] = useState<"ink" | "paper">("ink");

  useEffect(() => {
    setTheme(document.documentElement.getAttribute("data-blog-theme") === "paper" ? "paper" : "ink");
  }, []);

  function apply(next: "ink" | "paper") {
    document.documentElement.setAttribute("data-blog-theme", next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* private mode: the theme still applies for this page */
    }
    setTheme(next);
  }

  return (
    <div className="bdoc-theme" role="group" aria-label="Article theme">
      <span className="bdoc-theme-label">Theme</span>
      <button type="button" aria-pressed={theme === "ink"} onClick={() => apply("ink")}>Ink</button>
      <button type="button" aria-pressed={theme === "paper"} onClick={() => apply("paper")}>Paper</button>
    </div>
  );
}
