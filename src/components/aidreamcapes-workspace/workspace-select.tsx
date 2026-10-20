"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";
import styles from "./workspace-select.module.css";

export type WorkspaceSelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
  hint?: string;
};

type WorkspaceSelectProps = {
  ariaLabel: string;
  value: string;
  options: WorkspaceSelectOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
  leading?: ReactNode;
  placeholder?: string;
  // Renders the trigger without its own frame, for use inside a control chip.
  bare?: boolean;
  className?: string;
  buttonClassName?: string;
  menuClassName?: string;
};

const THEME_VARIABLES = ["--ink", "--muted", "--line", "--surface", "--canvas", "--purple"];

const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

/**
 * A workspace dropdown that replaces the native select control. The native
 * control renders an OS-styled popup that cannot match the workspace, so the
 * menu is rendered by the app and keeps the same keyboard and screen-reader
 * contract.
 */
export function WorkspaceSelect({
  ariaLabel,
  value,
  options,
  onChange,
  disabled = false,
  leading,
  placeholder,
  bare = false,
  className,
  buttonClassName,
  menuClassName
}: WorkspaceSelectProps) {
  const listId = useId();
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [position, setPosition] = useState<{ top?: number; bottom?: number; left: number; width: number; theme: string } | null>(null);
  const typeAhead = useRef({ query: "", at: 0 });

  const selectedIndex = options.findIndex((option) => option.value === value);
  const selectedLabel = selectedIndex >= 0 ? options[selectedIndex].label : placeholder ?? "";

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const styles_ = getComputedStyle(trigger);
    const theme = THEME_VARIABLES.map((name) => `${name}:${styles_.getPropertyValue(name)}`).join(";");
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    // The menu always stays inside the viewport: it opens upwards when the
    // control sits near the bottom edge.
    const openUp = spaceBelow < 240 && spaceAbove > spaceBelow;
    const height = Math.max(140, Math.min(320, openUp ? spaceAbove - 12 : spaceBelow - 12));
    setPosition({
      ...(openUp ? { bottom: Math.round(window.innerHeight - rect.top + 6) } : { top: Math.round(rect.bottom + 6) }),
      left: Math.round(rect.left),
      width: Math.max(rect.width, 190),
      theme
    });
    if (menuRef.current) menuRef.current.style.maxHeight = `${height}px`;
  }, []);

  useIsomorphicLayoutEffect(() => {
    if (!open) return;
    updatePosition();
    const onScroll = () => updatePosition();
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (triggerRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const index = selectedIndex >= 0 ? selectedIndex : options.findIndex((option) => !option.disabled);
    setActiveIndex(index);
  }, [open, options, selectedIndex]);

  const commit = useCallback((index: number) => {
    const option = options[index];
    if (!option || option.disabled) return;
    onChange(option.value);
    setOpen(false);
    triggerRef.current?.focus();
  }, [onChange, options]);

  const moveActive = useCallback((delta: number) => {
    setActiveIndex((current) => {
      if (!options.length) return -1;
      let next = current;
      for (let step = 0; step < options.length; step += 1) {
        next = (next + delta + options.length) % options.length;
        if (!options[next].disabled) return next;
      }
      return current;
    });
  }, [options]);

  const onTriggerKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      moveActive(event.key === "ArrowDown" ? 1 : -1);
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      if (activeIndex >= 0) commit(activeIndex);
      return;
    }
    if (event.key === "Home" || event.key === "End") {
      if (!open) return;
      event.preventDefault();
      const index = event.key === "Home" ? 0 : options.length - 1;
      setActiveIndex(index);
      return;
    }
    if (event.key === "Tab") {
      setOpen(false);
      return;
    }
    if (event.key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey) {
      const now = Date.now();
      const state = typeAhead.current;
      state.query = now - state.at > 700 ? event.key : state.query + event.key;
      state.at = now;
      const match = options.findIndex((option) => !option.disabled && option.label.toLowerCase().startsWith(state.query.toLowerCase()));
      if (match >= 0) {
        event.preventDefault();
        if (!open) {
          setOpen(true);
        }
        setActiveIndex(match);
      }
    }
  };

  const menu = useMemo(() => {
    if (!open || !position || typeof document === "undefined") return null;
    return createPortal(
      <div
        ref={menuRef}
        id={listId}
        role="listbox"
        aria-label={ariaLabel}
        aria-activedescendant={activeIndex >= 0 ? `${listId}-option-${activeIndex}` : undefined}
        className={`${styles.menu} ${menuClassName ?? ""}`}
        style={{ ...(position.top != null ? { top: position.top } : {}), ...(position.bottom != null ? { bottom: position.bottom } : {}), left: position.left, minWidth: position.width, ...parseTheme(position.theme) }}
      >
        {options.length ? options.map((option, index) => {
          const isSelected = option.value === value;
          const isActive = index === activeIndex;
          return <div
            key={option.value}
            id={`${listId}-option-${index}`}
            role="option"
            aria-selected={isSelected}
            aria-disabled={option.disabled ? "true" : undefined}
            className={`${styles.option} ${isActive ? styles.optionActive : ""} ${isSelected ? styles.optionSelected : ""} ${option.disabled ? styles.optionDisabled : ""}`}
            onMouseEnter={() => setActiveIndex(index)}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => commit(index)}
          >
            <span className={styles.optionText}>
              <span className={styles.optionLabel}>{option.label}</span>
              {option.hint ? <span className={styles.optionHint}>{option.hint}</span> : null}
            </span>
            {isSelected ? <Check size={15} className={styles.optionCheck} aria-hidden="true" /> : null}
          </div>;
        }) : <div className={styles.empty}>No options</div>}
      </div>,
      document.body
    );
  }, [activeIndex, ariaLabel, commit, listId, menuClassName, open, options, position, value]);

  return <div className={`${styles.root} ${className ?? ""}`}>
    <button
      ref={triggerRef}
      type="button"
      role="combobox"
      aria-haspopup="listbox"
      aria-expanded={open}
      aria-controls={listId}
      aria-label={ariaLabel}
      data-value={value}
      disabled={disabled}
      className={`${styles.trigger} ${bare ? styles.triggerBare : ""} ${buttonClassName ?? ""}`}
      onClick={() => setOpen((current) => !current)}
      onKeyDown={onTriggerKeyDown}
    >
      {leading ? <span className={styles.leading} aria-hidden="true">{leading}</span> : null}
      <span className={styles.value}>{selectedLabel}</span>
      <ChevronDown size={14} className={`${styles.chevron} ${open ? styles.chevronOpen : ""}`} aria-hidden="true" />
    </button>
    {menu}
  </div>;
}

function parseTheme(theme: string): Record<string, string> {
  const style: Record<string, string> = {};
  for (const declaration of theme.split(";")) {
    const index = declaration.indexOf(":");
    if (index <= 0) continue;
    style[declaration.slice(0, index).trim()] = declaration.slice(index + 1).trim();
  }
  return style;
}
