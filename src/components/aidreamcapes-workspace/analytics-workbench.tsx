"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { customerJsonHeaders } from "@/lib/client-csrf";
import styles from "./analytics-workbench.module.css";

type Provider = "meta_ads" | "tiktok_ads" | "google_ads" | "youtube_ads" | "pinterest_ads" | "snapchat_ads";
type MetricRecord = {
  providerRecordId: string;
  creativeId: string;
  creativeName?: string | null;
  date: string;
  currency: string;
  spend: string;
  impressions: number | string;
  clicks: number | string;
  conversions: number | string;
};
type ImportPayload = { provider: Provider; providerAccountId: string; teamId?: string | null; records: MetricRecord[] };
type MetricValues = {
  spend: string;
  impressions: string;
  clicks: string;
  conversions: string;
  ctr: number | null;
  cpa: string | null;
  currency: string;
};
type AnalyticsSummary = {
  dataAvailable: boolean;
  window: { from: string; to: string; currency: string; timezone: string; inclusive: boolean };
  metrics: MetricValues | null;
  creatives: Array<{
    provider: Provider;
    providerAccountId: string;
    creativeId: string;
    creativeName: string | null;
    recordCount: string;
    metrics: MetricValues;
  }>;
  source: { type: string; origin?: string; recordCount: string | number; providers: Provider[]; accounts: number };
  freshness: { latestImportAt: string; ageSeconds: number } | null;
};
type Filters = { from: string; to: string; currency: string };
type StagedImport = { kind: "csv"; records: MetricRecord[]; filename: string } | { kind: "json"; payload: ImportPayload; filename: string };

const PROVIDERS: Array<{ value: Provider; label: string }> = [
  { value: "meta_ads", label: "Meta Ads" },
  { value: "tiktok_ads", label: "TikTok Ads" },
  { value: "google_ads", label: "Google Ads" },
  { value: "youtube_ads", label: "YouTube Ads" },
  { value: "pinterest_ads", label: "Pinterest Ads" },
  { value: "snapchat_ads", label: "Snapchat Ads" }
];
const IMPORT_ROOT_KEYS = new Set(["provider", "providerAccountId", "teamId", "records"]);
const RECORD_KEYS = new Set(["providerRecordId", "creativeId", "creativeName", "date", "currency", "spend", "impressions", "clicks", "conversions"]);
const CSV_HEADERS = ["providerrecordid", "creativeid", "creativename", "date", "currency", "spend", "impressions", "clicks", "conversions"];
const REQUIRED_CSV_HEADERS = CSV_HEADERS.filter((header) => header !== "creativename");
const LOGIN_HREF = `/site/aidreamcapes/login?next=${encodeURIComponent("/site/aivideosugc/app/create?view=analytics")}`;

function utcToday() {
  return new Date().toISOString().slice(0, 10);
}

function defaultFilters(): Filters {
  const to = utcToday();
  const fromDate = new Date(`${to}T00:00:00.000Z`);
  fromDate.setUTCDate(fromDate.getUTCDate() - 29);
  return { from: fromDate.toISOString().slice(0, 10), to, currency: "USD" };
}

function providerLabel(value: string) {
  return PROVIDERS.find((provider) => provider.value === value)?.label ?? value.replaceAll("_", " ");
}

function parseCsv(text: string): MetricRecord[] {
  const source = text.replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (quoted) {
      if (char === '"' && source[index + 1] === '"') { cell += '"'; index += 1; }
      else if (char === '"') quoted = false;
      else cell += char;
    } else if (char === '"' && cell.length === 0) quoted = true;
    else if (char === ",") { row.push(cell); cell = ""; }
    else if (char === "\n" || char === "\r") {
      if (char === "\r" && source[index + 1] === "\n") index += 1;
      row.push(cell); cell = "";
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
    } else cell += char;
  }
  if (quoted) throw new Error("The CSV contains an unfinished quoted field.");
  row.push(cell);
  if (row.some((value) => value.trim())) rows.push(row);
  if (rows.length < 2) throw new Error("Add a header row and at least one report row.");

  const headers = rows[0].map((header) => header.trim().toLowerCase());
  if (new Set(headers).size !== headers.length || headers.some((header) => !CSV_HEADERS.includes(header))) {
    throw new Error("Use the report columns shown below, with no duplicate or extra columns.");
  }
  if (REQUIRED_CSV_HEADERS.some((header) => !headers.includes(header))) {
    throw new Error("The report needs providerRecordId, creativeId, date, currency, spend, impressions, clicks, and conversions columns.");
  }
  const indexOf = (name: string) => headers.indexOf(name);
  const records = rows.slice(1).map((values, index) => {
    if (values.length !== headers.length) throw new Error(`Report row ${index + 2} has a different number of columns.`);
    const value = (name: string) => values[indexOf(name)]?.trim() ?? "";
    return {
      providerRecordId: value("providerrecordid"),
      creativeId: value("creativeid"),
      ...(indexOf("creativename") >= 0 ? { creativeName: value("creativename") || null } : {}),
      date: value("date"),
      currency: value("currency").toUpperCase(),
      spend: value("spend"),
      impressions: value("impressions"),
      clicks: value("clicks"),
      conversions: value("conversions")
    };
  });
  if (records.length > 250) throw new Error("Import up to 250 report rows at a time.");
  return records;
}

function checkedPayload(value: unknown): ImportPayload {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("The JSON file must contain a report object.");
  const payload = value as Record<string, unknown>;
  if (Object.keys(payload).some((key) => !IMPORT_ROOT_KEYS.has(key))) throw new Error("The JSON report contains fields this importer does not accept.");
  if (typeof payload.provider !== "string" || !PROVIDERS.some((item) => item.value === payload.provider)) throw new Error("Choose one of the supported report platforms.");
  if (typeof payload.providerAccountId !== "string" || !/^[A-Za-z0-9:._-]{1,128}$/.test(payload.providerAccountId)) throw new Error("The report needs a valid account reference.");
  if (payload.teamId !== undefined && payload.teamId !== null && payload.teamId !== "" && (typeof payload.teamId !== "string" || !/^[A-Za-z0-9:._-]{1,160}$/.test(payload.teamId))) throw new Error("The report has an invalid team reference.");
  if (!Array.isArray(payload.records) || payload.records.length < 1 || payload.records.length > 250) throw new Error("Add between 1 and 250 report rows.");
  const records = payload.records.map((entry, index): MetricRecord => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) throw new Error(`Report row ${index + 1} must be an object.`);
    const item = entry as Record<string, unknown>;
    if (Object.keys(item).some((key) => !RECORD_KEYS.has(key))) throw new Error(`Report row ${index + 1} has a field this importer does not accept.`);
    const required = ["providerRecordId", "creativeId", "date", "currency", "spend", "impressions", "clicks", "conversions"];
    if (required.some((key) => !(key in item))) throw new Error(`Report row ${index + 1} is missing a required field.`);
    return item as MetricRecord;
  });
  return {
    provider: payload.provider as Provider,
    providerAccountId: payload.providerAccountId,
    ...(typeof payload.teamId === "string" && payload.teamId ? { teamId: payload.teamId } : {}),
    records
  };
}

function validatePayload(payload: ImportPayload): ImportPayload {
  if (!PROVIDERS.some((item) => item.value === payload.provider)) throw new Error("Choose a report platform.");
  if (!/^[A-Za-z0-9:._-]{1,128}$/.test(payload.providerAccountId)) throw new Error("Enter an account reference using letters, numbers, dots, colons, underscores, or hyphens.");
  if (payload.records.length < 1 || payload.records.length > 250) throw new Error("Import between 1 and 250 report rows.");
  const today = utcToday();
  const recordIds = new Set<string>();
  for (const [index, item] of payload.records.entries()) {
    const row = index + 1;
    if (!/^[A-Za-z0-9:._-]{1,160}$/.test(item.providerRecordId)) throw new Error(`Report row ${row} needs a valid report row ID.`);
    if (recordIds.has(item.providerRecordId)) throw new Error(`Report row ID “${item.providerRecordId}” appears more than once.`);
    recordIds.add(item.providerRecordId);
    if (!/^[A-Za-z0-9:._-]{1,160}$/.test(item.creativeId)) throw new Error(`Report row ${row} needs a valid creative ID.`);
    if (item.creativeName != null && (typeof item.creativeName !== "string" || !item.creativeName.trim() || item.creativeName.trim().length > 160)) throw new Error(`Report row ${row} has a creative name over 160 characters or blank.`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(item.date) || !Number.isFinite(Date.parse(`${item.date}T00:00:00.000Z`)) || new Date(`${item.date}T00:00:00.000Z`).toISOString().slice(0, 10) !== item.date || item.date > today) throw new Error(`Report row ${row} needs a valid date no later than today (UTC).`);
    if (!/^[A-Z]{3}$/.test(item.currency)) throw new Error(`Report row ${row} needs a three-letter uppercase currency code.`);
    if (typeof item.spend !== "string" || !/^(?:0|[1-9]\d{0,14})(?:\.\d{1,3})?$/.test(item.spend)) throw new Error(`Report row ${row} needs spend as a non-negative decimal string.`);
    const count = (value: number | string, label: string) => {
      const raw = String(value);
      if (!/^(?:0|[1-9]\d{0,15})$/.test(raw) || BigInt(raw) > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error(`Report row ${row} needs a valid ${label} count.`);
      return BigInt(raw);
    };
    const impressions = count(item.impressions, "impressions");
    const clicks = count(item.clicks, "clicks");
    count(item.conversions, "conversions");
    if (clicks > impressions) throw new Error(`Report row ${row} has more clicks than impressions.`);
  }
  if (new TextEncoder().encode(JSON.stringify(payload)).byteLength > 120_000) throw new Error("This report is too large. Split it into smaller imports.");
  return payload;
}

function requestErrorMessage(code: string, status: number) {
  if (status === 401 || status === 403) return "Sign in to view and import your private reports.";
  if (status === 503 || /database|storage|schema/i.test(code)) return "Saved reports are temporarily unavailable. Try again in a moment.";
  if (code === "analytics_provider_record_conflict") return "A report row ID already exists with different data. Correct the source or use a unique row ID.";
  if (code === "analytics_duplicate_provider_record_id") return "This report contains duplicate row IDs. Remove the duplicates and try again.";
  if (status === 429) return "There were too many requests. Wait a moment, then try again.";
  return "We couldn’t load or save this report. Check the details and try again.";
}

function dateLabel(value: string) {
  const date = new Date(`${value}T00:00:00.000Z`);
  return new Intl.DateTimeFormat(undefined, { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" }).format(date);
}

function metricNumber(value: string | number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed.toLocaleString() : "—";
}

function rate(value: number | null) {
  return value == null ? "—" : `${value.toFixed(2)}%`;
}

export type AnalyticsWorkbenchProps = { siteId: string; csrfToken?: string; disabled?: boolean };

export function AnalyticsWorkbench({ siteId, csrfToken, disabled = false }: AnalyticsWorkbenchProps) {
  const inputId = useId();
  const [filters, setFilters] = useState<Filters>(() => defaultFilters());
  const [filterDraft, setFilterDraft] = useState<Filters>(filters);
  const [loginHref, setLoginHref] = useState(LOGIN_HREF);
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [busy, setBusy] = useState<"loading" | "importing" | "" | null>("loading");
  const [error, setError] = useState<{ message: string; auth: boolean } | null>(null);
  const [filterError, setFilterError] = useState("");
  const [notice, setNotice] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [importMode, setImportMode] = useState<"csv" | "json" | "manual">("csv");
  const [provider, setProvider] = useState<Provider>("meta_ads");
  const [accountId, setAccountId] = useState("");
  const [staged, setStaged] = useState<StagedImport | null>(null);
  const [fileError, setFileError] = useState("");
  const [manual, setManual] = useState<MetricRecord>(() => ({ providerRecordId: "", creativeId: "", creativeName: "", date: utcToday(), currency: "USD", spend: "", impressions: "", clicks: "", conversions: "" }));
  const requestRoot = useMemo(() => `/api/sites/${encodeURIComponent(siteId)}/aivideosugc/analytics`, [siteId]);

  useEffect(() => {
    const routeRoot = window.location.pathname.replace(/\/app(?:\/create)?\/?$/, "");
    const next = `${routeRoot}/app/create?view=analytics`;
    setLoginHref(`/site/aidreamcapes/login?next=${encodeURIComponent(next)}`);
  }, []);

  useEffect(() => {
    if (siteId !== "site_aidreamcapes") {
      setSummary(null);
      setError({ message: "Analytics is available in the Aidreamcapes workspace.", auth: false });
      setBusy("");
      return;
    }
    const controller = new AbortController();
    const query = new URLSearchParams({ from: filters.from, to: filters.to, currency: filters.currency });
    setBusy("loading");
    setError(null);
    void fetch(`${requestRoot}?${query.toString()}`, { credentials: "same-origin", cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const body = await response.json().catch(() => ({}));
        if (!response.ok) {
          const code = typeof body?.error === "string" ? body.error : "";
          throw Object.assign(new Error(requestErrorMessage(code, response.status)), { status: response.status });
        }
        return body as AnalyticsSummary;
      })
      .then((next) => { if (!controller.signal.aborted) setSummary(next); })
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return;
        const status = typeof reason === "object" && reason && "status" in reason ? Number(reason.status) : 0;
        setError({ message: reason instanceof Error ? reason.message : "We couldn’t load your reports. Try again.", auth: status === 401 || status === 403 });
      })
      .finally(() => { if (!controller.signal.aborted) setBusy(""); });
    return () => controller.abort();
  }, [siteId, requestRoot, filters.from, filters.to, filters.currency, reloadKey]);

  const importQuery = (payloadValue: ImportPayload) => {
    const payload = validatePayload(payloadValue);
    const headers = new Headers(customerJsonHeaders(siteId));
    if (csrfToken) headers.set("x-csrf-token", csrfToken);
    headers.set("Content-Type", "application/json");
    return fetch(`${requestRoot}/events`, {
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
      headers,
      body: JSON.stringify(payload)
    });
  };

  async function handleFile(file?: File) {
    setFileError("");
    setStaged(null);
    setNotice("");
    if (!file) return;
    if (file.size === 0 || file.size > 100_000) { setFileError("Choose a non-empty report file under 100 KB."); return; }
    try {
      const source = await file.text();
      if (importMode === "csv") {
        if (!file.name.toLowerCase().endsWith(".csv") && file.type !== "text/csv") throw new Error("Choose a .csv report file.");
        setStaged({ kind: "csv", records: parseCsv(source), filename: file.name });
      } else {
        if (!file.name.toLowerCase().endsWith(".json") && file.type !== "application/json") throw new Error("Choose a .json report file.");
        setStaged({ kind: "json", payload: checkedPayload(JSON.parse(source)), filename: file.name });
      }
    } catch (reason) {
      setFileError(reason instanceof Error ? reason.message : "This report file could not be read.");
    }
  }

  function makePayload(): ImportPayload {
    if (importMode === "manual") return { provider, providerAccountId: accountId.trim(), records: [{ ...manual, currency: manual.currency.trim().toUpperCase(), creativeName: manual.creativeName?.trim() || null }] };
    if (!staged || staged.kind !== importMode) throw new Error("Choose and review a report file before importing.");
    if (staged.kind === "json") return staged.payload;
    return { provider, providerAccountId: accountId.trim(), records: staged.records };
  }

  async function submitImport(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (disabled || busy) return;
    setError(null);
    setFileError("");
    setNotice("");
    try {
      const payload = validatePayload(makePayload());
      setBusy("importing");
      const response = await importQuery(payload);
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        const code = typeof body?.error === "string" ? body.error : "";
        throw Object.assign(new Error(requestErrorMessage(code, response.status)), { status: response.status });
      }
      const imported = Number(body?.importedCount) || 0;
      const duplicates = Number(body?.duplicateCount) || 0;
      setNotice(`Imported ${imported} ${imported === 1 ? "row" : "rows"}${duplicates ? `; ${duplicates} duplicate ${duplicates === 1 ? "row was" : "rows were"} skipped` : ""}.`);
      setStaged(null);
      setReloadKey((current) => current + 1);
    } catch (reason) {
      const status = typeof reason === "object" && reason && "status" in reason ? Number(reason.status) : 0;
      const message = reason instanceof Error ? reason.message : "This report could not be imported.";
      setError({ message, auth: status === 401 || status === 403 });
    } finally {
      setBusy("");
    }
  }

  function applyFilters(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFilterError("");
    const today = utcToday();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(filterDraft.from) || !/^\d{4}-\d{2}-\d{2}$/.test(filterDraft.to) || filterDraft.from > filterDraft.to || filterDraft.to > today) {
      setFilterError("Choose a valid date range ending no later than today.");
      return;
    }
    const days = Math.floor((Date.parse(`${filterDraft.to}T00:00:00.000Z`) - Date.parse(`${filterDraft.from}T00:00:00.000Z`)) / 86_400_000) + 1;
    if (!Number.isFinite(days) || days > 366) { setFilterError("Choose a range of 366 days or fewer."); return; }
    const currency = filterDraft.currency.trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(currency)) { setFilterError("Enter a three-letter currency code, such as USD."); return; }
    const next = { ...filterDraft, currency };
    setFilterDraft(next);
    setFilters(next);
  }

  const uploadLabel = importMode === "csv" ? "Choose CSV report" : "Choose JSON report";
  const isLoading = busy === "loading";
  const isImporting = busy === "importing";
  const errorIsAuth = error?.auth ?? false;

  return (
    <section className={styles.workbench}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>REPORTING · YOUR WORKSPACE</p>
          <h1>Ad performance</h1>
          <p className={styles.intro}>Review the results in reports you bring in, grouped by creative and measured over your selected period.</p>
        </div>
        <div className={styles.importedBadge}><span aria-hidden="true" /> Customer imported</div>
      </header>

      <div className={styles.sourceNote}>
        <span className={styles.noteMark} aria-hidden="true">↳</span>
        <p>These numbers come from reports you import. No advertising account is connected, and data is not fetched from an ad platform.</p>
      </div>

      {error ? (
        <div className={styles.error} role="alert">
          <div><strong>{errorIsAuth ? "Sign in required" : "Reports need attention"}</strong><p>{error.message}</p></div>
          <div className={styles.errorActions}>
            {errorIsAuth ? <a className={styles.secondaryButton} href={loginHref}>Log in</a> : <button type="button" disabled={disabled || isLoading} onClick={() => setReloadKey((current) => current + 1)}>Try again</button>}
            {errorIsAuth ? null : <button type="button" className={styles.quietButton} disabled={disabled || isLoading} onClick={() => setReloadKey((current) => current + 1)}>Reload</button>}
          </div>
        </div>
      ) : null}

      <section className={styles.filterCard} aria-label="Report filters">
        <form className={styles.filters} onSubmit={applyFilters}>
          <label><span>Date from</span><input aria-label="Date from" type="date" value={filterDraft.from} max={filterDraft.to} onChange={(event) => setFilterDraft((current) => ({ ...current, from: event.target.value }))} disabled={disabled} /></label>
          <label><span>Date to</span><input aria-label="Date to" type="date" value={filterDraft.to} min={filterDraft.from} max={utcToday()} onChange={(event) => setFilterDraft((current) => ({ ...current, to: event.target.value }))} disabled={disabled} /></label>
          <label className={styles.currencyField}><span>Currency</span><input aria-label="Currency" type="text" inputMode="text" autoCapitalize="characters" maxLength={3} value={filterDraft.currency} onChange={(event) => setFilterDraft((current) => ({ ...current, currency: event.target.value.toUpperCase() }))} disabled={disabled} /></label>
          <button className={styles.primaryButton} type="submit" disabled={disabled || isLoading}>Apply filters</button>
          <button className={styles.reloadButton} type="button" disabled={disabled || isLoading} onClick={() => setReloadKey((current) => current + 1)}>{isLoading ? "Loading…" : "Refresh"}</button>
        </form>
        {filterError ? <p className={styles.inlineError} role="alert">{filterError}</p> : null}
        <p className={styles.filterCaption}>Dates use UTC · {dateLabel(filters.from)} – {dateLabel(filters.to)} · {filters.currency}</p>
      </section>

      {notice ? <p className={styles.success} role="status">{notice}</p> : null}

      <div className={styles.dashboard}>
        <section className={styles.results} aria-label="Performance results">
          {isLoading && !summary ? <div className={styles.loading} role="status"><span className={styles.spinner} />Loading your report…</div> : null}
          {summary?.dataAvailable && summary.metrics ? (
            <>
              <div className={styles.summaryHeading}>
                <div><p className={styles.sectionEyebrow}>SELECTED PERIOD</p><h2>Performance overview</h2></div>
                <p>{summary.source.recordCount} imported rows · {summary.source.accounts} {summary.source.accounts === 1 ? "account" : "accounts"}</p>
              </div>
              <div className={styles.metricGrid}>
                <article className={`${styles.metricTile} ${styles.metricLead}`}><span>Total spend</span><strong>{summary.metrics.currency} {summary.metrics.spend}</strong><small>Across {metricNumber(summary.metrics.impressions)} impressions</small></article>
                <article className={styles.metricTile}><span>Click-through rate</span><strong>{rate(summary.metrics.ctr)}</strong><small>{metricNumber(summary.metrics.clicks)} clicks</small></article>
                <article className={styles.metricTile}><span>Cost per acquisition</span><strong>{summary.metrics.cpa == null ? "—" : `${summary.metrics.currency} ${summary.metrics.cpa}`}</strong><small>{metricNumber(summary.metrics.conversions)} conversions</small></article>
              </div>
              <div className={styles.creativeHeading}><div><p className={styles.sectionEyebrow}>CREATIVE BREAKDOWN</p><h2>Results by creative</h2></div><span>{summary.creatives.length} {summary.creatives.length === 1 ? "creative" : "creatives"}</span></div>
              {summary.creatives.length ? <div className={styles.creativeList}>
                {summary.creatives.map((creative) => (
                  <article className={styles.creativeCard} key={`${creative.provider}:${creative.providerAccountId}:${creative.creativeId}`}>
                    <div className={styles.creativeIdentity}>
                      <span className={styles.creativeGlyph} aria-hidden="true">✳</span>
                      <div><h3>{creative.creativeName || creative.creativeId}</h3><p>{creative.creativeName ? creative.creativeId : "Creative ID"} <span>·</span> {providerLabel(creative.provider)}</p></div>
                    </div>
                    <div className={styles.creativeStats}>
                      <div><span>Spend</span><strong>{creative.metrics.currency} {creative.metrics.spend}</strong></div>
                      <div><span>CTR</span><strong>{rate(creative.metrics.ctr)}</strong></div>
                      <div><span>CPA</span><strong>{creative.metrics.cpa == null ? "—" : `${creative.metrics.currency} ${creative.metrics.cpa}`}</strong></div>
                      <div><span>Clicks / views</span><strong>{metricNumber(creative.metrics.clicks)} <i>/</i> {metricNumber(creative.metrics.impressions)}</strong></div>
                      <div><span>Conversions</span><strong>{metricNumber(creative.metrics.conversions)}</strong></div>
                    </div>
                  </article>
                ))}
              </div> : <div className={styles.empty}><h3>No creative results in this range</h3><p>Try a different date or currency filter.</p></div>}
              <p className={styles.freshness}>Latest report added {summary.freshness ? dateLabel(summary.freshness.latestImportAt.slice(0, 10)) : "—"}</p>
            </>
          ) : null}
          {!isLoading && !error && summary && !summary.dataAvailable ? (
            <div className={styles.empty}>
              <span className={styles.emptyGlyph} aria-hidden="true">✳</span>
              <p className={styles.sectionEyebrow}>A CLEAR START</p>
              <h2>Your imported results will appear here</h2>
              <p>Bring in a report to compare spend, clicks, conversions, CTR, and CPA by creative.</p>
            </div>
          ) : null}
          {isLoading && summary ? <div className={styles.refreshing} role="status"><span className={styles.spinner} />Updating this report…</div> : null}
        </section>

        <aside className={styles.importCard} aria-labelledby={`${inputId}-title`}>
          <div className={styles.importHeading}><div><p className={styles.sectionEyebrow}>ADD YOUR DATA</p><h2 id={`${inputId}-title`}>Import a report</h2></div><span className={styles.importIcon} aria-hidden="true">+</span></div>
          <p className={styles.importIntro}>Use a CSV or JSON export, or add one row by hand. Imports are stored in your private workspace.</p>
          <div className={styles.tabs} role="tablist" aria-label="Import format">
            {([ ["csv", "CSV"], ["json", "JSON"], ["manual", "One row"] ] as const).map(([value, label]) => <button key={value} type="button" role="tab" aria-selected={importMode === value} className={importMode === value ? styles.activeTab : ""} disabled={disabled || isImporting} onClick={() => { setImportMode(value); setStaged(null); setFileError(""); setNotice(""); }}>{label}</button>)}
          </div>

          <form onSubmit={(event) => void submitImport(event)}>
            {importMode !== "json" ? <>
              <label className={styles.field}><span>Report platform</span><select aria-label="Report platform" value={provider} onChange={(event) => setProvider(event.target.value as Provider)} disabled={disabled || isImporting}>{PROVIDERS.map((item) => <option value={item.value} key={item.value}>{item.label}</option>)}</select></label>
              <label className={styles.field}><span>Account reference</span><input aria-label="Account reference" value={accountId} onChange={(event) => setAccountId(event.target.value)} placeholder="Example: account-01" autoComplete="off" disabled={disabled || isImporting} /><small>Use an ID from the report. No account connection is created.</small></label>
            </> : <p className={styles.jsonHelp}>Choose a JSON report object with a platform, account reference, and records. Only the report fields are accepted.</p>}

            {importMode !== "manual" ? <>
              <label className={styles.filePicker} htmlFor={`${inputId}-file`}>
                <span className={styles.fileMark} aria-hidden="true">↑</span>
                <strong>{staged && staged.kind === importMode ? staged.filename : uploadLabel}</strong>
                <small>{staged && staged.kind === importMode ? (() => { const count = staged.kind === "csv" ? staged.records.length : staged.payload.records.length; return `${count} ${count === 1 ? "row" : "rows"} ready to review`; })() : importMode === "csv" ? "Up to 250 rows · .csv · 100 KB max" : "Up to 250 rows · .json · 100 KB max"}</small>
                <input id={`${inputId}-file`} aria-label={uploadLabel} type="file" accept={importMode === "csv" ? ".csv,text/csv" : ".json,application/json"} onChange={(event) => { void handleFile(event.target.files?.[0]); event.currentTarget.value = ""; }} disabled={disabled || isImporting} />
              </label>
              {importMode === "csv" ? <p className={styles.csvHint}>Columns: <code>providerRecordId, creativeId, creativeName, date, currency, spend, impressions, clicks, conversions</code></p> : null}
              {staged && staged.kind === importMode ? <div className={styles.preview} role="status"><strong>Ready to import</strong><span>{staged.kind === "csv" ? `${staged.records.length} ${staged.records.length === 1 ? "report row" : "report rows"}` : `${staged.payload.records.length} ${staged.payload.records.length === 1 ? "report row" : "report rows"} · ${providerLabel(staged.payload.provider)}`}</span></div> : null}
            </> : <div className={styles.manualFields}>
              <label className={styles.field}><span>Report row ID</span><input aria-label="Report row ID" value={manual.providerRecordId} onChange={(event) => setManual((current) => ({ ...current, providerRecordId: event.target.value }))} autoComplete="off" disabled={disabled || isImporting} /></label>
              <label className={styles.field}><span>Creative ID</span><input aria-label="Creative ID" value={manual.creativeId} onChange={(event) => setManual((current) => ({ ...current, creativeId: event.target.value }))} autoComplete="off" disabled={disabled || isImporting} /></label>
              <label className={styles.field}><span>Creative name <small>(optional)</small></span><input aria-label="Creative name" value={manual.creativeName ?? ""} onChange={(event) => setManual((current) => ({ ...current, creativeName: event.target.value }))} disabled={disabled || isImporting} /></label>
              <div className={styles.manualPair}>
                <label className={styles.field}><span>Date</span><input aria-label="Report date" type="date" max={utcToday()} value={manual.date} onChange={(event) => setManual((current) => ({ ...current, date: event.target.value }))} disabled={disabled || isImporting} /></label>
                <label className={styles.field}><span>Currency</span><input aria-label="Report currency" maxLength={3} value={manual.currency} onChange={(event) => setManual((current) => ({ ...current, currency: event.target.value.toUpperCase() }))} disabled={disabled || isImporting} /></label>
              </div>
              <label className={styles.field}><span>Spend</span><input aria-label="Spend" inputMode="decimal" placeholder="12.34" value={manual.spend} onChange={(event) => setManual((current) => ({ ...current, spend: event.target.value }))} disabled={disabled || isImporting} /></label>
              <div className={styles.manualPair}>
                <label className={styles.field}><span>Impressions</span><input aria-label="Impressions" inputMode="numeric" value={manual.impressions} onChange={(event) => setManual((current) => ({ ...current, impressions: event.target.value }))} disabled={disabled || isImporting} /></label>
                <label className={styles.field}><span>Clicks</span><input aria-label="Clicks" inputMode="numeric" value={manual.clicks} onChange={(event) => setManual((current) => ({ ...current, clicks: event.target.value }))} disabled={disabled || isImporting} /></label>
              </div>
              <label className={styles.field}><span>Conversions</span><input aria-label="Conversions" inputMode="numeric" value={manual.conversions} onChange={(event) => setManual((current) => ({ ...current, conversions: event.target.value }))} disabled={disabled || isImporting} /></label>
            </div>}
            {fileError ? <p className={styles.inlineError} role="alert">{fileError}</p> : null}
            <button className={`${styles.primaryButton} ${styles.importButton}`} type="submit" disabled={disabled || isImporting || isLoading}>{isImporting ? "Importing…" : importMode === "manual" ? "Import this row" : "Import report"}</button>
          </form>
          <p className={styles.privacyNote}>Imports are limited to 250 rows and validated before they are saved. A repeated row ID with different values is rejected.</p>
        </aside>
      </div>
    </section>
  );
}
