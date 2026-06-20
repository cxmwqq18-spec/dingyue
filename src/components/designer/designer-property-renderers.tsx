"use client";

import { type ReactNode } from "react";
import { FieldEditor } from "@/components/designer/field-editor-registry";
import { blockSchemaDisplayLabel } from "@/components/designer/designer-metadata";
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
  GlobalSettingsNodeDefinition
} from "@/components/designer/designer-types";
import type { FieldOptions } from "@/components/designer/field-editor-types";
import type {
  SectionBlockInstance,
  SectionInstance,
  Site,
  ThemeBlockSchema,
  ThemeFieldSchema,
  ThemeSectionSchema,
  ThemeSettings,
  ThemeSettingValue
} from "@/lib/types";

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

  if (field.kind === "color") {
    return (
      <PropertyField hint={field.hint} key={field.id} label={field.label}>
        <PropertyColorInput
          onChange={(value) => handlers.updateThemeColor(field.themeKey, value)}
          value={themeSettings.colors[field.themeKey]}
        />
      </PropertyField>
    );
  }

  if (field.kind === "font") {
    return (
      <PropertyField hint={field.hint} key={field.id} label={field.label}>
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
      <PropertyField hint={field.hint} key={field.id} label={field.label}>
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
      <PropertyField hint={field.hint} key={field.id} label={field.label}>
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
      <PropertyField hint={field.hint} key={field.id} label={field.label}>
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
      <PropertyInlineField hint={field.hint} key={field.id} label={field.label}>
        <button
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
    <PropertyField hint={field.hint} key={field.id} label={field.label}>
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
  settingLinkString
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
}) {
  return (
    <>
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
          value={themeSettings.saasSettingsCurrent?.[field.id]}
        />
      ))}
    </>
  );
}

export function BlockFields({
  fields,
  values,
  fieldOptions,
  site,
  onChange,
  actionRow
}: {
  fields: ThemeFieldSchema[];
  values: Record<string, ThemeSettingValue>;
  fieldOptions: FieldOptions;
  site: Site;
  onChange: (field: ThemeFieldSchema, value: string) => void;
  actionRow?: ReactNode;
}) {
  return (
    <>
      {fields.map((field, index) => (
        <FieldEditor
          field={field}
          key={`${field.id}_${index}`}
          onChange={(value) => onChange(field, value)}
          options={fieldOptions}
          site={site}
          value={values[field.id]}
        />
      ))}
      {actionRow}
    </>
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
  onAddBlock
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

  return (
    <>
      <BlockFields fieldOptions={fieldOptions} fields={sectionSchema.settings} onChange={onChange} site={site} values={section.settings} />
      {sectionSchema.blocks?.length && onAddBlock ? (
        <PropertyBlockLibrary
          items={sectionSchema.blocks.map((blockSchema) => ({
            key: blockSchema.type,
            label: blockSchemaDisplayLabel(blockSchema)
          }))}
          onAdd={(key) => {
            const blockSchema = sectionSchema.blocks?.find((item) => item.type === key);
            if (blockSchema) onAddBlock(blockSchema);
          }}
          title="子块库"
        />
      ) : null}
      {sectionActionRow}
    </>
  );
}

export function GlobalSectionFields({
  section,
  sectionSchema,
  fieldOptions,
  site,
  onChange,
  onAddBlock
}: {
  section: SectionInstance;
  sectionSchema: ThemeSectionSchema;
  fieldOptions: FieldOptions;
  site: Site;
  onChange: (field: ThemeFieldSchema, value: string) => void;
  onAddBlock?: (blockSchema: ThemeBlockSchema) => void;
}) {
  return (
    <>
      <BlockFields
        fieldOptions={fieldOptions}
        fields={sectionSchema.settings}
        onChange={onChange}
        site={site}
        values={section.settings}
      />
      {sectionSchema.blocks?.length && onAddBlock ? (
        <PropertyBlockLibrary
          items={sectionSchema.blocks.map((blockSchema) => ({
            key: blockSchema.type,
            label: blockSchemaDisplayLabel(blockSchema)
          }))}
          onAdd={(key) => {
            const blockSchema = sectionSchema.blocks?.find((item) => item.type === key);
            if (blockSchema) onAddBlock(blockSchema);
          }}
          title="全局子块库"
        />
      ) : null}
    </>
  );
}
