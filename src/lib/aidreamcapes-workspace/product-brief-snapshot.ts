import { WorkspaceError, type ConfirmedProductBriefField, type ProductBriefConfidence, type ProductBriefSnapshot, type UnconfirmedProductBriefPrice } from "./types";

const MAX_URL_LENGTH = 2_048;
const MAX_SOURCE_LABEL_LENGTH = 120;
const MAX_TITLE_LENGTH = 180;
const MAX_DESCRIPTION_LENGTH = 2_000;
const MAX_PRICE_LENGTH = 32;
const MAX_CURRENCY_LENGTH = 12;
const CONFIDENCES = new Set<ProductBriefConfidence>(["high", "medium", "low"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function invalid(field: string): never {
  throw new WorkspaceError("product_brief_invalid", 400, { field });
}

function httpsUrl(value: unknown, field: string): string {
  if (typeof value !== "string" || value.length > MAX_URL_LENGTH) return invalid(field);
  let parsed: URL;
  try { parsed = new URL(value); } catch { return invalid(field); }
  if (parsed.protocol !== "https:" || !parsed.hostname || parsed.username || parsed.password || parsed.hash) return invalid(field);
  return parsed.toString();
}

function boundedText(value: unknown, field: string, maxLength: number): string {
  if (typeof value !== "string") return invalid(field);
  const cleaned = value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
  if (!cleaned || cleaned.length > maxLength) return invalid(field);
  return cleaned;
}

function confidence(value: unknown, field: string): ProductBriefConfidence {
  if (typeof value !== "string" || !CONFIDENCES.has(value as ProductBriefConfidence)) return invalid(field);
  return value as ProductBriefConfidence;
}

function confirmedField<T extends string>(
  value: unknown,
  field: string,
  maxLength: number,
): ConfirmedProductBriefField<T> | null {
  if (value === null) return null;
  if (!isRecord(value) || value.confirmed !== false) return invalid(field);
  return {
    value: boundedText(value.value, `${field}.value`, maxLength) as T,
    sourceUrl: httpsUrl(value.sourceUrl, `${field}.sourceUrl`),
    sourceLabel: boundedText(value.sourceLabel, `${field}.sourceLabel`, MAX_SOURCE_LABEL_LENGTH),
    confidence: confidence(value.confidence, `${field}.confidence`),
    userConfirmed: true,
  };
}

function unconfirmedPrice(value: unknown): UnconfirmedProductBriefPrice | null {
  if (value === null) return null;
  if (!isRecord(value) || value.confirmed !== false || !isRecord(value.value)) return invalid("possiblePrice");
  const amount = boundedText(value.value.amount, "possiblePrice.amount", MAX_PRICE_LENGTH);
  if (!/^[\p{Sc}\p{L}\p{N}.,\s()+\-/–]+$/u.test(amount)) return invalid("possiblePrice.amount");
  let currency: string | undefined;
  if (value.value.currency !== undefined) {
    currency = boundedText(value.value.currency, "possiblePrice.currency", MAX_CURRENCY_LENGTH);
    if (!/^[\p{Sc}\p{L}]{1,12}$/u.test(currency)) return invalid("possiblePrice.currency");
  }
  return {
    amount,
    ...(currency ? { currency } : {}),
    sourceUrl: httpsUrl(value.sourceUrl, "possiblePrice.sourceUrl"),
    sourceLabel: boundedText(value.sourceLabel, "possiblePrice.sourceLabel", MAX_SOURCE_LABEL_LENGTH),
    confidence: confidence(value.confidence, "possiblePrice.confidence"),
    userConfirmed: false,
  };
}

/** Convert the preview callback payload into a small, immutable task snapshot. */
export function normalizeConfirmedProductBrief(value: unknown): ProductBriefSnapshot {
  if (!isRecord(value) || value.selectionConfirmed !== true || value.priceConfirmed !== false || value.reviewRequired !== true) {
    throw new WorkspaceError("product_brief_confirmation_required", 400);
  }
  if (typeof value.customerConfirmedAt !== "string" || value.customerConfirmedAt.length > 64 || !Number.isFinite(Date.parse(value.customerConfirmedAt))) {
    throw new WorkspaceError("product_brief_confirmation_required", 400);
  }
  const title = confirmedField<string>(value.title, "title", MAX_TITLE_LENGTH);
  const description = confirmedField<string>(value.description, "description", MAX_DESCRIPTION_LENGTH);
  return {
    sourceUrl: httpsUrl(value.sourceUrl, "sourceUrl"),
    fetchedPageUrl: httpsUrl(value.fetchedPageUrl, "fetchedPageUrl"),
    title,
    description,
    possiblePrice: unconfirmedPrice(value.possiblePrice),
    userConfirmed: true,
    confirmedAt: new Date(value.customerConfirmedAt).toISOString(),
  };
}
