"use client";

import type { ThemeFieldSchema } from "@/lib/types";

export type PropertyFieldGroupKey = "content" | "actions" | "media" | "style" | "advanced" | "blocks";

export const PROPERTY_FIELD_GROUP_ORDER: PropertyFieldGroupKey[] = [
  "content",
  "actions",
  "media",
  "style",
  "advanced",
  "blocks"
];

export const PROPERTY_FIELD_GROUP_LABELS: Record<PropertyFieldGroupKey, string> = {
  content: "内容",
  actions: "按钮/链接",
  media: "媒体",
  style: "样式",
  advanced: "高级",
  blocks: "子块"
};

const MEDIA_TYPES = new Set(["image_picker", "media_asset", "video_url"]);
const ACTION_TYPES = new Set(["url", "link_list", "menu", "product", "price", "ai_app", "collection", "page", "blog"]);
const STYLE_TYPES = new Set(["checkbox", "color", "range", "font_picker", "select", "custom_select"]);
const ADVANCED_TYPES = new Set(["header", "paragraph", "popover", "html"]);

const MEDIA_FIELD_PATTERN = /(image|media|video|avatar|poster|logo|photo|picture|background|cover|thumbnail|ogimage|src)/i;
const ACTION_FIELD_PATTERN = /(href|url|link|cta|button|action|checkout|menu|nav|aiapp|price)/i;
const CONTENT_FIELD_PATTERN = /(title|headline|heading|subtitle|subheading|description|body|copy|text|content|eyebrow|kicker|label|caption|quote|review|faq|question|answer|metric|stat|name|author|tagline|meta|badge)/i;
const STYLE_FIELD_PATTERN = /(layout|style|tone|theme|color|scheme|align|position|placement|columns|grid|show|hide|visible|enabled|speed|duration|delay|source|tab|defaulttab|tag|tags|category|group|kind|variant|size|radius|spacing|padding|margin|level|mode|filter)/i;
const ADVANCED_FIELD_PATTERN = /(anchor|html|code|custom|script|fallback|debug|raw)/i;

function fieldSearchText(field: ThemeFieldSchema) {
  return `${field.id} ${field.label} ${field.helpText ?? ""} ${field.source ?? ""}`;
}

export function propertyFieldGroupFor(field: ThemeFieldSchema): PropertyFieldGroupKey {
  const searchText = fieldSearchText(field);
  if (ADVANCED_TYPES.has(field.type) || ADVANCED_FIELD_PATTERN.test(searchText)) return "advanced";
  if (MEDIA_TYPES.has(field.type) || MEDIA_FIELD_PATTERN.test(searchText)) return "media";
  if (ACTION_TYPES.has(field.type) || ACTION_FIELD_PATTERN.test(searchText)) return "actions";
  if (CONTENT_FIELD_PATTERN.test(searchText)) return "content";
  if (STYLE_TYPES.has(field.type) || STYLE_FIELD_PATTERN.test(searchText)) return "style";
  return "advanced";
}

export function isLocatablePropertyField(field: ThemeFieldSchema) {
  return !["header", "paragraph", "popover", "image_picker", "media_asset", "video_url", "color", "range", "font_picker"].includes(field.type);
}

export function isEditableTextPropertyField(field: ThemeFieldSchema) {
  if (!isLocatablePropertyField(field)) return false;
  if (["text", "textarea", "richtext", "html"].includes(field.type)) return true;
  return propertyFieldGroupFor(field) === "content";
}
