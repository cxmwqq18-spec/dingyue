"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fetchAdminJson, type CachedJsonResponse } from "@/components/admin/admin-api-client";

type SectionKey = string;

export type AdminSectionState = {
  loading: boolean;
  loaded: boolean;
  error: string | null;
  lastMs: number | null;
  status: number | null;
};

export type AdminSectionRequest<TSection extends SectionKey, TPayload> = {
  section: TSection;
  url: string;
  ttlMs?: number;
  merge?: (current: TPayload | null, next: TPayload) => TPayload;
};

export type UseAdminSectionFetchOptions<TSection extends SectionKey, TPayload> = {
  enabled?: boolean;
  initialPayload?: TPayload | null;
  requests: AdminSectionRequest<TSection, TPayload>[];
  merge?: (current: TPayload | null, next: TPayload, section: TSection) => TPayload;
  onSection?: (section: TSection, response: CachedJsonResponse<TPayload>) => void;
  errorMessage?: (section: TSection, payload: TPayload, response: CachedJsonResponse<TPayload>) => string;
};

const emptySectionState: AdminSectionState = {
  loading: false,
  loaded: false,
  error: null,
  lastMs: null,
  status: null
};

function sectionStateMap<TSection extends SectionKey, TPayload>(
  requests: AdminSectionRequest<TSection, TPayload>[]
): Record<TSection, AdminSectionState> {
  return Object.fromEntries(requests.map((request) => [request.section, emptySectionState])) as Record<TSection, AdminSectionState>;
}

function defaultMerge<TPayload>(current: TPayload | null, next: TPayload): TPayload {
  if (
    current &&
    typeof current === "object" &&
    !Array.isArray(current) &&
    next &&
    typeof next === "object" &&
    !Array.isArray(next)
  ) {
    return { ...current, ...next };
  }
  return next;
}

function defaultErrorMessage<TPayload>(
  section: SectionKey,
  payload: TPayload,
  response: CachedJsonResponse<TPayload>
): string {
  const error = payload && typeof payload === "object" && "error" in payload ? payload.error : undefined;
  return typeof error === "string" ? error : `${section} section failed with ${response.status}`;
}

export function useAdminSectionFetch<TSection extends SectionKey, TPayload>({
  enabled = true,
  initialPayload = null,
  requests,
  merge = defaultMerge,
  onSection,
  errorMessage = defaultErrorMessage
}: UseAdminSectionFetchOptions<TSection, TPayload>) {
  const [payload, setPayload] = useState<TPayload | null>(initialPayload);
  const [sections, setSections] = useState<Record<TSection, AdminSectionState>>(() => sectionStateMap(requests));
  const abortRef = useRef<AbortController | null>(null);
  const runIdRef = useRef(0);
  const requestsRef = useRef(requests);
  const mergeRef = useRef(merge);
  const onSectionRef = useRef(onSection);
  const errorMessageRef = useRef(errorMessage);
  const requestKey = useMemo(
    () => requests.map((request) => `${request.section}:${request.url}:${request.ttlMs ?? ""}`).join("|"),
    [requests]
  );
  requestsRef.current = requests;
  mergeRef.current = merge;
  onSectionRef.current = onSection;
  errorMessageRef.current = errorMessage;

  const setSectionState = useCallback((section: TSection, patch: Partial<AdminSectionState>) => {
    setSections((current) => ({
      ...current,
      [section]: {
        ...(current[section] ?? emptySectionState),
        ...patch
      }
    }));
  }, []);

  const loadSection = useCallback(async (
    request: AdminSectionRequest<TSection, TPayload>,
    signal: AbortSignal,
    runId: number
  ) => {
    const started = performance.now();
    setSectionState(request.section, { loading: true, error: null });
    try {
      const response = await fetchAdminJson<TPayload>(request.url, {
        init: { signal },
        ttlMs: request.ttlMs
      });
      if (signal.aborted || runId !== runIdRef.current) return null;
      if (!response.ok) {
        const message = errorMessageRef.current(request.section, response.data, response);
        setSectionState(request.section, {
          loading: false,
          loaded: false,
          error: message,
          lastMs: Math.round(performance.now() - started),
          status: response.status
        });
        return response;
      }
      setPayload((current) => (request.merge ?? ((value, next) => mergeRef.current(value, next, request.section)))(current, response.data));
      setSectionState(request.section, {
        loading: false,
        loaded: true,
        error: null,
        lastMs: Math.round(performance.now() - started),
        status: response.status
      });
      onSectionRef.current?.(request.section, response);
      return response;
    } catch (error) {
      if (signal.aborted || runId !== runIdRef.current) return null;
      setSectionState(request.section, {
        loading: false,
        loaded: false,
        error: error instanceof Error ? error.message : `${request.section} section failed`,
        lastMs: Math.round(performance.now() - started),
        status: null
      });
      return null;
    }
  }, [setSectionState]);

  const reload = useCallback(async (onlySections?: TSection[]) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const runId = runIdRef.current + 1;
    runIdRef.current = runId;
    const activeRequestsSource = requestsRef.current;
    const wanted = new Set(onlySections ?? activeRequestsSource.map((request) => request.section));
    const activeRequests = activeRequestsSource.filter((request) => wanted.has(request.section));
    await Promise.all(activeRequests.map((request) => loadSection(request, controller.signal, runId)));
  }, [loadSection]);

  useEffect(() => {
    setSections(sectionStateMap(requestsRef.current));
    setPayload(initialPayload);
  }, [initialPayload, requestKey]);

  useEffect(() => {
    if (!enabled) return undefined;
    void reload();
    return () => {
      abortRef.current?.abort();
    };
  }, [enabled, reload]);

  const loading = Object.values<AdminSectionState>(sections).some((section) => section.loading);
  const firstError = Object.values<AdminSectionState>(sections).find((section) => section.error)?.error ?? null;

  return {
    payload,
    sections,
    loading,
    error: firstError,
    reload,
    abort: () => abortRef.current?.abort()
  };
}
