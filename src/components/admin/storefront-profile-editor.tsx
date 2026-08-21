"use client";

import { useMemo, useState } from "react";
import { Save } from "lucide-react";
import { fetchAdminJson } from "@/components/admin/admin-api-client";
import { siteAdminJsonHeaders } from "@/lib/client-csrf";
import type { Site, StorefrontProfileJson } from "@/lib/types";

function emptyProfile(): StorefrontProfileJson {
  return { identity: { sameAs: [] }, policyFacts: {} };
}

export function StorefrontProfileEditor({ site }: { site: Site }) {
  const [profile, setProfile] = useState<StorefrontProfileJson>(site.storefrontProfile?.draftJson ?? emptyProfile());
  const [draftMeta, setDraftMeta] = useState(site.storefrontProfile?.draftMeta);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const address = profile.identity.address;
  const sameAsText = useMemo(() => profile.identity.sameAs.join("\n"), [profile.identity.sameAs]);
  const updateIdentity = (patch: Partial<StorefrontProfileJson["identity"]>) => setProfile((current) => ({ ...current, identity: { ...current.identity, ...patch } }));
  const updatePolicy = (patch: Partial<StorefrontProfileJson["policyFacts"]>) => setProfile((current) => ({ ...current, policyFacts: { ...current.policyFacts, ...patch } }));
  const updateCreditLifecycle = (patch: Partial<NonNullable<StorefrontProfileJson["policyFacts"]["creditLifecycle"]>>) =>
    updatePolicy({ creditLifecycle: { ...(profile.policyFacts.creditLifecycle ?? {}), ...patch } });
  const updateSecurity = (patch: Partial<NonNullable<StorefrontProfileJson["policyFacts"]["security"]>>) =>
    updatePolicy({ security: { ...(profile.policyFacts.security ?? {}), ...patch } });

  async function save() {
    setSaving(true);
    setMessage(null);
    const response = await fetchAdminJson<{ profile?: Site["storefrontProfile"]; error?: string }>(`/api/sites/${site.id}/storefront-profile/draft`, {
      init: {
        method: "PUT",
        headers: siteAdminJsonHeaders(site.id),
        body: JSON.stringify({ draftJson: profile, expectedRevision: draftMeta?.revision, expectedEtag: draftMeta?.etag })
      },
      ttlMs: 0
    });
    setSaving(false);
    if (response.ok && response.data.profile?.draftMeta) setDraftMeta(response.data.profile.draftMeta);
    setMessage(response.ok ? "Draft saved. Publish it from the site release manifest." : response.data.error ?? "Profile save failed.");
  }

  return (
    <div className="grid gap-4">
      <div className="grid gap-3 md:grid-cols-2">
        <label className="grid gap-1 text-[12px] text-[#475467]">Legal name<input className="rounded-[6px] border border-[#d0d5dd] px-3 py-2 text-sm text-[#101828]" value={profile.identity.legalName ?? ""} onChange={(event) => updateIdentity({ legalName: event.target.value })} /></label>
        <label className="grid gap-1 text-[12px] text-[#475467]">Entity type<input className="rounded-[6px] border border-[#d0d5dd] px-3 py-2 text-sm text-[#101828]" value={profile.identity.entityType ?? ""} onChange={(event) => updateIdentity({ entityType: event.target.value })} /></label>
        <label className="grid gap-1 text-[12px] text-[#475467]">Support email<input className="rounded-[6px] border border-[#d0d5dd] px-3 py-2 text-sm text-[#101828]" value={profile.identity.supportEmail ?? ""} onChange={(event) => updateIdentity({ supportEmail: event.target.value })} /></label>
        <label className="grid gap-1 text-[12px] text-[#475467]">Phone<input className="rounded-[6px] border border-[#d0d5dd] px-3 py-2 text-sm text-[#101828]" value={profile.identity.phone ?? ""} onChange={(event) => updateIdentity({ phone: event.target.value })} /></label>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {(["line1", "line2", "city", "region", "postalCode", "country"] as const).map((key) => (
          <label className="grid gap-1 text-[12px] text-[#475467]" key={key}>{key}<input className="rounded-[6px] border border-[#d0d5dd] px-3 py-2 text-sm text-[#101828]" value={address?.[key] ?? ""} onChange={(event) => updateIdentity({ address: { ...(address ?? { line1: "", city: "", region: "", postalCode: "", country: "" }), [key]: event.target.value } })} /></label>
        ))}
      </div>
      <label className="grid gap-1 text-[12px] text-[#475467]">Social profiles, one HTTPS URL per line<textarea className="min-h-20 rounded-[6px] border border-[#d0d5dd] px-3 py-2 text-sm text-[#101828]" value={sameAsText} onChange={(event) => updateIdentity({ sameAs: event.target.value.split(/\r?\n/).map((value) => value.trim()).filter(Boolean) })} /></label>
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-5">
        <label className="grid gap-1 text-[12px] text-[#475467]">Retention days<input type="number" min="1" className="rounded-[6px] border border-[#d0d5dd] px-3 py-2 text-sm text-[#101828]" value={profile.policyFacts.sourceMediaRetentionDays ?? ""} onChange={(event) => updatePolicy({ sourceMediaRetentionDays: event.target.value ? Number(event.target.value) : undefined })} /></label>
        <label className="grid gap-1 text-[12px] text-[#475467]">Refund window days<input type="number" min="1" className="rounded-[6px] border border-[#d0d5dd] px-3 py-2 text-sm text-[#101828]" value={profile.policyFacts.refundWindowDays ?? ""} onChange={(event) => updatePolicy({ refundWindowDays: event.target.value ? Number(event.target.value) : undefined })} /></label>
        <label className="grid gap-1 text-[12px] text-[#475467]">Policy effective date<input type="date" className="rounded-[6px] border border-[#d0d5dd] px-3 py-2 text-sm text-[#101828]" value={profile.policyFacts.effectiveDate ?? ""} onChange={(event) => updatePolicy({ effectiveDate: event.target.value || undefined })} /></label>
        <label className="grid gap-1 text-[12px] text-[#475467]">Customer media used for training<select className="rounded-[6px] border border-[#d0d5dd] px-3 py-2 text-sm text-[#101828]" value={profile.policyFacts.usesCustomerMediaForTraining === undefined ? "" : String(profile.policyFacts.usesCustomerMediaForTraining)} onChange={(event) => updatePolicy({ usesCustomerMediaForTraining: event.target.value === "" ? undefined : event.target.value === "true" })}><option value="">Unconfirmed</option><option value="false">No</option><option value="true">Yes</option></select></label>
        <label className="grid gap-1 text-[12px] text-[#475467]">Refunds require review<select className="rounded-[6px] border border-[#d0d5dd] px-3 py-2 text-sm text-[#101828]" value={profile.policyFacts.refundReviewRequired === undefined ? "" : String(profile.policyFacts.refundReviewRequired)} onChange={(event) => updatePolicy({ refundReviewRequired: event.target.value === "" ? undefined : event.target.value === "true" })}><option value="">Unconfirmed</option><option value="false">No</option><option value="true">Yes</option></select></label>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <label className="grid gap-1 text-[12px] text-[#475467]">Credit reserve statement<textarea className="min-h-24 rounded-[6px] border border-[#d0d5dd] px-3 py-2 text-sm text-[#101828]" value={profile.policyFacts.creditLifecycle?.reserve ?? ""} onChange={(event) => updateCreditLifecycle({ reserve: event.target.value })} /></label>
        <label className="grid gap-1 text-[12px] text-[#475467]">Credit consume statement<textarea className="min-h-24 rounded-[6px] border border-[#d0d5dd] px-3 py-2 text-sm text-[#101828]" value={profile.policyFacts.creditLifecycle?.consume ?? ""} onChange={(event) => updateCreditLifecycle({ consume: event.target.value })} /></label>
        <label className="grid gap-1 text-[12px] text-[#475467]">Credit release statement<textarea className="min-h-24 rounded-[6px] border border-[#d0d5dd] px-3 py-2 text-sm text-[#101828]" value={profile.policyFacts.creditLifecycle?.release ?? ""} onChange={(event) => updateCreditLifecycle({ release: event.target.value })} /></label>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <label className="grid gap-1 text-[12px] text-[#475467]">Checkout provider<input className="rounded-[6px] border border-[#d0d5dd] px-3 py-2 text-sm text-[#101828]" value={profile.policyFacts.security?.checkoutProvider ?? ""} onChange={(event) => updateSecurity({ checkoutProvider: event.target.value })} /></label>
        <label className="grid gap-1 text-[12px] text-[#475467]">Transport security statement<textarea className="min-h-20 rounded-[6px] border border-[#d0d5dd] px-3 py-2 text-sm text-[#101828]" value={profile.policyFacts.security?.transportClaimKey ?? ""} onChange={(event) => updateSecurity({ transportClaimKey: event.target.value })} /></label>
        <label className="grid gap-1 text-[12px] text-[#475467]">Storage security statement<textarea className="min-h-20 rounded-[6px] border border-[#d0d5dd] px-3 py-2 text-sm text-[#101828]" value={profile.policyFacts.security?.storageClaimKey ?? ""} onChange={(event) => updateSecurity({ storageClaimKey: event.target.value })} /></label>
      </div>
      <div className="flex items-center gap-3"><button className="inline-flex items-center gap-2 rounded-[6px] bg-[#101828] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" disabled={saving} onClick={() => void save()} type="button"><Save className="h-4 w-4" />{saving ? "Saving..." : "Save site profile draft"}</button>{message ? <span className="text-sm text-[#667085]">{message}</span> : null}</div>
    </div>
  );
}
