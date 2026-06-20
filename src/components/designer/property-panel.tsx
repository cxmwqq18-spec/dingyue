"use client";

import type { HTMLAttributes, ReactNode } from "react";
import { ArrowLeft, Plus } from "lucide-react";

export function PropertyPanelHeader({
  modeLabel,
  title,
  subtitle,
  onBack,
  backLabel
}: {
  modeLabel: string;
  title: string;
  subtitle?: string;
  onBack?: () => void;
  backLabel?: string;
}) {
  return (
    <div
      className="widget_back flex h-[56px] shrink-0 items-center border-b border-[#c4c7cc] bg-white px-0 text-[#212121]"
      aria-hidden={!onBack}
      data-designer-layout="saas-property-header"
    >
      {onBack ? (
        <button
          aria-label={backLabel ?? "返回上一级"}
          className="ml-2 grid h-9 w-9 shrink-0 place-items-center rounded-[4px] text-[#212121] transition hover:bg-[#e5e7ea]"
          onClick={onBack}
          type="button"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={1.8} />
        </button>
      ) : (
        <span className="block h-9 w-3 shrink-0" aria-hidden="true" />
      )}
      <div className="grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-4">
        <div className="min-w-0">
          <h3 className="truncate text-[16px] font-medium leading-5 text-[#212121]">{title}</h3>
          {subtitle ? <p className="mt-0.5 truncate text-[11px] leading-4 text-[#7c8087]">{subtitle}</p> : null}
        </div>
        {modeLabel ? <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.08em] text-[#909294]">{modeLabel}</span> : null}
      </div>
    </div>
  );
}

function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export function PropertyPanelBody({
  children,
  className,
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
}) {
  return (
    <div
      className={cx("widget_settings min-h-0 flex-1 overflow-y-auto bg-white text-[#212121]", className)}
      data-designer-layout="saas-property-body"
      {...props}
    >
      {children}
    </div>
  );
}

export function PropertyField({
  label,
  hint,
  children
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="ant-form-item widget-formitem text-left" data-designer-layout="saas-property-field">
      <div className="ant-form-item-label mb-2 leading-5">
        <label className="widget_label text-sm text-[#212121]">{label}</label>
      </div>
      <div className="ant-form-item-control-wrapper">
        <div className="ant-form-item-control">
          <div className="widget-formitem__control ant-form-item-children">{children}</div>
        </div>
      </div>
      {hint ? <p className="widget_info mt-1 text-xs leading-5 text-[#7c8087]">{hint}</p> : null}
    </div>
  );
}

export function PropertyInlineField({
  label,
  hint,
  children
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="ant-form-item widget-formitem widget-formitem-fix text-left" data-designer-layout="saas-inline-property-field">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <label className="widget_label text-sm text-[#212121]">{label}</label>
        </div>
        <div className="shrink-0">{children}</div>
      </div>
      {hint ? <p className="widget_info mt-1 text-xs leading-5 text-[#7c8087]">{hint}</p> : null}
    </div>
  );
}

export function PropertyColorInput({
  value,
  onChange
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex gap-2">
      <input
        className="h-9 w-11 rounded-[2px] border border-[#c4c7cc] bg-white p-1"
        onChange={(event) => onChange(event.target.value)}
        type="color"
        value={value}
      />
      <input
        className="ant-input min-w-0 flex-1 rounded-[2px] border border-[#c4c7cc] bg-white px-[9px] py-1 text-sm leading-8 text-[#212121]"
        onChange={(event) => onChange(event.target.value)}
        value={value}
      />
    </div>
  );
}

export function PropertySelectInput({
  value,
  options,
  onChange
}: {
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <select
      className="ant-input w-full rounded-[2px] border border-[#c4c7cc] bg-white px-[9px] py-2 text-sm text-[#212121] outline-none transition focus:border-[#479dff]"
      onChange={(event) => onChange(event.target.value)}
      value={value}
    >
      {options.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  );
}

export function PropertyTextareaInput({
  value,
  minHeightClassName = "min-h-24",
  onChange
}: {
  value: string;
  minHeightClassName?: string;
  onChange: (value: string) => void;
}) {
  return (
    <textarea
      className={`${minHeightClassName} ant-input w-full rounded-[2px] border border-[#c4c7cc] bg-white px-[9px] py-2 text-sm leading-6 text-[#212121] outline-none transition focus:border-[#479dff]`}
      onChange={(event) => onChange(event.target.value)}
      value={value}
    />
  );
}

export function PropertyRangeInput({
  value,
  min,
  max,
  onChange
}: {
  value: number;
  min: number;
  max: number;
  onChange: (value: string) => void;
}) {
  return (
    <div className="grid gap-2" data-designer-field-type="saas-range-slider">
      <div className="flex items-center justify-between gap-3 text-xs text-[#7c8087]">
        <span>{min}</span>
        <span className="font-mono text-[#212121]">{value}</span>
        <span>{max}</span>
      </div>
      <input
        className="w-full accent-[#f4a719]"
        max={max}
        min={min}
        onChange={(event) => onChange(event.target.value)}
        type="range"
        value={value}
      />
      <input
        className="ant-input w-full rounded-[2px] border border-[#c4c7cc] bg-white px-[9px] py-1 text-sm leading-8 text-[#212121] outline-none transition focus:border-[#479dff]"
        onChange={(event) => onChange(event.target.value)}
        type="number"
        value={value}
      />
    </div>
  );
}

export function PropertyActionRow({
  onMoveUp,
  onMoveDown,
  onDelete,
  children
}: {
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete: () => void;
  children?: ReactNode;
}) {
  const actionClass = "inline-flex h-8 items-center rounded-[8px] border border-[#cfd4da] bg-white px-2.5 text-xs font-medium text-[#17181a] transition hover:border-[#479dff] hover:text-[#479dff] active:scale-[0.98]";
  return (
    <div
      className="block__remove sticky bottom-0 z-10 flex min-h-[56px] w-full items-center gap-1 border-t border-[#c4c7cc] bg-white px-5 py-2 text-sm font-medium text-[#212121]"
      data-designer-layout="saas-property-actions"
    >
      <div className="flex items-center gap-0.5">
        <button className={actionClass} data-designer-action="move-up" onClick={onMoveUp} type="button">
          上移
        </button>
        <button className={actionClass} data-designer-action="move-down" onClick={onMoveDown} type="button">
          下移
        </button>
        {children}
        <button className={actionClass} data-designer-action="delete-selected" onClick={onDelete} type="button">
          删除
        </button>
      </div>
    </div>
  );
}

export function PropertyBlockLibrary({
  title,
  items,
  onAdd
}: {
  title: string;
  items: Array<{ key: string; label: string }>;
  onAdd: (key: string) => void;
}) {
  return (
    <div className="ant-form-item property-block-library px-0 pb-[10px]">
      <div className="widget__header text-sm font-medium text-[#383838]">{title}</div>
      <div className="grid gap-0 px-0">
        {items.map((item) => (
          <button
          className="add_47ab flex min-h-10 w-full items-center rounded-[2px] px-2 py-2 text-left text-sm leading-5 text-[#f4a719] transition hover:bg-[#f7f8fb]"
            key={item.key}
            onClick={() => onAdd(item.key)}
            type="button"
          >
            <span className="inline-flex h-5 w-5 items-center justify-center text-current">
              <Plus className="h-3.5 w-3.5" />
            </span>
            <span className="pl-2 font-semibold">添加{item.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
