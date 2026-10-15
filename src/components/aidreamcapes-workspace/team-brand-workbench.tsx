"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { customerJsonHeaders } from "@/lib/client-csrf";
import styles from "./team-brand-workbench.module.css";

type TeamRole = "owner" | "admin" | "editor" | "viewer";
type Team = {
  id: string;
  ownerCustomerId: string;
  name: string;
  revision: number;
  role?: TeamRole;
  createdAt?: string;
  updatedAt?: string;
};
type TeamMember = { customerId: string; name: string; role: TeamRole; createdAt?: string };
type TeamInvite = {
  id: string;
  teamId: string;
  invitedCustomerId: string;
  invitedByCustomerId: string;
  role: TeamRole;
  status: "pending" | "accepted" | "declined" | string;
  createdAt: string;
  respondedAt?: string | null;
  teamName?: string;
};
type Brand = {
  id: string;
  teamId: string;
  ownerCustomerId: string;
  name: string;
  revision: number;
  profile: Record<string, unknown>;
  role?: TeamRole;
  createdAt?: string;
  updatedAt?: string;
};
type BrandFact = {
  id: string;
  brandProfileId: string;
  factKey: string;
  factValue: string;
  sourceType: "manual" | "product_url" | string;
  sourceUrl: string | null;
  sourceLabel: string | null;
  confirmed: boolean;
  confirmedByCustomerId: string | null;
  confirmedAt: string | null;
  revision: number;
  createdAt?: string;
  updatedAt?: string;
};
type BrandDraft = { name: string; website: string; description: string };
type FactDraft = { factKey: string; factValue: string; sourceUrl: string; sourceLabel: string };
type Tab = "teams" | "brands";

class WorkspaceRequestError extends Error {
  status: number;
  code: string;
  constructor(message: string, status: number, code: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function roleName(role?: string) {
  return role ? role[0].toUpperCase() + role.slice(1) : "Member";
}

function profileText(profile: Record<string, unknown> | undefined, key: string) {
  const value = profile?.[key];
  return typeof value === "string" ? value : "";
}

function inviteRoleOptions(role?: TeamRole): TeamRole[] {
  return role === "owner" ? ["admin", "editor", "viewer"] : role === "admin" ? ["editor", "viewer"] : [];
}

function canManageTeam(role?: TeamRole) {
  return role === "owner" || role === "admin";
}

function canWriteBrand(role?: TeamRole) {
  return role === "owner" || role === "admin" || role === "editor";
}

function canRemoveMember(actorRole: TeamRole | undefined, member: TeamMember, customerId: string) {
  if (!canManageTeam(actorRole) || member.role === "owner" || member.customerId === customerId) return false;
  if (actorRole === "admin" && member.role === "admin") return false;
  return true;
}

function errorMessage(error: unknown) {
  if (!(error instanceof WorkspaceRequestError)) return "We couldn’t load or save this workspace. Check your connection and try again.";
  if (error.status === 401) return "Your sign-in has expired. Log in to return to this workspace.";
  if (error.status === 403) return "This account or role cannot make that change. Your access has not been changed.";
  if (error.status === 409 || error.code === "revision_conflict") return "This record changed in another session. Reload the latest version before trying again.";
  if (error.status === 428) return "The current revision is missing. Reload this record before trying again.";
  if (error.code === "team_invite_customer_not_found") return "No active customer with that workspace ID was found.";
  if (error.code === "team_invite_role_denied") return "Your role cannot assign that invitation role.";
  if (error.code === "team_invite_already_pending") return "That customer already has a pending invitation to this team.";
  if (error.code === "team_member_exists") return "That customer is already a member of this team.";
  if (error.code === "brand_already_exists_or_access_changed") return "This team already has a brand profile, or your access changed. Reload the workspace.";
  if (error.code === "brand_fact_key_exists_or_access_changed") return "A fact with this key already exists, or your access changed. Reload the facts.";
  if (error.status === 503 || /database|storage/i.test(error.code)) return "Workspace records are temporarily unavailable. Try reloading in a moment.";
  return "We couldn’t complete that change. Check the information and try again.";
}

const DEFAULT_LOGIN_HREF = `/site/aidreamcapes/login?next=${encodeURIComponent("/site/aidreamcapes/app/create?view=teams")}`;

function dateText(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "—";
  return new Intl.DateTimeFormat(undefined, { year: "numeric", month: "short", day: "numeric" }).format(date);
}

export type TeamBrandWorkbenchProps = {
  siteId: string;
  customerId: string;
  csrfToken?: string;
  disabled?: boolean;
};

export function TeamBrandWorkbench({ siteId, customerId, csrfToken, disabled = false }: TeamBrandWorkbenchProps) {
  const [tab, setTab] = useState<Tab>("teams");
  const [teams, setTeams] = useState<Team[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [receivedInvites, setReceivedInvites] = useState<TeamInvite[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState("");
  const [teamDetail, setTeamDetail] = useState<Team | null>(null);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [teamInvites, setTeamInvites] = useState<TeamInvite[]>([]);
  const [selectedBrandId, setSelectedBrandId] = useState("");
  const [brandDetail, setBrandDetail] = useState<Brand | null>(null);
  const [facts, setFacts] = useState<BrandFact[]>([]);
  const [teamName, setTeamName] = useState("");
  const [newTeamName, setNewTeamName] = useState("");
  const [inviteCustomerId, setInviteCustomerId] = useState("");
  const [inviteRole, setInviteRole] = useState<TeamRole>("editor");
  const [brandDraft, setBrandDraft] = useState<BrandDraft>({ name: "", website: "", description: "" });
  const [newBrand, setNewBrand] = useState<BrandDraft>({ name: "", website: "", description: "" });
  const [factDraft, setFactDraft] = useState<FactDraft>({ factKey: "", factValue: "", sourceUrl: "", sourceLabel: "" });
  const [editingFactId, setEditingFactId] = useState("");
  const [editingFact, setEditingFact] = useState<FactDraft>({ factKey: "", factValue: "", sourceUrl: "", sourceLabel: "" });
  const [loading, setLoading] = useState(true);
  const [teamLoading, setTeamLoading] = useState(false);
  const [brandLoading, setBrandLoading] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState<{ message: string; auth: boolean } | null>(null);
  const [notice, setNotice] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [loginHref, setLoginHref] = useState(DEFAULT_LOGIN_HREF);
  const [workspaceIdCopied, setWorkspaceIdCopied] = useState(false);
  const root = useMemo(() => `/api/sites/${encodeURIComponent(siteId)}/aivideosugc`, [siteId]);
  const request = useMemo(() => async <T,>(path: string, options: { method?: string; body?: unknown; revision?: number; signal?: AbortSignal } = {}): Promise<T> => {
    const method = options.method ?? "GET";
    const headers = new Headers(customerJsonHeaders(siteId));
    if (csrfToken) headers.set("x-csrf-token", csrfToken);
    if (options.revision !== undefined) headers.set("if-match", String(options.revision));
    let body: string | undefined;
    if (options.body !== undefined) {
      headers.set("Content-Type", "application/json");
      body = JSON.stringify(options.body);
    }
    const response = await fetch(`${root}${path}`, {
      method,
      credentials: "same-origin",
      cache: "no-store",
      signal: options.signal,
      headers,
      body
    });
    const value = await response.json().catch(() => ({}));
    if (!response.ok) {
      const code = typeof value?.error === "string" ? value.error : "";
      throw new WorkspaceRequestError(errorMessage(new WorkspaceRequestError("", response.status, code)), response.status, code);
    }
    return value as T;
  }, [siteId, csrfToken, root]);

  const selectedTeam = teams.find((team) => team.id === selectedTeamId) ?? teamDetail;
  const selectedBrand = brandDetail ?? brands.find((brand) => brand.id === selectedBrandId) ?? null;
  const canManage = canManageTeam(selectedTeam?.role);
  const canEditBrand = canWriteBrand(selectedBrand?.role);
  const allowedInviteRoles = inviteRoleOptions(selectedTeam?.role);
  const teamBrand = brands.find((brand) => brand.teamId === selectedTeamId);

  useEffect(() => {
    const routeRoot = window.location.pathname.replace(/\/app(?:\/create)?\/?$/, "");
    setLoginHref(`/site/aidreamcapes/login?next=${encodeURIComponent(`${routeRoot}/app/create?view=teams`)}`);
  }, []);

  useEffect(() => {
    if (!customerId) {
      setLoading(false);
      setError({ message: "Log in to manage your teams and brand details.", auth: true });
      return;
    }
    if (siteId !== "site_aidreamcapes") {
      setLoading(false);
      setError({ message: "These workspace records are available only for Aidreamcapes.", auth: false });
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    void Promise.all([
      request<{ teams: Team[] }>("/teams", { signal: controller.signal }),
      request<{ brands: Brand[] }>("/brands", { signal: controller.signal }),
      request<{ invites: TeamInvite[] }>("/teams/invites", { signal: controller.signal })
    ]).then(([teamResult, brandResult, inviteResult]) => {
      if (controller.signal.aborted) return;
      const nextTeams = teamResult.teams ?? [];
      const nextBrands = brandResult.brands ?? [];
      setTeams(nextTeams);
      setBrands(nextBrands);
      setReceivedInvites(inviteResult.invites ?? []);
      setSelectedTeamId((current) => nextTeams.some((team) => team.id === current) ? current : nextTeams[0]?.id ?? "");
      setSelectedBrandId((current) => nextBrands.some((brand) => brand.id === current) ? current : nextBrands[0]?.id ?? "");
      setError(null);
    }).catch((reason: unknown) => {
      if (controller.signal.aborted) return;
      setError({ message: errorMessage(reason), auth: reason instanceof WorkspaceRequestError && reason.status === 401 });
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [siteId, customerId, request, reloadKey]);

  useEffect(() => {
    if (!selectedTeamId || !customerId || siteId !== "site_aidreamcapes") {
      setTeamDetail(null);
      setMembers([]);
      setTeamInvites([]);
      setTeamLoading(false);
      return;
    }
    const controller = new AbortController();
    setTeamLoading(true);
    setTeamDetail(null);
    setMembers([]);
    setTeamInvites([]);
    void Promise.all([
      request<{ team: Team }>(`/teams/${encodeURIComponent(selectedTeamId)}`, { signal: controller.signal }),
      request<{ members: TeamMember[] }>(`/teams/${encodeURIComponent(selectedTeamId)}/members`, { signal: controller.signal }),
      request<{ invites: TeamInvite[] }>(`/teams/${encodeURIComponent(selectedTeamId)}/invites`, { signal: controller.signal })
    ]).then(([teamResult, memberResult, inviteResult]) => {
      if (controller.signal.aborted) return;
      setTeamDetail(teamResult.team);
      setMembers(memberResult.members ?? []);
      setTeamInvites(inviteResult.invites ?? []);
      setTeamName(teamResult.team.name);
    }).catch((reason: unknown) => {
      if (!controller.signal.aborted) setError({ message: errorMessage(reason), auth: reason instanceof WorkspaceRequestError && reason.status === 401 });
    }).finally(() => { if (!controller.signal.aborted) setTeamLoading(false); });
    return () => controller.abort();
  }, [siteId, customerId, request, selectedTeamId, reloadKey]);

  useEffect(() => {
    if (!selectedBrandId || !customerId || siteId !== "site_aidreamcapes") {
      setBrandDetail(null);
      setFacts([]);
      setBrandLoading(false);
      return;
    }
    const controller = new AbortController();
    setBrandLoading(true);
    setBrandDetail(null);
    setFacts([]);
    void Promise.all([
      request<{ brand: Brand }>(`/brands/${encodeURIComponent(selectedBrandId)}`, { signal: controller.signal }),
      request<{ facts: BrandFact[] }>(`/brands/${encodeURIComponent(selectedBrandId)}/facts`, { signal: controller.signal })
    ]).then(([brandResult, factResult]) => {
      if (controller.signal.aborted) return;
      setBrandDetail(brandResult.brand);
      setFacts(factResult.facts ?? []);
      setBrandDraft({
        name: brandResult.brand.name,
        website: profileText(brandResult.brand.profile, "website"),
        description: profileText(brandResult.brand.profile, "description")
      });
    }).catch((reason: unknown) => {
      if (!controller.signal.aborted) setError({ message: errorMessage(reason), auth: reason instanceof WorkspaceRequestError && reason.status === 401 });
    }).finally(() => { if (!controller.signal.aborted) setBrandLoading(false); });
    return () => controller.abort();
  }, [siteId, customerId, request, selectedBrandId, reloadKey]);

  async function perform(label: string, work: () => Promise<string>) {
    if (disabled || busy) return;
    setBusy(label);
    setError(null);
    setNotice("");
    try {
      setNotice(await work());
      setReloadKey((current) => current + 1);
    } catch (reason) {
      setError({ message: errorMessage(reason), auth: reason instanceof WorkspaceRequestError && reason.status === 401 });
    } finally {
      setBusy("");
    }
  }

  function reload() {
    if (disabled || busy) return;
    setError(null);
    setNotice("");
    setReloadKey((current) => current + 1);
  }

  async function submitNewTeam(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await perform("Creating team…", async () => {
      const result = await request<{ team: Team }>("/teams", { method: "POST", body: { name: newTeamName.trim() } });
      setSelectedTeamId(result.team.id);
      setNewTeamName("");
      return "Team created. You are its owner.";
    });
  }

  async function saveTeam(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!teamDetail) return;
    await perform("Saving team…", async () => {
      const result = await request<{ team: Team }>(`/teams/${encodeURIComponent(teamDetail.id)}`, {
        method: "PATCH",
        revision: teamDetail.revision,
        body: { name: teamName.trim(), revision: teamDetail.revision }
      });
      setTeamDetail(result.team);
      return "Team details saved.";
    });
  }

  async function removeMember(member: TeamMember) {
    if (!teamDetail || !canRemoveMember(teamDetail.role, member, customerId)) return;
    if (!window.confirm(`Remove ${member.name} from ${teamDetail.name}? They will lose access to this team.`)) return;
    await perform("Removing member…", async () => {
      await request<{ ok: true }>(`/teams/${encodeURIComponent(teamDetail.id)}/members/${encodeURIComponent(member.customerId)}`, { method: "DELETE" });
      return `${member.name} was removed from the team.`;
    });
  }

  async function submitInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!teamDetail || !canManageTeam(teamDetail.role)) return;
    await perform("Creating invitation…", async () => {
      await request<{ invite: TeamInvite }>(`/teams/${encodeURIComponent(teamDetail.id)}/invites`, {
        method: "POST",
        body: { customerId: inviteCustomerId.trim(), role: inviteRole }
      });
      setInviteCustomerId("");
      return "Invitation recorded for that workspace ID. No email or shareable link was sent.";
    });
  }

  async function acceptInvite(invite: TeamInvite) {
    if (invite.status !== "pending") return;
    await perform("Accepting invitation…", async () => {
      await request<{ invite: TeamInvite; membership: TeamMember }>(`/teams/invites/${encodeURIComponent(invite.id)}/accept`, { method: "POST" });
      return `You joined ${invite.teamName ?? "the team"}.`;
    });
  }

  async function copyWorkspaceId() {
    try {
      await navigator.clipboard.writeText(customerId);
      setWorkspaceIdCopied(true);
      window.setTimeout(() => setWorkspaceIdCopied(false), 1800);
    } catch {
      setError({ message: "Copy isn’t available here. Select the workspace ID and copy it from the text field.", auth: false });
    }
  }

  function validWebsite(value: string) {
    if (!value.trim()) return "";
    let url: URL;
    try { url = new URL(value.trim()); } catch { throw new Error("Enter a complete HTTPS website address."); }
    if (url.protocol !== "https:" || url.username || url.password || url.hash) throw new Error("Use a public HTTPS address without a password or page fragment.");
    return url.toString();
  }

  async function submitNewBrand(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedTeam || !canWriteBrand(selectedTeam.role)) return;
    await perform("Creating brand…", async () => {
      const website = validWebsite(newBrand.website);
      const result = await request<{ brand: Brand }>("/brands", {
        method: "POST",
        body: { teamId: selectedTeam.id, name: newBrand.name.trim(), profile: { website, description: newBrand.description.trim() } }
      });
      setSelectedBrandId(result.brand.id);
      setNewBrand({ name: "", website: "", description: "" });
      return "Brand profile created.";
    });
  }

  async function saveBrand(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedBrand || !canWriteBrand(selectedBrand.role)) return;
    await perform("Saving brand…", async () => {
      const profile = {
        ...selectedBrand.profile,
        website: validWebsite(brandDraft.website),
        description: brandDraft.description.trim()
      };
      const result = await request<{ brand: Brand }>(`/brands/${encodeURIComponent(selectedBrand.id)}`, {
        method: "PATCH",
        revision: selectedBrand.revision,
        body: { name: brandDraft.name.trim(), profile, revision: selectedBrand.revision }
      });
      setBrandDetail(result.brand);
      return "Brand profile saved.";
    });
  }

  async function createFact(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedBrand || !canWriteBrand(selectedBrand.role)) return;
    await perform("Adding fact…", async () => {
      const sourceUrl = factDraft.sourceUrl.trim();
      if (sourceUrl) validWebsite(sourceUrl);
      await request<{ fact: BrandFact }>(`/brands/${encodeURIComponent(selectedBrand.id)}/facts`, {
        method: "POST",
        body: {
          factKey: factDraft.factKey.trim(),
          factValue: factDraft.factValue.trim(),
          sourceUrl: sourceUrl || null,
          sourceLabel: factDraft.sourceLabel.trim() || null
        }
      });
      setFactDraft({ factKey: "", factValue: "", sourceUrl: "", sourceLabel: "" });
      return "Fact added. Review its source and confirm it before relying on it.";
    });
  }

  async function saveFact(event: FormEvent<HTMLFormElement>, fact: BrandFact) {
    event.preventDefault();
    if (!selectedBrand || !canWriteBrand(selectedBrand.role)) return;
    await perform("Saving fact…", async () => {
      const sourceUrl = editingFact.sourceUrl.trim();
      if (sourceUrl) validWebsite(sourceUrl);
      await request<{ fact: BrandFact }>(`/brands/${encodeURIComponent(selectedBrand.id)}/facts/${encodeURIComponent(fact.id)}`, {
        method: "PATCH",
        revision: fact.revision,
        body: {
          revision: fact.revision,
          factKey: editingFact.factKey.trim(),
          factValue: editingFact.factValue.trim(),
          sourceUrl: sourceUrl || null,
          sourceLabel: editingFact.sourceLabel.trim() || null
        }
      });
      setEditingFactId("");
      return "Fact updated. Its confirmation was cleared so it can be reviewed again.";
    });
  }

  async function confirmFact(fact: BrandFact) {
    if (!selectedBrand || !canWriteBrand(selectedBrand.role) || fact.confirmed) return;
    if (!window.confirm(`Confirm “${fact.factKey}” based on the source shown? Editing the fact later will clear this confirmation.`)) return;
    await perform("Confirming fact…", async () => {
      await request<{ fact: BrandFact }>(`/brands/${encodeURIComponent(selectedBrand.id)}/facts/${encodeURIComponent(fact.id)}`, {
        method: "PATCH",
        revision: fact.revision,
        body: { revision: fact.revision, confirm: true }
      });
      return "Fact confirmed and recorded with your account.";
    });
  }

  const authError = error?.auth === true;

  return (
    <section className={styles.workbench}>
      <header className={styles.header}>
        <div><p className={styles.eyebrow}>YOUR WORKSPACE</p><h1>Teams &amp; brands</h1><p>Manage team access, brand details, and product information that you have reviewed.</p></div>
        <button className={styles.reloadButton} type="button" onClick={reload} disabled={disabled || Boolean(busy) || loading}>Reload</button>
      </header>

      {error ? <div className={styles.error} role="alert"><p>{error.message}</p><div>{authError ? <a className={styles.secondaryButton} href={loginHref}>Log in</a> : null}<button type="button" onClick={reload} disabled={disabled || Boolean(busy)}>Reload</button></div></div> : null}
      {notice ? <p className={styles.notice} role="status">{notice}</p> : null}

      {!customerId ? <div className={styles.emptyPanel}><h2>Log in to manage your workspace</h2><p>Sign in to manage the teams and brand profiles shared with your workspace.</p><a href={loginHref} className={styles.primaryButton}>Log in</a></div> : (
        <>
          <div className={styles.workspaceId}>
            <details>
              <summary>My workspace ID</summary>
              <p>Copy this ID to share it with another customer who can invite you to an existing team.</p>
              <div><code>{customerId}</code><button type="button" onClick={() => void copyWorkspaceId()} disabled={disabled}>{workspaceIdCopied ? "Copied" : "Copy ID"}</button></div>
            </details>
          </div>

          <nav className={styles.tabs} aria-label="Workspace sections">
            <button type="button" aria-pressed={tab === "teams"} className={tab === "teams" ? styles.activeTab : ""} onClick={() => setTab("teams")} disabled={disabled}>Teams &amp; access</button>
            <button type="button" aria-pressed={tab === "brands"} className={tab === "brands" ? styles.activeTab : ""} onClick={() => setTab("brands")} disabled={disabled}>Brands &amp; facts</button>
          </nav>

          {loading ? <div className={styles.loading} role="status">Loading your teams and brands…</div> : null}

          {!loading && tab === "teams" ? (
            <div className={styles.panelGrid}>
              <section className={styles.panel} aria-labelledby="team-panel-heading">
                <div className={styles.panelHeading}><div><p className={styles.sectionLabel}>MEMBERSHIP</p><h2 id="team-panel-heading">Your teams</h2></div><span className={styles.count}>{teams.length}</span></div>
                {teams.length ? <label className={styles.field}><span>Select a team</span><select aria-label="Select a team" value={selectedTeamId} onChange={(event) => { setSelectedTeamId(event.target.value); setTeamDetail(null); setError(null); }} disabled={disabled || Boolean(busy)}>{teams.map((team) => <option key={team.id} value={team.id}>{team.name} · {roleName(team.role)}</option>)}</select></label> : <div className={styles.emptyInline}><strong>No teams yet</strong><p>Create a team to keep brand details and reviewed product facts together.</p></div>}

                {selectedTeam ? <>
                  <div className={styles.teamSummary}><div><strong>{selectedTeam.name}</strong><span>{selectedTeam.role === "owner" ? "You own this team" : `Your role · ${roleName(selectedTeam.role)}`}</span></div><span className={styles.roleChip}>{roleName(selectedTeam.role)}</span></div>
                  <form className={styles.inlineForm} onSubmit={(event) => void saveTeam(event)}>
                    <label className={styles.field}><span>Team name</span><input aria-label="Team name" value={teamName} onChange={(event) => setTeamName(event.target.value)} maxLength={100} required disabled={disabled || Boolean(busy) || !canManage || teamLoading || !teamDetail} /></label>
                    <button type="submit" className={styles.primaryButton} disabled={disabled || Boolean(busy) || !canManage || teamLoading || !teamDetail || teamName.trim() === teamDetail.name}>{busy === "Saving team…" ? "Saving…" : "Save team"}</button>
                    {!canManage ? <small className={styles.permissionNote}>Only owners and admins can rename this team.</small> : null}
                  </form>

                  <div className={styles.sectionBlock}>
                    <div className={styles.subheading}><h3>Members</h3><span>{members.length}</span></div>
                    {teamLoading ? <p className={styles.muted}>Updating member list…</p> : members.length ? <ul className={styles.memberList}>
                      {members.map((member) => {
                        const removable = canRemoveMember(teamDetail?.role, member, customerId);
                        const disabledReason = member.role === "owner" ? "The team owner cannot be removed." : member.customerId === customerId ? "You cannot remove your own access here." : teamDetail?.role === "admin" && member.role === "admin" ? "Admins cannot remove another admin." : !canManage ? "Only owners and admins can remove members." : "";
                        return <li key={member.customerId}><div><strong>{member.name || "Workspace customer"}{member.customerId === customerId ? <span className={styles.youTag}>You</span> : null}</strong><small>{member.role} · {member.customerId}</small></div><button type="button" className={styles.removeButton} title={removable ? "Remove this member" : disabledReason} aria-label={`Remove ${member.name || "member"}`} onClick={() => void removeMember(member)} disabled={disabled || Boolean(busy) || !removable}>Remove</button></li>;
                      })}
                    </ul> : <p className={styles.muted}>No member details are available.</p>}
                    <p className={styles.permissionNote}>Roles are set when an invitation is created. This workspace does not change a member’s role directly.</p>
                  </div>

                  <div className={styles.sectionBlock}>
                    <div className={styles.subheading}><h3>Invite an existing customer</h3></div>
                    {canManage ? <form className={styles.inlineForm} onSubmit={(event) => void submitInvite(event)}>
                      <label className={styles.field}><span>Recipient workspace ID</span><input aria-label="Recipient workspace ID" value={inviteCustomerId} onChange={(event) => setInviteCustomerId(event.target.value)} autoComplete="off" required disabled={disabled || Boolean(busy) || teamLoading || !teamDetail} /></label>
                      <label className={styles.field}><span>Team role</span><select aria-label="Invitation role" value={inviteRole} onChange={(event) => setInviteRole(event.target.value as TeamRole)} disabled={disabled || Boolean(busy) || teamLoading || !teamDetail}>{allowedInviteRoles.map((role) => <option key={role} value={role}>{roleName(role)}</option>)}</select></label>
                      <button type="submit" className={styles.primaryButton} disabled={disabled || Boolean(busy) || teamLoading || !teamDetail || !inviteCustomerId.trim()}>{busy === "Creating invitation…" ? "Creating…" : "Create invitation"}</button>
                      <p className={styles.permissionNote}>The person must already have an account. No email or shareable link is sent from this screen.</p>
                    </form> : <p className={styles.permissionNote}>Only owners and admins can invite people to this team.</p>}
                    <div className={styles.subheading}><h3>Team invitations</h3><span>{teamInvites.length}</span></div>
                    {teamInvites.length ? <ul className={styles.inviteList}>{teamInvites.map((invite) => <li key={invite.id}><div><strong>{invite.invitedCustomerId}</strong><small>{roleName(invite.role)} · {invite.status} · {dateText(invite.createdAt)}</small></div><span className={invite.status === "pending" ? styles.pending : styles.memberStatus}>{invite.status}</span></li>)}</ul> : <p className={styles.muted}>No invitations have been recorded for this team.</p>}
                    <p className={styles.permissionNote}>You can review invitation status here. Pending invitations cannot be canceled.</p>
                  </div>
                </> : null}

                <form className={`${styles.inlineForm} ${styles.createTeam}`} onSubmit={(event) => void submitNewTeam(event)}>
                  <div><p className={styles.sectionLabel}>START A TEAM</p><h3>Create a team</h3></div>
                  <label className={styles.field}><span>Team name</span><input aria-label="New team name" value={newTeamName} onChange={(event) => setNewTeamName(event.target.value)} maxLength={100} required disabled={disabled || Boolean(busy)} /></label>
                  <button type="submit" className={styles.primaryButton} disabled={disabled || Boolean(busy) || !newTeamName.trim()}>{busy === "Creating team…" ? "Creating…" : "Create team"}</button>
                </form>
              </section>

              <section className={styles.panel} aria-labelledby="received-invites-heading">
                <div className={styles.panelHeading}><div><p className={styles.sectionLabel}>FOR YOUR ACCOUNT</p><h2 id="received-invites-heading">Invitations for you</h2></div><span className={styles.count}>{receivedInvites.filter((invite) => invite.status === "pending").length}</span></div>
                {receivedInvites.length ? <ul className={styles.inviteList}>{receivedInvites.map((invite) => <li key={invite.id}><div><strong>{invite.teamName || "Team invitation"}</strong><small>{roleName(invite.role)} · {invite.status} · {dateText(invite.createdAt)}</small></div>{invite.status === "pending" ? <button className={styles.primaryButton} type="button" onClick={() => void acceptInvite(invite)} disabled={disabled || Boolean(busy)}>{busy === "Accepting invitation…" ? "Accepting…" : "Accept"}</button> : <span className={styles.memberStatus}>{invite.status}</span>}</li>)}</ul> : <div className={styles.emptyInline}><strong>No invitations for you</strong><p>Invitations addressed to your workspace ID appear here after you sign in.</p></div>}
                <p className={styles.permissionNote}>Only the invited account can accept. If access is denied, check that you are signed in to the invited account.</p>
              </section>
            </div>
          ) : null}

          {!loading && tab === "brands" ? (
            <div className={styles.panelGrid}>
              <section className={styles.panel} aria-labelledby="brand-panel-heading">
                <div className={styles.panelHeading}><div><p className={styles.sectionLabel}>TEAM BRAND</p><h2 id="brand-panel-heading">Brand profile</h2></div><span className={styles.count}>{brands.length}</span></div>
                {brands.length ? <label className={styles.field}><span>Select a brand</span><select aria-label="Select a brand" value={selectedBrandId} onChange={(event) => { setSelectedBrandId(event.target.value); setBrandDetail(null); setError(null); }} disabled={disabled || Boolean(busy)}>{brands.map((brand) => <option value={brand.id} key={brand.id}>{brand.name} · {teams.find((team) => team.id === brand.teamId)?.name ?? "Team"}</option>)}</select></label> : null}

                {selectedBrand ? <>
                  <p className={styles.brandRole}>For {teams.find((team) => team.id === selectedBrand.teamId)?.name ?? "your team"} · {roleName(selectedBrand.role)} access</p>
                  <form className={styles.inlineForm} onSubmit={(event) => void saveBrand(event)}>
                    <label className={styles.field}><span>Brand name</span><input aria-label="Brand name" value={brandDraft.name} onChange={(event) => setBrandDraft((current) => ({ ...current, name: event.target.value }))} maxLength={100} required disabled={disabled || Boolean(busy) || brandLoading || !brandDetail || !canEditBrand} /></label>
                    <label className={styles.field}><span>Website</span><input aria-label="Brand website" type="url" value={brandDraft.website} onChange={(event) => setBrandDraft((current) => ({ ...current, website: event.target.value }))} placeholder="https://example.com" disabled={disabled || Boolean(busy) || brandLoading || !brandDetail || !canEditBrand} /></label>
                    <label className={styles.field}><span>About this brand</span><textarea aria-label="Brand description" value={brandDraft.description} onChange={(event) => setBrandDraft((current) => ({ ...current, description: event.target.value }))} maxLength={4000} rows={3} disabled={disabled || Boolean(busy) || brandLoading || !brandDetail || !canEditBrand} /></label>
                    {canEditBrand ? <button type="submit" className={styles.primaryButton} disabled={disabled || Boolean(busy) || !brandDetail || (brandDraft.name.trim() === brandDetail.name && brandDraft.website === profileText(brandDetail.profile, "website") && brandDraft.description === profileText(brandDetail.profile, "description"))}>{busy === "Saving brand…" ? "Saving…" : "Save brand"}</button> : <p className={styles.permissionNote}>Your role can view this brand but cannot edit it.</p>}
                  </form>
                </> : null}

                {!teamBrand && selectedTeam ? <form className={`${styles.inlineForm} ${styles.createTeam}`} onSubmit={(event) => void submitNewBrand(event)}>
                  <div><p className={styles.sectionLabel}>ADD A PROFILE</p><h3>Create a brand for {selectedTeam.name}</h3></div>
                  {canWriteBrand(selectedTeam.role) ? <>
                    <label className={styles.field}><span>Brand name</span><input aria-label="New brand name" value={newBrand.name} onChange={(event) => setNewBrand((current) => ({ ...current, name: event.target.value }))} maxLength={100} required disabled={disabled || Boolean(busy)} /></label>
                    <label className={styles.field}><span>Website</span><input aria-label="New brand website" type="url" value={newBrand.website} onChange={(event) => setNewBrand((current) => ({ ...current, website: event.target.value }))} placeholder="https://example.com" disabled={disabled || Boolean(busy)} /></label>
                    <label className={styles.field}><span>About this brand</span><textarea aria-label="New brand description" value={newBrand.description} onChange={(event) => setNewBrand((current) => ({ ...current, description: event.target.value }))} rows={3} maxLength={4000} disabled={disabled || Boolean(busy)} /></label>
                    <button type="submit" className={styles.primaryButton} disabled={disabled || Boolean(busy) || !newBrand.name.trim()}>{busy === "Creating brand…" ? "Creating…" : "Create brand"}</button>
                    <p className={styles.permissionNote}>Each team can currently have one brand profile.</p>
                  </> : <p className={styles.permissionNote}>Only owners, admins, and editors can add a brand profile.</p>}
                </form> : !selectedTeam ? <div className={styles.emptyInline}><strong>Select or create a team</strong><p>A brand profile belongs to a team.</p></div> : null}
              </section>

              <section className={styles.panel} aria-labelledby="facts-heading">
                <div className={styles.panelHeading}><div><p className={styles.sectionLabel}>PRODUCT INFORMATION</p><h2 id="facts-heading">Reviewed facts</h2></div><span className={styles.count}>{facts.length}</span></div>
                {!selectedBrand ? <div className={styles.emptyInline}><strong>Choose a brand profile</strong><p>Product facts are saved with a brand profile.</p></div> : <>
                  {brandLoading ? <p className={styles.muted}>Updating brand facts…</p> : facts.length ? <ul className={styles.factList}>{facts.map((fact) => <li key={fact.id}>
                    {editingFactId === fact.id ? <form className={styles.factEdit} onSubmit={(event) => void saveFact(event, fact)}>
                      <label className={styles.field}><span>Fact key</span><input aria-label="Edit fact key" value={editingFact.factKey} onChange={(event) => setEditingFact((current) => ({ ...current, factKey: event.target.value }))} disabled={disabled || Boolean(busy) || brandLoading || !brandDetail || !canEditBrand} /></label>
                      <label className={styles.field}><span>Information</span><textarea aria-label="Edit fact value" value={editingFact.factValue} onChange={(event) => setEditingFact((current) => ({ ...current, factValue: event.target.value }))} rows={3} disabled={disabled || Boolean(busy) || brandLoading || !brandDetail || !canEditBrand} /></label>
                      <label className={styles.field}><span>Source page (HTTPS)</span><input aria-label="Edit fact source" type="url" value={editingFact.sourceUrl} onChange={(event) => setEditingFact((current) => ({ ...current, sourceUrl: event.target.value }))} disabled={disabled || Boolean(busy) || brandLoading || !brandDetail || !canEditBrand} /></label>
                      <label className={styles.field}><span>Source label</span><input aria-label="Edit source label" value={editingFact.sourceLabel} onChange={(event) => setEditingFact((current) => ({ ...current, sourceLabel: event.target.value }))} disabled={disabled || Boolean(busy) || brandLoading || !brandDetail || !canEditBrand} /></label>
                      <div className={styles.actions}><button type="submit" className={styles.primaryButton} disabled={disabled || Boolean(busy) || brandLoading || !brandDetail || !canEditBrand}>Save fact</button><button type="button" onClick={() => setEditingFactId("")} disabled={disabled || Boolean(busy)}>Cancel</button></div>
                    </form> : <>
                      <div className={styles.factTop}><div><strong>{fact.factKey.replaceAll("_", " ")}</strong><span className={fact.confirmed ? styles.confirmed : styles.unconfirmed}>{fact.confirmed ? "Confirmed" : "Review needed"}</span></div><button type="button" className={styles.textButton} onClick={() => { setEditingFactId(fact.id); setEditingFact({ factKey: fact.factKey, factValue: fact.factValue, sourceUrl: fact.sourceUrl ?? "", sourceLabel: fact.sourceLabel ?? "" }); }} disabled={disabled || Boolean(busy) || brandLoading || !brandDetail || !canEditBrand}>Edit</button></div>
                      <p className={styles.factValue}>{fact.factValue}</p>
                      <div className={styles.factSource}>{fact.sourceUrl ? <a href={fact.sourceUrl} target="_blank" rel="noreferrer">{fact.sourceLabel || "View source"}</a> : <span>{fact.sourceLabel || "Added by a customer"}</span>}<span>Revision {fact.revision}</span></div>
                      {fact.confirmed ? <p className={styles.confirmMeta}>Confirmed on {dateText(fact.confirmedAt)}</p> : <p className={styles.confirmMeta}>Check this information against its source before confirming it.</p>}
                      {!fact.confirmed ? <button type="button" className={styles.confirmButton} onClick={() => void confirmFact(fact)} disabled={disabled || Boolean(busy) || brandLoading || !brandDetail || !canEditBrand}>Confirm this fact</button> : null}
                    </>}
                  </li>)}</ul> : <div className={styles.emptyInline}><strong>No product facts yet</strong><p>Add information with its source. New facts remain unconfirmed until someone reviews them.</p></div>}

                  {canEditBrand ? <form className={styles.newFact} onSubmit={(event) => void createFact(event)}>
                    <div><p className={styles.sectionLabel}>ADD INFORMATION</p><h3>New product fact</h3></div>
                    <label className={styles.field}><span>Fact key</span><input aria-label="New fact key" value={factDraft.factKey} onChange={(event) => setFactDraft((current) => ({ ...current, factKey: event.target.value.toLowerCase().replace(/\s+/g, "_") }))} placeholder="materials" maxLength={80} required disabled={disabled || Boolean(busy) || brandLoading || !brandDetail} /><small>Use lowercase letters, numbers, underscores, dots, or hyphens.</small></label>
                    <label className={styles.field}><span>Information</span><textarea aria-label="New fact value" value={factDraft.factValue} onChange={(event) => setFactDraft((current) => ({ ...current, factValue: event.target.value }))} rows={3} maxLength={4000} required disabled={disabled || Boolean(busy) || brandLoading || !brandDetail} /></label>
                    <label className={styles.field}><span>Source page (optional, HTTPS)</span><input aria-label="New fact source" type="url" value={factDraft.sourceUrl} onChange={(event) => setFactDraft((current) => ({ ...current, sourceUrl: event.target.value }))} placeholder="https://example.com/product" disabled={disabled || Boolean(busy) || brandLoading || !brandDetail} /></label>
                    <label className={styles.field}><span>Source label (optional)</span><input aria-label="New fact source label" value={factDraft.sourceLabel} onChange={(event) => setFactDraft((current) => ({ ...current, sourceLabel: event.target.value }))} maxLength={120} disabled={disabled || Boolean(busy) || brandLoading || !brandDetail} /></label>
                    <button type="submit" className={styles.primaryButton} disabled={disabled || Boolean(busy) || brandLoading || !brandDetail || !factDraft.factKey.trim() || !factDraft.factValue.trim()}>Add unconfirmed fact</button>
                  </form> : <p className={styles.permissionNote}>Your role can view these facts but cannot add, edit, or confirm them.</p>}
                </>}
              </section>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
