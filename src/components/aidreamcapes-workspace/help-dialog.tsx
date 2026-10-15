"use client";

import { useEffect, useRef } from "react";
import styles from "./help-dialog.module.css";

export type WorkspaceHelpDialogProps = {
  kind: "guide" | "support";
  onClose: () => void;
  supportHref: string;
  accountHref?: string;
};

const guideSteps = [
  {
    title: "Details",
    description: "Choose a scene, add your product photos, and describe what makes your product useful.",
  },
  {
    title: "Storyboard",
    description: "Review the planned shots, edit the details, and generate clips for each scene.",
  },
  {
    title: "Render",
    description: "Choose your favorite clips and assemble them into a finished video.",
  },
  {
    title: "Delivery",
    description: "Preview your video, then download it and its source clips.",
  },
];

export function WorkspaceHelpDialog({ kind, onClose, supportHref, accountHref }: WorkspaceHelpDialogProps) {
  const dialogRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;

      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )).filter((element) => element.getAttribute("aria-hidden") !== "true");
      if (focusable.length === 0) {
        event.preventDefault();
        dialogRef.current.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || !dialogRef.current.contains(document.activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !dialogRef.current.contains(document.activeElement))) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      if (previouslyFocused?.isConnected) previouslyFocused.focus();
    };
  }, [onClose]);

  const isGuide = kind === "guide";
  const title = isGuide ? "Getting started" : "Book a Call";

  return (
    <div
      className={styles.overlay}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        ref={dialogRef}
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="workspace-help-title"
        tabIndex={-1}
      >
        <header className={styles.header}>
          <h2 id="workspace-help-title">{title}</h2>
          <button ref={closeRef} className={styles.close} type="button" onClick={onClose} aria-label="Close dialog">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>
          </button>
        </header>

        {isGuide ? (
          <>
            <p className={styles.intro}>Create a product video in four steps.</p>
            <ol className={styles.steps}>
              {guideSteps.map((step) => (
                <li className={styles.step} key={step.title}>
                  <span className={styles.number} aria-hidden="true">{guideSteps.indexOf(step) + 1}</span>
                  <div><h3>{step.title}</h3><p>{step.description}</p></div>
                </li>
              ))}
            </ol>
          </>
        ) : (
          <div className={styles.support}>
            <p>Contact our team to arrange a call.</p>
            <a className={styles.primaryLink} href={supportHref}>Contact our team</a>
            {accountHref && <a className={styles.accountLink} href={accountHref}>Manage your account</a>}
          </div>
        )}
      </section>
    </div>
  );
}
