"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { FieldEditor } from "@/components/designer/field-editor-registry";
import { blockSchemaDisplayLabel } from "@/components/designer/designer-metadata";
import {
  PROPERTY_FIELD_GROUP_LABELS,
  PROPERTY_FIELD_GROUP_ORDER,
  propertyFieldGroupFor,
  type PropertyFieldGroupKey
} from "@/components/designer/designer-property-groups";
import { DesignerModeTabs } from "@/components/designer/designer-sidebar-primitives";
import { readThemeFieldValue, resolveThemeBlockSchema } from "@/lib/section-schema";
import {
  PropertyActionRow,
  PropertyBlockLibrary,
  PropertyColorInput,
  PropertyField,
  PropertyInlineField,
  PropertyRangeInput,
  PropertySelectInput,
  PropertyTextareaInput
} from "@/components/designer/property-panel";
import type {
  GlobalLocalField,
  GlobalSettingsNodeDefinition,
  PropertyFieldFocusRequest
} from "@/components/designer/designer-types";
import type { FieldOptions } from "@/components/designer/field-editor-types";
import type {
  SectionInstance,
  Site,
  ThemeBlockSchema,
  ThemeFieldSchema,
  ThemeSectionSchema,
  ThemeSettings,
  ThemeSettingValue
} from "@/lib/types";

type FieldEntry = {
  field: ThemeFieldSchema;
  index: number;
};

function cssAttrValue(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function usePropertyFieldFocus({
  activeGroupKey,
  containerRef,
  focusRequest,
  scopeKey
}: {
  activeGroupKey?: string;
  containerRef: React.RefObject<HTMLDivElement | null>;
  focusRequest?: PropertyFieldFocusRequest;
  scopeKey: string;
}) {
  useEffect(() => {
    if (!focusRequest || focusRequest.scopeKey !== scopeKey || !focusRequest.fieldId) return;
    let firstFrame = 0;
    let secondFrame = 0;
    let highlightTimer = 0;
    firstFrame = window.requestAnimationFrame(() => {
      secondFrame = window.requestAnimationFrame(() => {
        const container = containerRef.current;
        if (!container) return;
        const fieldNode = container.querySelector<HTMLElement>(`[data-designer-field-id="${cssAttrValue(focusRequest.fieldId)}"]`);
        if (!fieldNode) return;
        fieldNode.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
        const focusTarget = fieldNode.querySelector<HTMLElement>(
          'textarea:not([disabled]), input:not([type="hidden"]):not([disabled]), select:not([disabled]), button[role="switch"]:not([disabled]), [contenteditable="true"]'
        );
        focusTarget?.focus({ preventScroll: true });
        fieldNode.setAttribute("data-designer-field-focus", "true");
        fieldNode.setAttribute("data-designer-field-focus-request-id", String(focusRequest.requestId));
        highlightTimer = window.setTimeout(() => {
          fieldNode.removeAttribute("data-designer-field-focus");
        }, 1600);
      });
    });
    return () => {
      if (firstFrame) window.cancelAnimationFrame(firstFrame);
      if (secondFrame) window.cancelAnimationFrame(secondFrame);
      if (highlightTimer) window.clearTimeout(highlightTimer);
    };
  }, [activeGroupKey, containerRef, focusRequest, scopeKey]);
}

function PropertyFieldFocusStyles() {
  return (
    <style
      data-designer-property-field-focus=""
      dangerouslySetInnerHTML={{
        __html: `
          [data-designer-field-focus="true"] {
            border-radius: 8px;
            outline: 2px solid rgba(47, 111, 237, 0.82);
            outline-offset: 2px;
            background: rgba(47, 111, 237, 0.06);
            box-shadow: 0 0 0 5px rgba(47, 111, 237, 0.1);
            transition: background 220ms ease, box-shadow 220ms ease, outline-color 220ms ease;
          }
        `
      }}
    />
  );
}

function GroupedPropertyFields({
  fields,
  values,
  fieldOptions,
  site,
  onChange,
  actionRow,
  blockLibrary,
  scopeKey,
  focusRequest
}: {
  fields: ThemeFieldSchema[];
  values: Record<string, ThemeSettingValue>;
  fieldOptions: FieldOptions;
  site: Site;
  onChange: (field: ThemeFieldSchema, value: string) => void;
  actionRow?: ReactNode;
  blockLibrary?: ReactNode;
  scopeKey: string;
  focusRequest?: PropertyFieldFocusRequest;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const fieldGroups = useMemo(() => {
    const groups = new Map<PropertyFieldGroupKey, FieldEntry[]>();
    fields.forEach((field, index) => {
      const groupKey = propertyFieldGroupFor(field);
      const current = groups.get(groupKey) ?? [];
      current.push({ field, index });
      groups.set(groupKey, current);
    });
    return groups;
  }, [fields]);
  const fieldGroupById = useMemo(() => {
    const groups = new Map<string, PropertyFieldGroupKey>();
    fieldGroups.forEach((entries, groupKey) => {
      entries.forEach(({ field }) => groups.set(field.id, groupKey));
    });
    return groups;
  }, [fieldGroups]);
  const visibleGroupKeys = useMemo(() => {
    return PROPERTY_FIELD_GROUP_ORDER.filter((groupKey) => {
      if ((fieldGroups.get(groupKey)?.length ?? 0) > 0) return true;
      if (groupKey === "advanced" && actionRow) return true;
      if (groupKey === "blocks" && blockLibrary) return true;
      return false;
    });
  }, [actionRow, blockLibrary, fieldGroups]);
  const visibleGroupKeyHash = visibleGroupKeys.join("|");
  const [activeGroupKey, setActiveGroupKey] = useState<PropertyFieldGroupKey>(visibleGroupKeys[0] ?? "content");

  useEffect(() => {
    if (!visibleGroupKeys.includes(activeGroupKey)) {
      setActiveGroupKey(visibleGroupKeys[0] ?? "content");
    }
  }, [activeGroupKey, visibleGroupKeyHash, visibleGroupKeys]);

  useEffect(() => {
    if (!focusRequest || focusRequest.scopeKey !== scopeKey) return;
    const nextGroupKey = fieldGroupById.get(focusRequest.fieldId);
    if (nextGroupKey && nextGroupKey !== activeGroupKey) setActiveGroupKey(nextGroupKey);
  }, [activeGroupKey, fieldGroupById, focusRequest, scopeKey]);

  const activeKey = visibleGroupKeys.includes(activeGroupKey) ? activeGroupKey : visibleGroupKeys[0] ?? "content";
  const activeEntries = fieldGroups.get(activeKey) ?? [];
  usePropertyFieldFocus({ activeGroupKey: activeKey, containerRef, focusRequest, scopeKey });

  return (
    <div
      data-designer-field-group-active={activeKey}
      data-designer-field-scope-key={scopeKey}
      data-designer-layout="saas-property-field-groups"
      ref={containerRef}
    >
      <PropertyFieldFocusStyles />
      {visibleGroupKeys.length > 1 ? (
        <DesignerModeTabs
          active={activeKey}
          className="border-b border-[#e3e6eb] bg-white px-3 py-3"
          items={visibleGroupKeys.map((groupKey) => ({
            key: groupKey,
            label: PROPERTY_FIELD_GROUP_LABELS[groupKey]
          }))}
          onValueChange={setActiveGroupKey}
          surface="bare"
          tone="pill"
        />
      ) : null}
      <div className="grid gap-0 px-3 py-3" data-designer-field-group-panel={activeKey}>
        {activeEntries.map(({ field, index }) => (
          <FieldEditor
            field={field}
            key={`${field.id}_${index}`}
            onChange={(value) => onChange(field, value)}
            options={fieldOptions}
            site={site}
            value={readThemeFieldValue(values, field)}
          />
        ))}
        {activeKey === "advanced" ? actionRow : null}
        {activeKey === "blocks" ? blockLibrary : null}
      </div>
    </div>
  );
}

function renderLocalGlobalField(
  field: GlobalLocalField,
  themeSettings: ThemeSettings,
  handlers: {
    updateThemeColor: (key: keyof ThemeSettings["colors"], value: string) => void;
    updateThemeTypography: (key: keyof ThemeSettings["typography"], value: string) => void;
    updateThemeRadii: (key: keyof ThemeSettings["radii"], value: string) => void;
    updateThemeLinks: (key: keyof ThemeSettings["navigation"], value: string) => void;
    updateThemeSeo: (field: GlobalLocalField, value: string | boolean) => void;
    settingLinkString: (links: ThemeSettings["navigation"]["headerLinks"]) => string;
  }
) {
  const textInputClass = "ant-input w-full rounded-[2px] border border-[#c4c7cc] bg-white px-[9px] py-1 text-sm leading-8 text-[#212121] outline-none transition focus:border-[#479dff]";
  const fieldProps = {
    "data-designer-field-id": field.id,
    "data-designer-field-type": field.kind
  };

  if (field.kind === "color") {
    return (
      <PropertyField hint={field.hint} key={field.id} label={field.label} {...fieldProps}>
        <PropertyColorInput
          onChange={(value) => handlers.updateThemeColor(field.themeKey, value)}
          value={themeSettings.colors[field.themeKey]}
        />
      </PropertyField>
    );
  }

  if (field.kind === "font") {
    return (
      <PropertyField hint={field.hint} key={field.id} label={field.label} {...fieldProps}>
        <PropertySelectInput
          onChange={(value) => handlers.updateThemeTypography(field.themeKey, value)}
          options={field.options ?? ["Satoshi", "Geist", "Outfit", "Cabinet Grotesk", "Geist Mono"]}
          value={themeSettings.typography[field.themeKey]}
        />
      </PropertyField>
    );
  }

  if (field.kind === "range") {
    return (
      <PropertyField hint={field.hint} key={field.id} label={field.label} {...fieldProps}>
        <PropertyRangeInput
          max={field.max}
          min={field.min}
          onChange={(value) => handlers.updateThemeRadii(field.themeKey, value)}
          value={themeSettings.radii[field.themeKey]}
        />
      </PropertyField>
    );
  }

  if (field.kind === "seo_text") {
    return (
      <PropertyField hint={field.hint} key={field.id} label={field.label} {...fieldProps}>
        <input
          className={textInputClass}
          onChange={(event) => handlers.updateThemeSeo(field, event.target.value)}
          value={themeSettings.seo?.[field.themeKey] ?? ""}
        />
      </PropertyField>
    );
  }

  if (field.kind === "seo_textarea") {
    return (
      <PropertyField hint={field.hint} key={field.id} label={field.label} {...fieldProps}>
        <PropertyTextareaInput
          minHeightClassName={field.minHeightClassName}
          onChange={(value) => handlers.updateThemeSeo(field, value)}
          value={themeSettings.seo?.[field.themeKey] ?? ""}
        />
      </PropertyField>
    );
  }

  if (field.kind === "seo_checkbox") {
    const checked = Boolean(themeSettings.seo?.robots?.[field.themeKey]);
    return (
      <PropertyInlineField hint={field.hint} key={field.id} label={field.label} {...fieldProps}>
        <button
          aria-label={field.label || field.id}
          aria-checked={checked}
          className={`ant-switch flex h-5 w-11 items-center rounded-full border p-0.5 transition ${checked ? "ant-switch-checked border-[#f4a719] bg-[#f4a719]" : "border-[#e6e6e6] bg-white"}`}
          onClick={(event) => {
            event.preventDefault();
            handlers.updateThemeSeo(field, !checked);
          }}
          role="switch"
          type="button"
        >
          <span className={`h-[18px] w-[18px] rounded-full bg-white shadow-sm transition ${checked ? "translate-x-[22px]" : "translate-x-0"}`} />
        </button>
      </PropertyInlineField>
    );
  }

  return (
    <PropertyField hint={field.hint} key={field.id} label={field.label} {...fieldProps}>
      <PropertyTextareaInput
        minHeightClassName={field.minHeightClassName}
        onChange={(value) => handlers.updateThemeLinks(field.themeKey, value)}
        value={handlers.settingLinkString(themeSettings.navigation[field.themeKey])}
      />
    </PropertyField>
  );
}

export function GlobalSettingsFields({
  activeGlobalNode,
  activeGlobalNodeFields,
  themeSettings,
  fieldOptions,
  site,
  onUpdateSaasGlobalSetting,
  updateThemeColor,
  updateThemeTypography,
  updateThemeRadii,
  updateThemeLinks,
  updateThemeSeo,
  settingLinkString,
  scopeKey,
  focusRequest
}: {
  activeGlobalNode: GlobalSettingsNodeDefinition;
  activeGlobalNodeFields: ThemeFieldSchema[];
  themeSettings: ThemeSettings;
  fieldOptions: FieldOptions;
  site: Site;
  onUpdateSaasGlobalSetting: (field: ThemeFieldSchema, value: string) => void;
  updateThemeColor: (key: keyof ThemeSettings["colors"], value: string) => void;
  updateThemeTypography: (key: keyof ThemeSettings["typography"], value: string) => void;
  updateThemeRadii: (key: keyof ThemeSettings["radii"], value: string) => void;
  updateThemeLinks: (key: keyof ThemeSettings["navigation"], value: string) => void;
  updateThemeSeo: (field: GlobalLocalField, value: string | boolean) => void;
  settingLinkString: (links: ThemeSettings["navigation"]["headerLinks"]) => string;
  scopeKey: string;
  focusRequest?: PropertyFieldFocusRequest;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  usePropertyFieldFocus({ containerRef, focusRequest, scopeKey });

  return (
    <div data-designer-field-scope-key={scopeKey} ref={containerRef}>
      <PropertyFieldFocusStyles />
      {activeGlobalNode.localFields?.map((field) =>
        renderLocalGlobalField(field, themeSettings, {
          updateThemeColor,
          updateThemeTypography,
          updateThemeRadii,
          updateThemeLinks,
          updateThemeSeo,
          settingLinkString
        })
      )}
      {activeGlobalNodeFields.map((field, index) => (
        <FieldEditor
          field={field}
          key={`${activeGlobalNode.id}_${field.id}_${index}`}
          onChange={(value) => onUpdateSaasGlobalSetting(field, value)}
          options={fieldOptions}
          site={site}
          value={readThemeFieldValue(themeSettings.saasSettingsCurrent, field)}
        />
      ))}
    </div>
  );
}

export function BlockFields({
  fields,
  values,
  fieldOptions,
  site,
  onChange,
  actionRow,
  scopeKey,
  focusRequest
}: {
  fields: ThemeFieldSchema[];
  values: Record<string, ThemeSettingValue>;
  fieldOptions: FieldOptions;
  site: Site;
  onChange: (field: ThemeFieldSchema, value: string) => void;
  actionRow?: ReactNode;
  scopeKey: string;
  focusRequest?: PropertyFieldFocusRequest;
}) {
  return (
    <GroupedPropertyFields
      actionRow={actionRow}
      fieldOptions={fieldOptions}
      fields={fields}
      focusRequest={focusRequest}
      onChange={onChange}
      scopeKey={scopeKey}
      site={site}
      values={values}
    />
  );
}

export function SectionFields({
  section,
  sectionSchema,
  fieldOptions,
  site,
  onChange,
  onDelete,
  onMoveUp,
  onMoveDown,
  onDuplicate,
  onAddBlock,
  scopeKey,
  focusRequest
}: {
  section: SectionInstance;
  sectionSchema: ThemeSectionSchema;
  fieldOptions: FieldOptions;
  site: Site;
  onChange: (field: ThemeFieldSchema, value: string) => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDuplicate?: () => void;
  onAddBlock?: (blockSchema: ThemeBlockSchema) => void;
  scopeKey: string;
  focusRequest?: PropertyFieldFocusRequest;
}) {
  const sectionActionRow = (
    <PropertyActionRow onDelete={onDelete} onMoveDown={onMoveDown} onMoveUp={onMoveUp}>
      {onDuplicate ? (
        <button className="inline-flex h-8 items-center rounded-[8px] border border-[#cfd4da] bg-white px-2.5 text-xs font-medium text-[#17181a] transition hover:border-[#479dff] hover:text-[#479dff] active:scale-[0.98]" data-designer-action="duplicate-section" onClick={onDuplicate} type="button">
          复制
        </button>
      ) : null}
    </PropertyActionRow>
  );
  const blockLibrary = sectionSchema.blocks?.length && onAddBlock ? (
    <PropertyBlockLibrary
      items={sectionSchema.blocks.map((blockSchema) => ({
        key: blockSchema.type,
        label: blockSchemaDisplayLabel(blockSchema)
      }))}
      onAdd={(key) => {
        const blockSchema = resolveThemeBlockSchema(sectionSchema, key);
        if (blockSchema) onAddBlock(blockSchema);
      }}
      title="子块库"
    />
  ) : null;

  return (
    <GroupedPropertyFields
      actionRow={sectionActionRow}
      blockLibrary={blockLibrary}
      fieldOptions={fieldOptions}
      fields={sectionSchema.settings}
      focusRequest={focusRequest}
      onChange={onChange}
      scopeKey={scopeKey}
      site={site}
      values={section.settings}
    />
  );
}

export function GlobalSectionFields({
  section,
  sectionSchema,
  fieldOptions,
  site,
  onChange,
  onAddBlock,
  scopeKey,
  focusRequest
}: {
  section: SectionInstance;
  sectionSchema: ThemeSectionSchema;
  fieldOptions: FieldOptions;
  site: Site;
  onChange: (field: ThemeFieldSchema, value: string) => void;
  onAddBlock?: (blockSchema: ThemeBlockSchema) => void;
  scopeKey: string;
  focusRequest?: PropertyFieldFocusRequest;
}) {
  const blockLibrary = sectionSchema.blocks?.length && onAddBlock ? (
    <PropertyBlockLibrary
      items={sectionSchema.blocks.map((blockSchema) => ({
        key: blockSchema.type,
        label: blockSchemaDisplayLabel(blockSchema)
      }))}
      onAdd={(key) => {
        const blockSchema = resolveThemeBlockSchema(sectionSchema, key);
        if (blockSchema) onAddBlock(blockSchema);
      }}
      title="全局子块库"
    />
  ) : null;

  return (
    <GroupedPropertyFields
      blockLibrary={blockLibrary}
      fieldOptions={fieldOptions}
      fields={sectionSchema.settings}
      focusRequest={focusRequest}
      onChange={onChange}
      scopeKey={scopeKey}
      site={site}
      values={section.settings}
    />
  );
}
