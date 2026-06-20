"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Plus, Save, Trash2 } from "lucide-react";
import type { PublicSiteAdmin, SiteAdmin } from "@/lib/types";
import {
  ErpField,
  ErpFormGrid,
  ErpInput,
  ErpSection,
  ErpSelect
} from "@/components/admin/erp-primitives";

type AdminDraft = {
  displayName: string;
  role: SiteAdmin["role"];
  password: string;
};

function adminErrorMessage(code?: string) {
  return {
    site_admin_login_required: "当前后台登录已失效，请重新登录。",
    invalid_site_admin_payload: "管理员资料不完整。",
    invalid_site_admin_email: "管理员邮箱格式不正确。",
    invalid_site_admin_password: "管理员密码至少需要 6 位。",
    invalid_site_admin_name: "管理员姓名不能为空。",
    invalid_site_admin_role: "管理员角色无效。",
    site_admin_exists: "该邮箱已经存在于当前站点。",
    site_admin_not_found: "管理员记录不存在。",
    site_requires_owner: "当前站点至少需要保留一个 owner。",
    site_admin_update_empty: "没有可保存的修改。"
  }[code ?? ""] ?? code ?? "unknown error";
}

export function SiteAdminsPanel({
  siteId,
  admins
}: {
  siteId: string;
  admins: PublicSiteAdmin[];
}) {
  const router = useRouter();
  const [items, setItems] = useState(admins);
  const [message, setMessage] = useState("站点后台账号现在可以在这里直接维护。");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, AdminDraft>>(() =>
    Object.fromEntries(
      admins.map((admin) => [
        admin.id,
        {
          displayName: admin.displayName,
          role: admin.role,
          password: ""
        }
      ])
    )
  );
  const [createForm, setCreateForm] = useState({
    email: "",
    displayName: "",
    role: "admin" as SiteAdmin["role"],
    password: ""
  });

  useEffect(() => {
    setItems(admins);
    setDrafts(
      Object.fromEntries(
        admins.map((admin) => [
          admin.id,
          {
            displayName: admin.displayName,
            role: admin.role,
            password: ""
          }
        ])
      )
    );
  }, [admins]);

  const ownerCount = useMemo(() => items.filter((admin) => admin.role === "owner").length, [items]);

  function patchDraft(adminId: string, patch: Partial<AdminDraft>) {
    setDrafts((current) => ({
      ...current,
      [adminId]: {
        ...(current[adminId] ?? { displayName: "", role: "admin", password: "" }),
        ...patch
      }
    }));
  }

  async function createAdmin() {
    setBusyId("create");
    const response = await fetch(`/api/sites/${siteId}/admins`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...createForm,
        actor: "site_admin_demo"
      })
    });
    const result = (await response.json().catch(() => ({}))) as { admin?: PublicSiteAdmin; error?: string };
    setBusyId(null);
    if (!response.ok || !result.admin) {
      setMessage(`创建管理员失败：${adminErrorMessage(result.error)}`);
      return;
    }
    setItems((current) => [...current, result.admin as PublicSiteAdmin]);
    setCreateForm({ email: "", displayName: "", role: "admin", password: "" });
    setMessage(`${result.admin.email} 已加入当前站点后台。`);
    router.refresh();
  }

  async function saveAdmin(admin: PublicSiteAdmin) {
    const draft = drafts[admin.id];
    if (!draft) return;
    setBusyId(admin.id);
    const response = await fetch(`/api/sites/${siteId}/admins/${admin.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        displayName: draft.displayName,
        role: draft.role,
        password: draft.password || undefined,
        actor: "site_admin_demo"
      })
    });
    const result = (await response.json().catch(() => ({}))) as { admin?: PublicSiteAdmin; error?: string };
    setBusyId(null);
    if (!response.ok || !result.admin) {
      setMessage(`保存管理员失败：${adminErrorMessage(result.error)}`);
      return;
    }
    setItems((current) => current.map((item) => (item.id === admin.id ? result.admin ?? item : item)));
    patchDraft(admin.id, { password: "", displayName: result.admin.displayName, role: result.admin.role });
    setMessage(`${result.admin.email} 已更新。`);
    router.refresh();
  }

  async function removeAdmin(admin: PublicSiteAdmin) {
    setBusyId(`delete:${admin.id}`);
    const response = await fetch(`/api/sites/${siteId}/admins/${admin.id}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actor: "site_admin_demo" })
    });
    const result = (await response.json().catch(() => ({}))) as { deletedAdmin?: PublicSiteAdmin; error?: string };
    setBusyId(null);
    if (!response.ok || !result.deletedAdmin) {
      setMessage(`删除管理员失败：${adminErrorMessage(result.error)}`);
      return;
    }
    setItems((current) => current.filter((item) => item.id !== admin.id));
    setMessage(`${result.deletedAdmin.email} 已移出当前站点后台。`);
    router.refresh();
  }

  return (
    <div className="grid gap-5">
      <ErpSection
        description="owner、admin、support 都限定在当前站点，不跨站。新增账号后可以直接用站点后台登录页登录。"
        eyebrow="access control"
        title="新增后台账号"
      >
        <ErpFormGrid>
          <ErpField label="邮箱">
            <ErpInput
              onChange={(event) => setCreateForm((current) => ({ ...current, email: event.target.value }))}
              placeholder="ops@studio.localhost"
              type="email"
              value={createForm.email}
            />
          </ErpField>
          <ErpField label="显示名称">
            <ErpInput
              onChange={(event) => setCreateForm((current) => ({ ...current, displayName: event.target.value }))}
              placeholder="Operations"
              value={createForm.displayName}
            />
          </ErpField>
          <ErpField label="角色">
            <ErpSelect onChange={(event) => setCreateForm((current) => ({ ...current, role: event.target.value as SiteAdmin["role"] }))} value={createForm.role}>
              <option value="owner">owner</option>
              <option value="admin">admin</option>
              <option value="support">support</option>
            </ErpSelect>
          </ErpField>
          <ErpField label="初始密码" hint="至少 6 位，创建后可再次重置。">
            <ErpInput
              autoComplete="new-password"
              onChange={(event) => setCreateForm((current) => ({ ...current, password: event.target.value }))}
              placeholder="******"
              type="password"
              value={createForm.password}
            />
          </ErpField>
        </ErpFormGrid>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button className="input_btn inline-flex h-[34px] items-center gap-2 px-4" disabled={busyId === "create"} onClick={createAdmin} type="button">
            <Plus className="h-4 w-4" strokeWidth={1.8} />
            {busyId === "create" ? "创建中" : "新增管理员"}
          </button>
          <span className="text-[12px] text-[#8a94a6]">{message}</span>
        </div>
      </ErpSection>

      <ErpSection
        description="支持改名、改角色、重置密码和删除辅助账号。最后一个 owner 不允许删除或降级。"
        eyebrow="admin roster"
        title={`后台账号列表 (${items.length})`}
      >
        <div className="grid gap-4">
          {items.map((admin) => {
            const draft = drafts[admin.id] ?? { displayName: admin.displayName, role: admin.role, password: "" };
            const deleting = busyId === `delete:${admin.id}`;
            const saving = busyId === admin.id;
            const isLastOwner = admin.role === "owner" && ownerCount <= 1;
            return (
              <div className="rounded-[14px] border border-[var(--admin-border-soft)] bg-[#fbfcfe] p-4" key={admin.id}>
                <div className="grid gap-4 xl:grid-cols-[1.2fr_0.9fr_0.9fr_auto] xl:items-end">
                  <ErpField label="管理员">
                    <div className="rounded-[10px] border border-[var(--admin-border-soft)] bg-white px-3 py-2.5">
                      <div className="text-[13px] font-medium text-[#18212f]">{admin.email}</div>
                      <div className="mt-1 font-mono text-[11px] text-[#98a2b3]">{admin.id}</div>
                    </div>
                  </ErpField>
                  <ErpField label="显示名称">
                    <ErpInput onChange={(event) => patchDraft(admin.id, { displayName: event.target.value })} value={draft.displayName} />
                  </ErpField>
                  <ErpField label="角色">
                    <ErpSelect
                      disabled={isLastOwner}
                      onChange={(event) => patchDraft(admin.id, { role: event.target.value as SiteAdmin["role"] })}
                      value={draft.role}
                    >
                      <option value="owner">owner</option>
                      <option value="admin">admin</option>
                      <option value="support">support</option>
                    </ErpSelect>
                  </ErpField>
                  <div className="flex flex-wrap items-center gap-2 xl:justify-end">
                    <button className="admin_btn inline-flex h-[34px] items-center gap-2 px-3" disabled={saving} onClick={() => saveAdmin(admin)} type="button">
                      <Save className="h-4 w-4" strokeWidth={1.8} />
                      {saving ? "保存中" : "保存"}
                    </button>
                    <button
                      className="admin_btn inline-flex h-[34px] items-center gap-2 px-3"
                      disabled={saving}
                      onClick={() => saveAdmin({ ...admin, displayName: draft.displayName, role: draft.role })}
                      type="button"
                    >
                      <KeyRound className="h-4 w-4" strokeWidth={1.8} />
                      重置密码
                    </button>
                    <button
                      className="admin_btn inline-flex h-[34px] items-center gap-2 px-3 text-[#b42318]"
                      disabled={deleting || isLastOwner}
                      onClick={() => removeAdmin(admin)}
                      type="button"
                    >
                      <Trash2 className="h-4 w-4" strokeWidth={1.8} />
                      {deleting ? "删除中" : "删除"}
                    </button>
                  </div>
                </div>
                <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_220px]">
                  <ErpField label="新密码" hint="留空则只保存名称/角色，不改密码。">
                    <ErpInput
                      autoComplete="new-password"
                      onChange={(event) => patchDraft(admin.id, { password: event.target.value })}
                      placeholder="输入新密码后点保存"
                      type="password"
                      value={draft.password}
                    />
                  </ErpField>
                  <div className="rounded-[10px] border border-[var(--admin-border-soft)] bg-white px-3 py-2.5 text-[12px] text-[#667085]">
                    <div>角色: <span className="font-mono text-[#18212f]">{admin.role}</span></div>
                    <div className="mt-1">创建时间: <span className="font-mono text-[#18212f]">{new Date(admin.createdAt).toLocaleDateString("zh-CN")}</span></div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </ErpSection>
    </div>
  );
}
