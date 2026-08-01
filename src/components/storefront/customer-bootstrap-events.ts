"use client";

export const CUSTOMER_BOOTSTRAP_INVALIDATE_EVENT = "customer-bootstrap:invalidate";

export type CustomerBootstrapInvalidationDetail = {
  reason?: "login" | "logout" | "navigation" | "manual";
  siteSlug?: string;
};

export function dispatchCustomerBootstrapInvalidation(detail: CustomerBootstrapInvalidationDetail = {}) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<CustomerBootstrapInvalidationDetail>(CUSTOMER_BOOTSTRAP_INVALIDATE_EVENT, { detail }));
}
