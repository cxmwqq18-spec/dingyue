"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, FileVideo, Play, Trash2 } from "lucide-react";
import styles from "./library.module.css";

export interface LibraryCardMedia {
  kind: "video" | "image";
  url: string;
  label: string;
}

export interface LibraryTaskCardProps {
  title: string;
  statusLabel: string;
  /** progress | error | done | idle, drives the status pill colour. */
  statusTone: "progress" | "error" | "done" | "idle";
  failureReason?: string;
  description?: string;
  sceneName?: string;
  modelLabel?: string;
  createdAtLabel?: string;
  duration: number | string;
  aspect: string;
  resolution?: string;
  referenceSummary?: string;
  /** Small portraits shown next to the reference row: the host portrait first, then the product photos. */
  referenceThumbs?: { src: string; label: string }[];
  media: LibraryCardMedia[];
  disabled?: boolean;
  /** 查看 详情 按钮独立禁用位：生成中仍允许查看进度，只有全局忙时禁用。 */
  openDisabled?: boolean;
  onOpen: () => void;
  onDelete: () => void;
}

/**
 * One library card: a media stage that carries every reference image of the
 * task, then the status, the title, the description, the metadata and the
 * actions.
 *
 * Switching: the thumbnails under the stage change the active frame with a
 * crossfade, the counter shows the position, and the left/right arrow keys
 * move through the frames while the stage has focus.
 */
export function LibraryTaskCard({
  title,
  statusLabel,
  statusTone,
  failureReason,
  description,
  sceneName,
  modelLabel,
  createdAtLabel,
  duration,
  aspect,
  resolution,
  referenceSummary,
  referenceThumbs,
  media,
  disabled,
  openDisabled,
  onOpen,
  onDelete
}: LibraryTaskCardProps) {
  const [active, setActive] = useState(0);
  const stageRef = useRef<HTMLDivElement>(null);

  // Media can arrive later, and the active frame has to stay in range.
  useEffect(() => {
    setActive((current) => (current >= media.length ? 0 : current));
  }, [media.length]);

  const imageCount = useMemo(() => media.filter((item) => item.kind === "image").length, [media]);
  const activeItem = media[active];
  const hasVideo = media.some((item) => item.kind === "video");
  const backdrop = useMemo(() => {
    if (!activeItem) return undefined;
    if (activeItem.kind === "image") return activeItem.url;
    return media.find((item) => item.kind === "image")?.url;
  }, [activeItem, media]);

  const statusClass = statusTone === "error"
    ? styles.pillError
    : statusTone === "done"
      ? styles.pillDone
      : statusTone === "progress"
        ? styles.pillRun
        : "";
  const countLabel = media.length > 1 ? `${active + 1} / ${media.length}` : "";

  function move(step: number) {
    if (media.length < 2) return;
    setActive((current) => (current + step + media.length) % media.length);
  }

  return (
    <article className={styles.taskCard} aria-label={title}>
      <div
        ref={stageRef}
        className={`${styles.stage} ${media.length ? "" : styles.stageEmpty}`}
        tabIndex={media.length > 1 ? 0 : -1}
        role={media.length > 1 ? "group" : undefined}
        aria-label={media.length > 1 ? `${title}: reference images, ${active + 1} of ${media.length}` : undefined}
        onKeyDown={(event) => {
          if (event.key === "ArrowRight") {
            event.preventDefault();
            move(1);
          } else if (event.key === "ArrowLeft") {
            event.preventDefault();
            move(-1);
          }
        }}
      >
        {media.length === 0 && (
          <div className={styles.stageEmptyInner}>
            <FileVideo size={34} />
            <span>No reference images yet</span>
          </div>
        )}

        {backdrop && <img className={styles.stageBackdrop} src={backdrop} alt="" aria-hidden="true" decoding="async" />}

        {media.length > 0 && (
          <div className={styles.layers}>
            {media.map((item, index) => (
              <div key={`${item.kind}:${item.url}`} className={`${styles.layer} ${index === active ? styles.layerActive : ""}`} aria-hidden={index === active ? undefined : true}>
                {item.kind === "video" ? (
                  // Only the active video is mounted, so a page of cards never
                  // loads several files at once.
                  index === active
                    ? <video className={styles.stageVideo} controls preload="metadata" playsInline src={item.url} />
                    : null
                ) : (
                  <img loading="lazy" decoding="async" src={item.url} alt={item.label ? `${title}: ${item.label}` : title} />
                )}
              </div>
            ))}
          </div>
        )}

        {media.length > 0 && (
          <div className={styles.stageChips}>
            {imageCount > 0 && <span className={styles.stageChip}>{imageCount === 1 ? "1 photo" : `${imageCount} photos`}</span>}
            {hasVideo && <span className={styles.stageChip}>Video</span>}
            <span className={styles.stageChip}>{aspect} · {duration}s</span>
          </div>
        )}
        {countLabel && <span className={styles.stageCounter}>{countLabel}</span>}

        {media.length > 1 && (
          <div className={styles.rail} role="tablist" aria-label={`${title}: choose a frame`}>
            {media.map((item, index) => (
              <button
                key={`${item.kind}:${item.url}`}
                type="button"
                role="tab"
                aria-selected={index === active}
                aria-label={item.kind === "video" ? "Video result" : `${item.label || "Reference"} ${index + 1}`}
                className={`${styles.thumb} ${index === active ? styles.thumbActive : ""}`}
                onClick={() => setActive(index)}
              >
                {item.kind === "video"
                  ? <span className={styles.thumbPlay}><Play size={14} /></span>
                  : <img loading="lazy" decoding="async" src={item.url} alt="" />}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className={styles.body}>
        <div className={styles.pills}>
          <span className={`${styles.pill} ${statusClass}`}>{statusLabel}</span>
          <span className={styles.pill}>{duration}s</span>
          <span className={styles.pill}>{aspect}</span>
          {resolution && <span className={styles.pill}>{resolution}</span>}
        </div>
        <h3 className={styles.title}>{title}</h3>
        {failureReason && <p className={styles.fail} role="status">{failureReason}</p>}
        {description && <p className={styles.description}>{description}</p>}
        <dl className={styles.meta}>
          {sceneName && <><dt>Scene</dt><dd>{sceneName}</dd></>}
          {modelLabel && <><dt>Model</dt><dd>{modelLabel}</dd></>}
          {referenceSummary && <><dt>References</dt><dd className={styles.referenceRow}>
            {referenceThumbs?.length ? <span className={styles.referenceThumbs}>
              {referenceThumbs.map((thumb, index) => <img key={`${thumb.src}-${index}`} className={styles.referenceThumb} src={thumb.src} alt={thumb.label} title={thumb.label} loading="lazy" decoding="async" />)}
            </span> : null}
            {referenceSummary}
          </dd></>}
          {createdAtLabel && <><dt>Created</dt><dd suppressHydrationWarning>{createdAtLabel}</dd></>}
        </dl>
        <div className={styles.actions}>
          <button type="button" className={styles.open} disabled={openDisabled ?? disabled} onClick={onOpen}>
            <span>View details</span>
            <ArrowRight size={15} />
          </button>
          <button type="button" className={styles.delete} disabled={disabled} onClick={onDelete} aria-label={`Delete ${title}`} title={`Delete ${title}`}>
            <Trash2 size={16} />
          </button>
        </div>
      </div>
    </article>
  );
}
