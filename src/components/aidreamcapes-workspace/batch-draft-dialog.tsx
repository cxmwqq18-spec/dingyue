"use client";

import { useEffect, useId, useRef, useState } from "react";
import { X } from "lucide-react";
import type { SceneId, TaskInput } from "@/lib/aidreamcapes-workspace/types";
import styles from "./batch-draft-dialog.module.css";

export interface BatchDraftItem {
  sceneId: SceneId;
  input: TaskInput;
  title: string;
}

export interface BatchDraftDialogProps {
  open: boolean;
  initialSceneId: SceneId;
  initialInput: TaskInput;
  scenes: { id: SceneId; label: string }[];
  disabled?: boolean;
  onClose: () => void;
  onSubmit: (items: BatchDraftItem[]) => void;
}

type DraftTitle = { id: number; title: string };
const MAX_DRAFTS = 10;

function copyInput(input: TaskInput): TaskInput {
  return {
    ...input,
    images: Object.fromEntries(Object.entries(input.images).map(([key, urls]) => [key, [...urls]])),
    fields: Object.fromEntries(Object.entries(input.fields).map(([key, value]) => [key, Array.isArray(value) ? [...value] : value])),
    options: { ...input.options },
  };
}

export function BatchDraftDialog({ open, initialSceneId, initialInput, scenes, disabled = false, onClose, onSubmit }: BatchDraftDialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const nextId = useRef(1);
  const [drafts, setDrafts] = useState<DraftTitle[]>([{ id: 0, title: "Draft copy 1" }]);

  useEffect(() => {
    if (!open) return;
    returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    nextId.current = 1;
    setDrafts([{ id: 0, title: "Draft copy 1" }]);
    const frame = requestAnimationFrame(() => titleInputRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [open]);

  useEffect(() => {
    if (open) return;
    returnFocusRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        if (!disabled) onClose();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), [href], select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )).filter((element) => !element.hasAttribute("hidden"));
      if (focusable.length === 0) { event.preventDefault(); return; }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || !dialogRef.current.contains(document.activeElement))) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !dialogRef.current.contains(document.activeElement))) {
        event.preventDefault(); first.focus();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [disabled, onClose, open]);

  if (!open) return null;

  const sceneLabel = scenes.find((scene) => scene.id === initialSceneId)?.label ?? "current video setup";
  const canSubmit = !disabled && drafts.length > 0 && drafts.every((draft) => draft.title.trim().length > 0);
  const updateTitle = (id: number, title: string) => setDrafts((current) => current.map((draft) => draft.id === id ? { ...draft, title } : draft));
  const addDraft = () => {
    if (drafts.length >= MAX_DRAFTS) return;
    const id = nextId.current++;
    setDrafts((current) => [...current, { id, title: `Draft copy ${current.length + 1}` }]);
  };
  const submit = () => {
    if (!canSubmit) return;
    onSubmit(drafts.map(({ title }) => ({ sceneId: initialSceneId, input: copyInput(initialInput), title: title.trim() })));
  };

  return (
    <div className={styles.overlay} onMouseDown={(event) => { if (event.target === event.currentTarget && !disabled) onClose(); }}>
      <section ref={dialogRef} className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={descriptionId}>
        <header className={styles.header}>
          <div>
            <p className={styles.eyebrow}>AIVideosUGC</p>
            <h2 id={titleId}>Create draft copies</h2>
          </div>
          <button className={styles.iconButton} type="button" aria-label="Close dialog" onClick={onClose} disabled={disabled}><X size={20} /></button>
        </header>

        <p id={descriptionId} className={styles.description}><span>
          Create 1–10 named drafts using the same </span><span>{sceneLabel}</span><span> setup. These create drafts only; nothing will be generated or published.
        </span></p>

        <div className={styles.list} aria-label="Draft copies">
          {drafts.map((draft, index) => (
            <div className={styles.draftRow} key={draft.id}>
              <label className={styles.field}>
                <span className={styles.fieldLabel}><span>Draft </span><span>{index + 1}</span><span> name</span></span>
                <input
                  ref={index === 0 ? titleInputRef : undefined}
                  className={styles.input}
                  type="text"
                  value={draft.title}
                  maxLength={100}
                  required
                  disabled={disabled}
                  onChange={(event) => updateTitle(draft.id, event.target.value)}
                  aria-label={`Draft ${index + 1} name`}
                />
              </label>
              <button className={styles.removeButton} type="button" onClick={() => setDrafts((current) => current.filter((item) => item.id !== draft.id))} disabled={disabled || drafts.length === 1} aria-label={`Remove draft ${index + 1}`}>
                Remove
              </button>
            </div>
          ))}
        </div>

        <button className={styles.addButton} type="button" onClick={addDraft} disabled={disabled || drafts.length >= MAX_DRAFTS}>
          <span aria-hidden="true">+</span><span> Add another draft </span><span className={styles.count}><span>{drafts.length}</span><span>/</span><span>{MAX_DRAFTS}</span></span>
        </button>

        <footer className={styles.footer}>
          <button className={styles.secondaryButton} type="button" onClick={onClose} disabled={disabled}>Cancel</button>
          <button className={styles.primaryButton} type="button" onClick={submit} disabled={!canSubmit}><span>
            Create </span><span>{drafts.length}</span> <span>{drafts.length === 1 ? "draft" : "drafts"}</span>
          </button>
        </footer>
      </section>
    </div>
  );
}
