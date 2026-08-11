"use client";

import { useEffect } from "react";
import { isIframePatchPayload } from "@/components/designer/designer-preview-protocol";

export function IframePatchListener() {
  useEffect(() => {
    let selectedId = "";
    let selectedBlockId = "";

    function clearSelectedSections() {
      document.querySelectorAll<HTMLElement>(".xfcart-section[data-xfcart-selected='true']").forEach((section) => {
        section.removeAttribute("data-xfcart-selected");
        section.removeAttribute("data-xfcart-selected-block");
      });
      document.querySelectorAll<HTMLElement>("[data-xfcart-block-selected='true']").forEach((block) => {
        block.removeAttribute("data-xfcart-block-selected");
      });
    }

    function scrollSelectedSectionIntoView(section: HTMLElement, id: string) {
      if (id === "footer_plus") {
        section.scrollIntoView({ behavior: "smooth", block: "end", inline: "nearest" });
        return;
      }
      if (id === "header_plus") {
        section.scrollIntoView({ behavior: "smooth", block: "start", inline: "nearest" });
        return;
      }
      const targetTop = section.getBoundingClientRect().top + window.scrollY - 28;
      window.scrollTo({ top: Math.max(0, targetTop), behavior: "smooth" });
    }

    function selectSection(id: string, blockId = "", options?: { scroll?: boolean }) {
      selectedId = id;
      selectedBlockId = blockId;
      clearSelectedSections();
      const section = document.getElementById(`xfcart-section-${id}`);
      if (!section) return;
      section.setAttribute("data-xfcart-selected", "true");
      if (blockId) section.setAttribute("data-xfcart-selected-block", blockId);
      if (blockId) {
        section.querySelector<HTMLElement>(`[data-xfcart-block-id="${CSS.escape(blockId)}"]`)?.setAttribute("data-xfcart-block-selected", "true");
      }
      if (options?.scroll === false) return;
      scrollSelectedSectionIntoView(section, id);
    }

    function restoreSelection(id: string) {
      if (selectedId === id) {
        window.requestAnimationFrame(() => selectSection(selectedId, selectedBlockId));
      }
    }

    function onMessage(event: MessageEvent) {
      if (!isIframePatchPayload(event.data)) return;
      if (event.data.act === "reload") {
        window.location.reload();
        return;
      }
      if (event.data.act === "clearSelection") {
        selectedId = "";
        selectedBlockId = "";
        clearSelectedSections();
        return;
      }
      if (event.data.act === "select") {
        selectSection(event.data.id, event.data.blockId, { scroll: event.data.scroll !== false });
        return;
      }
      const id = event.data.id;
      const current = document.getElementById(`xfcart-section-${id}`);
      if (event.data.act === "del") {
        current?.remove();
        if (selectedId === id) {
          selectedId = "";
          selectedBlockId = "";
          clearSelectedSections();
        }
        return;
      }
      if (event.data.act === "th1") {
        if (current && event.data.html) current.outerHTML = event.data.html;
        restoreSelection(id);
        return;
      }
      const footer = document.getElementById("xfcart-section-footer_plus");
      if (event.data.html) {
        if (footer) footer.insertAdjacentHTML("beforebegin", event.data.html);
        else document.querySelector("[data-theme-sections-root]")?.insertAdjacentHTML("beforeend", event.data.html);
      }
      restoreSelection(id);
    }

    function onPreviewClick(event: MouseEvent) {
      const target = event.target instanceof Element ? event.target : null;
      const section = target?.closest<HTMLElement>(".xfcart-section[data-section-id]");
      if (!section) return;
      const id = section.dataset.sectionId;
      if (!id) return;
      const block = target?.closest<HTMLElement>("[data-xfcart-block-id]");
      const blockId = block?.dataset.xfcartBlockId ?? "";
      event.preventDefault();
      event.stopPropagation();
      selectSection(id, blockId);
      window.parent?.postMessage(
        {
          act: "previewSelect",
          id,
          blockId,
          sectionType: section.dataset.sectionType ?? ""
        },
        "*"
      );
    }

    window.addEventListener("message", onMessage);
    document.addEventListener("click", onPreviewClick, true);
    return () => {
      window.removeEventListener("message", onMessage);
      document.removeEventListener("click", onPreviewClick, true);
    };
  }, []);

  return (
    <style
      data-xfcart-preview-click-select=""
      data-xfcart-preview-protocol="previewSelect"
      data-xfcart-preview-selection-listener=""
      dangerouslySetInnerHTML={{
        __html: `
          .xfcart-section {
            cursor: crosshair;
          }
          [data-xfcart-block-id] {
            cursor: cell;
          }
          .xfcart-section[data-xfcart-selected="true"] {
            outline: 2px solid rgba(20, 24, 20, 0.92);
            outline-offset: -2px;
            box-shadow: inset 0 0 0 1px rgba(255,255,255,0.72), 0 0 0 4px rgba(168, 107, 76, 0.18);
            position: relative;
          }
          .xfcart-section[data-xfcart-selected="true"]::before {
            content: "Selected in designer";
            position: absolute;
            left: 14px;
            top: 14px;
            z-index: 60;
            border: 1px solid rgba(24, 24, 27, 0.16);
            border-radius: 999px;
            background: rgba(255, 255, 255, 0.92);
            color: #141814;
            font: 600 11px/1 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
            letter-spacing: 0.08em;
            padding: 7px 10px;
            text-transform: uppercase;
            pointer-events: none;
            box-shadow: 0 18px 42px -32px rgba(24, 24, 27, 0.78);
          }
          [data-xfcart-block-selected="true"] {
            outline: 2px dashed rgba(168, 107, 76, 0.92);
            outline-offset: -5px;
            box-shadow: inset 0 0 0 1px rgba(255,255,255,0.8);
            position: relative;
          }
          [data-xfcart-block-selected="true"]::after {
            content: "Block";
            position: absolute;
            right: 12px;
            top: 12px;
            z-index: 61;
            border-radius: 999px;
            background: #141814;
            color: #fff;
            font: 600 10px/1 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
            letter-spacing: 0.1em;
            padding: 6px 8px;
            text-transform: uppercase;
            pointer-events: none;
          }
        `
      }}
    />
  );
}
