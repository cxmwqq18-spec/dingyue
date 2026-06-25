import { cache } from "react";
import { readStorefrontPlatformStateJsonFallback, readStorefrontPlatformStateRelational } from "@/lib/storefront-state-relational";
import {
  getStorefrontAccessSummaryRelational,
  getStorefrontPublicRuntimeStateByHost,
  getStorefrontPublicRuntimeStateBySlug,
  getStorefrontPublicRuntimeStateForSite,
  getStorefrontCustomerRuntimeStateForSite,
  getStorefrontRuntimeStateByHost,
  getStorefrontRuntimeStateBySlug,
  getStorefrontRuntimeStateForSite,
  getStorefrontSiteByHostRelational
} from "@/lib/stores/site-store";

export const readStorefrontPlatformState = cache(() => readStorefrontPlatformStateJsonFallback());
export const readStorefrontPlatformStateFromDatabase = cache(() => readStorefrontPlatformStateRelational());
export const readStorefrontPlatformStateFromLegacyJson = cache(() => readStorefrontPlatformStateJsonFallback());
export const readStorefrontSiteByHostFromDatabase = getStorefrontSiteByHostRelational;
export const readStorefrontPublicRuntimeStateByHostFromDatabase = getStorefrontPublicRuntimeStateByHost;
export const readStorefrontPublicRuntimeStateBySlugFromDatabase = getStorefrontPublicRuntimeStateBySlug;
export const readStorefrontPublicRuntimeStateForSiteFromDatabase = getStorefrontPublicRuntimeStateForSite;
export const readStorefrontCustomerRuntimeStateForSiteFromDatabase = getStorefrontCustomerRuntimeStateForSite;
export const readStorefrontRuntimeStateByHostFromDatabase = getStorefrontRuntimeStateByHost;
export const readStorefrontRuntimeStateBySlugFromDatabase = getStorefrontRuntimeStateBySlug;
export const readStorefrontRuntimeStateForSiteFromDatabase = getStorefrontRuntimeStateForSite;
export const readStorefrontAccessSummaryFromDatabase = getStorefrontAccessSummaryRelational;
