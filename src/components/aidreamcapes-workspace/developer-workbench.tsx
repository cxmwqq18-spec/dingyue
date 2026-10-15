"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { customerJsonHeaders } from "@/lib/client-csrf";
import styles from "./developer-workbench.module.css";

type Scope = "read" | "write";
type DeveloperKey = {
  id: string;
  name: string;
  scopes: Scope[];
  createdAt: string;
  expiresAt: string | null;
  revokedAt: string | null;
  lastUsedAt: string | null;
};
type Webhook = {
  id: string;
  endpointUrl: string;
  events: string[];
  createdAt: string;
  updatedAt: string;
  disabledAt: string | null;
};
type IssuedSecret = { kind: "API key" | "webhook signing secret"; value: string };
type RequestError = Error & { status?: number; code?: string };

const SITE_ID = "site_aidreamcapes";
const ERROR_TEXT: Record<string, string> = {
  developer_key_name_invalid: "Enter a key name of up to 80 characters.",
  developer_key_scopes_invalid: "Select at least one access scope.",
  developer_key_expiry_invalid: "Choose an expiry within the next 366 days.",
  developer_key_not_found: "This key is no longer active. Refresh the list.",
  webhook_target_invalid: "Enter a valid HTTPS endpoint without credentials or a fragment.",
  webhook_target_private: "Use a publicly reachable HTTPS endpoint.",
  webhook_events_invalid: "Select a supported webhook event.",
  webhook_subscription_not_found: "This endpoint is no longer active. Refresh the list.",
  webhook_encryption_not_configured: "Webhook creation is currently unavailable.",
  csrf_invalid: "Your session security token has expired. Refresh this page and try again."
};

function describeError(error: unknown) {
  const issue = error as RequestError;
  if (issue?.status === 401) return "Your session has ended. Sign in and try again.";
  if (issue?.status === 403) return "Your account cannot make this change. Check your access and try again.";
  if (issue?.code && ERROR_TEXT[issue.code]) return ERROR_TEXT[issue.code];
  return "We could not complete that request. Please try again.";
}

function dateLabel(value: string | null) {
  if (!value) return "Never";
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(date) : "Unknown";
}

function maskedId(value: string) {
  return value ? `•••• ${value.slice(-8)}` : "••••";
}

export type DeveloperWorkbenchProps = {
  siteId: string;
  customerId?: string;
  csrfToken?: string;
  disabled?: boolean;
};

export function DeveloperWorkbench({ siteId, customerId, csrfToken, disabled = false }: DeveloperWorkbenchProps) {
  const [keys, setKeys] = useState<DeveloperKey[]>([]);
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [reload, setReload] = useState(0);
  const [keyName, setKeyName] = useState("");
  const [keyExpiry, setKeyExpiry] = useState("");
  const [readScope, setReadScope] = useState(true);
  const [writeScope, setWriteScope] = useState(false);
  const [endpointUrl, setEndpointUrl] = useState("");
  const [issued, setIssued] = useState<IssuedSecret | null>(null);

  const request = useCallback(async <T,>(path: string, options: { method?: "GET" | "POST" | "DELETE"; body?: object; signal?: AbortSignal } = {}): Promise<T> => {
    const headers = new Headers(customerJsonHeaders(siteId));
    if (csrfToken) headers.set("x-csrf-token", csrfToken);
    const response = await fetch(`/api/sites/${encodeURIComponent(siteId)}/aivideosugc${path}`, {
      method: options.method ?? "GET",
      credentials: "same-origin",
      cache: "no-store",
      headers,
      signal: options.signal,
      ...(options.body ? { body: JSON.stringify(options.body) } : {})
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      const issue = new Error("Developer request failed") as RequestError;
      issue.status = response.status;
      issue.code = typeof result?.error === "string" ? result.error : undefined;
      throw issue;
    }
    return result as T;
  }, [siteId, csrfToken]);

  useEffect(() => {
    if (siteId !== SITE_ID || !customerId) {
      setLoading(false);
      setKeys([]);
      setWebhooks([]);
      setIssued(null);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    setError("");
    void Promise.all([
      request<{ keys: DeveloperKey[] }>("/developer-keys", { signal: controller.signal }),
      request<{ subscriptions: Webhook[] }>("/webhooks", { signal: controller.signal })
    ]).then(([keyResult, webhookResult]) => {
      if (controller.signal.aborted) return;
      setKeys(Array.isArray(keyResult.keys) ? keyResult.keys : []);
      setWebhooks(Array.isArray(webhookResult.subscriptions) ? webhookResult.subscriptions : []);
    }).catch((reason: unknown) => {
      if (!controller.signal.aborted) setError(describeError(reason));
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
    return () => controller.abort();
  }, [siteId, customerId, reload, request]);

  async function createKey(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (disabled || busy) return;
    const scopes: Scope[] = [...(readScope ? ["read" as const] : []), ...(writeScope ? ["write" as const] : [])];
    if (!scopes.length) { setError("Select at least one access scope."); return; }
    if (keyExpiry) {
      const expiry = new Date(`${keyExpiry}T23:59:59.999Z`).getTime();
      if (!Number.isFinite(expiry) || expiry <= Date.now() || expiry > Date.now() + 366 * 24 * 60 * 60 * 1000) {
        setError("Choose an expiry within the next 366 days."); return;
      }
    }
    setIssued(null);
    setError("");
    setNotice("");
    setBusy("key");
    try {
      const result = await request<{ key: DeveloperKey; secret: string }>("/developer-keys", {
        method: "POST", body: { name: keyName.trim(), scopes, ...(keyExpiry ? { expiresAt: `${keyExpiry}T23:59:59.999Z` } : {}) }
      });
      setKeys((current) => [result.key, ...current]);
      setKeyName("");
      setKeyExpiry("");
      setIssued({ kind: "API key", value: result.secret });
    } catch (reason) { setError(describeError(reason)); }
    finally { setBusy(""); }
  }

  async function createWebhook(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (disabled || busy) return;
    setIssued(null);
    setError("");
    setNotice("");
    setBusy("webhook");
    try {
      const result = await request<{ subscription: Webhook; secret: string }>("/webhooks", {
        method: "POST", body: { url: endpointUrl.trim(), events: ["task.created"] }
      });
      setWebhooks((current) => [result.subscription, ...current]);
      setEndpointUrl("");
      setIssued({ kind: "webhook signing secret", value: result.secret });
    } catch (reason) { setError(describeError(reason)); }
    finally { setBusy(""); }
  }

  async function remove(kind: "key" | "webhook", id: string) {
    if (disabled || busy || !window.confirm(kind === "key" ? "Revoke this API key?" : "Disable this webhook endpoint?")) return;
    setIssued(null);
    setError("");
    setNotice("");
    setBusy(id);
    try {
      await request(kind === "key" ? `/developer-keys/${encodeURIComponent(id)}` : `/webhooks/${encodeURIComponent(id)}`, { method: "DELETE" });
      setNotice(kind === "key" ? "API key revoked." : "Webhook endpoint disabled.");
      setReload((value) => value + 1);
    } catch (reason) { setError(describeError(reason)); }
    finally { setBusy(""); }
  }

  if (siteId !== SITE_ID) return <section className={styles.shell}><p role="alert">Developer settings are available only for Aidreamcapes.</p></section>;
  if (!customerId) return <section className={styles.shell}><p role="alert">Sign in to manage developer settings.</p></section>;

  return <section className={styles.shell} aria-label="Developer settings">
    <header className={styles.hero}>
      <span className={styles.eyebrow}>AIDREAMCAPES / DEVELOPERS</span>
      <h1>Developer access</h1>
      <p>Manage API keys and webhook endpoints for your workspace.</p>
    </header>

    {error && <div className={styles.error} role="alert">{error}</div>}
    {notice && <div className={styles.notice} role="status">{notice}</div>}
    {issued && <div className={styles.secretPanel} role="region" aria-label="New secret">
      <div><span className={styles.eyebrow}>SAVE NOW</span><h2>Your new {issued.kind}</h2><p>Copy this secret now. It will not appear in this list again.</p></div>
      <output className={styles.secretValue} aria-label={`New ${issued.kind}`}>{issued.value}</output>
      <button type="button" className={styles.secondaryButton} onClick={() => setIssued(null)}>I have saved it</button>
    </div>}

    <div className={styles.grid}>
      <section className={styles.panel} aria-labelledby="developer-keys-heading">
        <div className={styles.sectionHead}><div><span className={styles.kicker}>01 / ACCESS</span><h2 id="developer-keys-heading">API keys</h2></div><span className={styles.count}>{keys.length} listed</span></div>
        <form className={styles.form} onSubmit={createKey}>
          <label>Key name<input value={keyName} maxLength={80} required placeholder="Production integration" onChange={(event) => setKeyName(event.target.value)} /></label>
          <fieldset className={styles.fieldset}><legend>Access scopes</legend><label><input type="checkbox" checked={readScope} onChange={(event) => setReadScope(event.target.checked)} /> Read tasks</label><label><input type="checkbox" checked={writeScope} onChange={(event) => setWriteScope(event.target.checked)} /> Create draft tasks</label></fieldset>
          <label>Expiry date <span className={styles.optional}>optional · within 366 days</span><input type="date" value={keyExpiry} onChange={(event) => setKeyExpiry(event.target.value)} /></label>
          <button className={styles.primaryButton} type="submit" disabled={disabled || !!busy}>Create API key</button>
        </form>
        <div className={styles.listHead}><h3>Issued keys</h3><button type="button" className={styles.textButton} disabled={loading || !!busy} onClick={() => setReload((value) => value + 1)}>Refresh</button></div>
        {loading ? <p className={styles.empty}>Loading keys…</p> : keys.length === 0 ? <p className={styles.empty}>No API keys yet.</p> : <ul className={styles.list}>{keys.map((key) => {
          const inactive = !!key.revokedAt || (!!key.expiresAt && Date.parse(key.expiresAt) <= Date.now());
          return <li className={styles.row} key={key.id}><div className={styles.rowMain}><strong>{key.name}</strong><code>{maskedId(key.id)}</code><span className={styles.meta}>{key.scopes.join(" · ")} · Created {dateLabel(key.createdAt)} · Expires {dateLabel(key.expiresAt)} · Last used {dateLabel(key.lastUsedAt)}</span></div><div className={styles.rowActions}><span className={inactive ? styles.inactive : styles.active}>{key.revokedAt ? "Revoked" : inactive ? "Expired" : "Active"}</span>{!inactive && <button type="button" className={styles.dangerButton} disabled={disabled || !!busy} onClick={() => void remove("key", key.id)}>Revoke</button>}</div></li>;
        })}</ul>}
      </section>

      <section className={styles.panel} aria-labelledby="developer-webhooks-heading">
        <div className={styles.sectionHead}><div><span className={styles.kicker}>02 / EVENTS</span><h2 id="developer-webhooks-heading">Webhooks</h2></div><span className={styles.count}>{webhooks.length} listed</span></div>
        <form className={styles.form} onSubmit={createWebhook}>
          <label>HTTPS endpoint<input type="url" required value={endpointUrl} placeholder="https://example.com/webhooks" onChange={(event) => setEndpointUrl(event.target.value)} /></label>
          <div className={styles.eventCard}><span>Event</span><strong>task.created</strong><small>Sent when a developer API task is created.</small></div>
          <button className={styles.primaryButton} type="submit" disabled={disabled || !!busy}>Add webhook endpoint</button>
        </form>
        <div className={styles.listHead}><h3>Endpoints</h3><button type="button" className={styles.textButton} disabled={loading || !!busy} onClick={() => setReload((value) => value + 1)}>Refresh</button></div>
        {loading ? <p className={styles.empty}>Loading endpoints…</p> : webhooks.length === 0 ? <p className={styles.empty}>No webhook endpoints yet.</p> : <ul className={styles.list}>{webhooks.map((hook) => <li className={styles.row} key={hook.id}><div className={styles.rowMain}><strong className={styles.url}>{hook.endpointUrl}</strong><code>{maskedId(hook.id)}</code><span className={styles.meta}>{hook.events.join(" · ")} · Added {dateLabel(hook.createdAt)}</span></div><div className={styles.rowActions}><span className={hook.disabledAt ? styles.inactive : styles.active}>{hook.disabledAt ? "Disabled" : "Active"}</span>{!hook.disabledAt && <button type="button" className={styles.dangerButton} disabled={disabled || !!busy} onClick={() => void remove("webhook", hook.id)}>Disable</button>}</div></li>)}</ul>}
        <div className={styles.history}><h3>Delivery history</h3><p>Delivery history is not available in this workspace yet.</p></div>
      </section>
    </div>

    <aside className={styles.info}><span className={styles.kicker}>API NOTE</span><h2>Creating draft tasks</h2><p>Use a key with the write scope. Send a unique <code>Idempotency-Key</code> header with each task creation request so a retry can refer to the same operation.</p></aside>
  </section>;
}
