"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { Coins, Loader2, ShieldCheck } from "lucide-react";
import { fetchAdminJson } from "@/components/admin/admin-api-client";
import { AdminPagination, clampPage, pageItems, adminPageSizeOptions } from "@/components/admin/admin-pagination";
import { downloadCsv } from "@/components/admin/export-utils";
import { siteAdminJsonHeaders } from "@/lib/client-csrf";
import type { Customer, PublicCustomer, SiteAdmin } from "@/lib/types";

const customerStatusLabels: Record<Customer["status"], string> = {
  active: "正常",
  past_due: "逾期",
  blocked: "已封禁"
};

const siteAdminRoleLabels: Record<SiteAdmin["role"], string> = {
  owner: "站点所有者",
  admin: "站点管理员",
  support: "客服支持"
};

type BusyAction = {
  key: string;
  label: string;
};

const mutationTimeoutMs = 8_000;

function ActionOverlay({ label }: { label: string }) {
  return (
    <div
      className="absolute inset-0 z-20 flex items-center justify-center rounded-[12px] border border-blue-100 bg-white/72 backdrop-blur-[2px]"
      role="status"
      aria-live="polite"
    >
      <div className="inline-flex items-center gap-2 rounded-[8px] border border-[#dbe7f5] bg-white px-4 py-2 text-[12px] font-semibold text-[#2f5f9f] shadow-sm">
        <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.8} />
        {label}
      </div>
    </div>
  );
}

export function CustomerAdminPanel({
  siteId,
  customers,
  signupCreditGrant = 0,
  siteAdmins = []
}: {
  siteId: string;
  customers: PublicCustomer[];
  signupCreditGrant?: number;
  siteAdmins?: SiteAdmin[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [items, setItems] = useState(customers);
  const [adminItems, setAdminItems] = useState(siteAdmins);
  const [adjustments, setAdjustments] = useState<Record<string, string>>({});
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<Customer["status"] | "">("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(adminPageSizeOptions[0]);
  const [signupGrant, setSignupGrant] = useState(String(signupCreditGrant));
  const [busyAction, setBusyAction] = useState<BusyAction | null>(null);
  const [message, setMessage] = useState("客户变更仅作用于当前站点，并会立即保存。");
  const isBusy = Boolean(busyAction);

  useEffect(() => {
    setItems(customers);
  }, [customers]);

  useEffect(() => {
    setAdminItems(siteAdmins);
  }, [siteAdmins]);

  useEffect(() => {
    setSignupGrant(String(signupCreditGrant));
  }, [signupCreditGrant]);

  const adminByEmail = useMemo(() => {
    return new Map(adminItems.map((admin) => [admin.email.trim().toLowerCase(), admin]));
  }, [adminItems]);

  const filteredItems = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return items.filter((customer) => {
      if (statusFilter && customer.status !== statusFilter) return false;
      if (!normalized) return true;
      return [customer.name, customer.email, customer.id].join(" ").toLowerCase().includes(normalized);
    });
  }, [items, query, statusFilter]);
  const currentPage = clampPage(page, filteredItems.length, pageSize);
  const visibleItems = useMemo(() => pageItems(filteredItems, currentPage, pageSize), [filteredItems, currentPage, pageSize]);

  useEffect(() => {
    setPage((current) => clampPage(current, filteredItems.length, pageSize));
  }, [filteredItems.length, pageSize]);

  function refreshInBackground() {
    startTransition(() => {
      router.refresh();
    });
  }

  async function updateStatus(customerId: string, status: Customer["status"]) {
    if (isBusy) return;
    setBusyAction({ key: `status:${customerId}`, label: "正在更新顾客状态..." });
    try {
      const response = await fetchAdminJson<{ customer?: PublicCustomer; error?: string }>(`/api/sites/${siteId}/customers/${customerId}/status`, {
        timeoutMs: mutationTimeoutMs,
        init: {
          method: "PATCH",
          headers: siteAdminJsonHeaders(siteId),
          body: JSON.stringify({ status })
        }
      });
      const result = response.data;
      if (response.ok && result.customer) {
        setItems((current) => current.map((item) => (item.id === customerId ? result.customer ?? item : item)));
        setMessage(`${result.customer.email} 已更新为${customerStatusLabels[result.customer.status]}。`);
        refreshInBackground();
      } else {
        setMessage(result.error ?? "状态更新失败。");
      }
    } catch (error) {
      setMessage(error instanceof Error && error.name === "AbortError" ? "状态更新超时，请稍后重试。" : "状态更新失败。");
    } finally {
      setBusyAction(null);
    }
  }

  async function adjustCredits(customerId: string) {
    if (isBusy) return;
    const amount = Number(adjustments[customerId] ?? 0);
    if (!Number.isFinite(amount) || amount === 0) {
      setMessage("请输入非 0 的调整额度。");
      return;
    }
    setBusyAction({ key: `credits:${customerId}`, label: "正在调整顾客额度..." });
    try {
      const response = await fetchAdminJson<{ customer?: PublicCustomer; error?: string }>(`/api/sites/${siteId}/customers/${customerId}/credits/adjust`, {
        timeoutMs: mutationTimeoutMs,
        init: {
          method: "POST",
          headers: siteAdminJsonHeaders(siteId),
          body: JSON.stringify({ amount, reason: "site admin manual adjustment", actor: "site_admin_demo" })
        }
      });
      const result = response.data;
      if (response.ok && result.customer) {
        setItems((current) => current.map((item) => (item.id === customerId ? result.customer ?? item : item)));
        setAdjustments((current) => ({ ...current, [customerId]: "" }));
        setMessage(`${result.customer.email} 已调整 ${amount} 点额度。`);
        refreshInBackground();
      } else {
        setMessage(result.error ?? "额度调整失败。");
      }
    } catch (error) {
      setMessage(error instanceof Error && error.name === "AbortError" ? "额度调整超时，请稍后重试。" : "额度调整失败。");
    } finally {
      setBusyAction(null);
    }
  }

  function resetFilters() {
    setQuery("");
    setStatusFilter("");
    setPage(1);
  }

  function exportCustomers() {
    downloadCsv(
      `${siteId}-customers.csv`,
      filteredItems.map((customer) => ({
        customerId: customer.id,
        name: customer.name,
        email: customer.email,
        status: customer.status,
        availableCredits: customer.balance.available,
        reservedCredits: customer.balance.reserved
      })),
      ["customerId", "name", "email", "status", "availableCredits", "reservedCredits"]
    );
    setMessage(`已导出 ${filteredItems.length} 条顾客记录。`);
  }

  async function saveSignupCreditGrant() {
    if (isBusy) return;
    const nextGrant = Math.max(0, Math.trunc(Number(signupGrant || 0)));
    setBusyAction({ key: "signup-credit-grant", label: "正在保存注册赠送额度..." });
    try {
      const response = await fetchAdminJson<{ site?: { signupCreditGrant?: number }; error?: string }>(`/api/sites/${siteId}/settings/signup-credit-grant`, {
        timeoutMs: mutationTimeoutMs,
        init: {
          method: "PUT",
          headers: siteAdminJsonHeaders(siteId),
          body: JSON.stringify({ signupCreditGrant: nextGrant })
        }
      });
      const result = response.data;
      if (response.ok) {
        const savedGrant = result.site?.signupCreditGrant ?? nextGrant;
        setSignupGrant(String(savedGrant));
        setMessage(`新用户注册赠送额度已设置为 ${savedGrant} 点。该配置只影响后续新注册客户。`);
        refreshInBackground();
      } else {
        setMessage(result.error ?? "注册赠送额度保存失败。");
      }
    } catch (error) {
      setMessage(error instanceof Error && error.name === "AbortError" ? "注册赠送额度保存超时，请稍后重试。" : "注册赠送额度保存失败。");
    } finally {
      setBusyAction(null);
    }
  }

  async function promoteToAdmin(customer: PublicCustomer) {
    if (isBusy) return;
    setBusyAction({ key: `admin:${customer.id}`, label: "正在设置站点管理员..." });
    try {
      const response = await fetchAdminJson<{
        admin?: { email: string; role: string };
        created?: boolean;
        temporaryPassword?: string;
        error?: string;
      }>(`/api/sites/${siteId}/customers/${customer.id}/admin-role`, {
        timeoutMs: mutationTimeoutMs,
        init: {
          method: "PATCH",
          headers: siteAdminJsonHeaders(siteId),
          body: JSON.stringify({ role: "admin" })
        }
      });
      const result = response.data;
      if (response.ok && result.admin) {
        setAdminItems((current) => {
          const normalizedEmail = result.admin?.email.trim().toLowerCase();
          const exists = current.some((admin) => admin.email.trim().toLowerCase() === normalizedEmail);
          if (!result.admin || !normalizedEmail) return current;
          if (exists) {
            return current.map((admin) =>
              admin.email.trim().toLowerCase() === normalizedEmail
                ? { ...admin, role: result.admin?.role as SiteAdmin["role"] }
                : admin
            );
          }
          return [
            ...current,
            {
              id: normalizedEmail,
              siteId,
              email: result.admin.email,
              displayName: customer.name || result.admin.email,
              role: result.admin.role as SiteAdmin["role"],
              createdAt: new Date().toISOString()
            }
          ];
        });
        setMessage(
          result.created
            ? `${result.admin.email} 已设为站点管理员。临时密码：${result.temporaryPassword}`
            : `${result.admin.email} 已更新为站点管理员。`
        );
        refreshInBackground();
      } else {
        setMessage(result.error ?? "管理员类型设置失败。");
      }
    } catch (error) {
      setMessage(error instanceof Error && error.name === "AbortError" ? "管理员类型设置超时，请稍后重试。" : "管理员类型设置失败。");
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <div className="relative" aria-busy={isBusy}>
      {busyAction ? <ActionOverlay label={busyAction.label} /> : null}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-[16px] font-semibold text-[#333]">会员与顾客列表</h2>
          <p className="mt-1 text-[12px] text-[#666]">{message}</p>
        </div>
      </div>
      <div className="mt-4 rounded-[12px] border border-[#e4edf8] bg-[#f8fbff] px-4 py-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h3 className="text-[14px] font-semibold text-[#26364a]">新用户注册赠送额度</h3>
            <p className="mt-1 text-[12px] leading-5 text-[#667085]">
              控制新客户首次注册时自动写入的可用点数。默认 0 点，只影响之后注册的客户，已有客户余额请在列表里手动调整。
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="grid gap-1 text-[12px] text-[#667085]">
              赠送点数
              <input
                className="inputtext h-[34px] w-[120px] text-center"
                disabled={isBusy}
                min={0}
                onChange={(event) => setSignupGrant(event.target.value)}
                type="number"
                value={signupGrant}
              />
            </label>
            <button
              className="admin_btn inline-flex h-[34px] shrink-0 items-center gap-1 whitespace-nowrap"
              disabled={isBusy}
              onClick={saveSignupCreditGrant}
              type="button"
            >
              {busyAction?.key === "signup-credit-grant" ? "保存中" : "保存配置"}
            </button>
          </div>
        </div>
      </div>
      <div className="mt-4 rounded-[12px] border border-[#edf2f7] bg-[#fbfcfe] px-3 py-3">
        <div className="flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-wrap gap-2">
            <input
              className="inputtext min-w-[240px]"
              disabled={isBusy}
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(1);
              }}
              placeholder="搜索客户名、邮箱、客户 ID"
              value={query}
            />
            <select
              className="selectmini min-w-[150px]"
              disabled={isBusy}
              onChange={(event) => {
                setStatusFilter(event.target.value as Customer["status"] | "");
                setPage(1);
              }}
              value={statusFilter}
            >
              <option value="">全部状态</option>
              <option value="active">{customerStatusLabels.active}</option>
              <option value="past_due">{customerStatusLabels.past_due}</option>
              <option value="blocked">{customerStatusLabels.blocked}</option>
            </select>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="admin_btn inline-flex h-[30px] shrink-0 items-center gap-1 whitespace-nowrap" disabled={isBusy} onClick={resetFilters} type="button">
              重置
            </button>
            <button className="admin_btn inline-flex h-[30px] shrink-0 items-center gap-1 whitespace-nowrap" disabled={isBusy} onClick={exportCustomers} type="button">
              导出顾客
            </button>
          </div>
        </div>
      </div>
      <div className="mt-4 overflow-x-auto">
        <table className="list min-w-[1080px]">
          <thead>
            <tr>
              <th className="bgtt aleft">客户</th>
              <th className="bgtt aleft">邮箱</th>
              <th className="bgtt">状态</th>
              <th className="bgtt">后台类型</th>
              <th className="bgtt">余额</th>
              <th className="bgtt">调整额度</th>
            </tr>
          </thead>
          <tbody>
            {visibleItems.map((customer) => {
              const admin = adminByEmail.get(customer.email.trim().toLowerCase());
              return (
              <tr key={customer.id}>
                <td className="aleft">
                  <span className="block font-medium text-[#333]">{customer.name}</span>
                  <span className="font-mono text-[11px] text-[#999]">{customer.id}</span>
                </td>
                <td className="aleft truncate text-[#666]">{customer.email}</td>
                <td>
                  <select
                    className="selectmini input100"
                    disabled={isBusy}
                    onChange={(event) => updateStatus(customer.id, event.target.value as Customer["status"])}
                    value={customer.status}
                  >
                    <option value="active">{customerStatusLabels.active}</option>
                    <option value="past_due">{customerStatusLabels.past_due}</option>
                    <option value="blocked">{customerStatusLabels.blocked}</option>
                  </select>
                </td>
                <td>
                  {admin ? (
                    <span className="inline-flex h-[30px] shrink-0 items-center gap-1 whitespace-nowrap rounded-[8px] border border-emerald-200 bg-emerald-50 px-3 text-[12px] font-semibold text-emerald-700">
                      <ShieldCheck className="h-3.5 w-3.5" strokeWidth={1.8} />
                      {siteAdminRoleLabels[admin.role]}
                    </span>
                  ) : (
                    <button className="admin_btn inline-flex h-[30px] shrink-0 items-center gap-1 whitespace-nowrap" disabled={isBusy} onClick={() => promoteToAdmin(customer)} type="button">
                      <ShieldCheck className="h-3.5 w-3.5" strokeWidth={1.8} />
                      设为管理员
                    </button>
                  )}
                </td>
                <td>
                  <span className="block font-mono text-[#333]">{customer.balance.available} 点</span>
                  <span className="font-mono text-[11px] text-[#999]">预扣 {customer.balance.reserved} 点</span>
                </td>
                <td>
                  <span className="inline-flex items-center justify-center gap-1">
                    <input
                      className="inputtext input100 text-center"
                      disabled={isBusy}
                      onChange={(event) => setAdjustments((current) => ({ ...current, [customer.id]: event.target.value }))}
                      placeholder="+/- 额度"
                      type="number"
                      value={adjustments[customer.id] ?? ""}
                    />
                    <button className="admin_btn inline-flex h-[30px] shrink-0 items-center gap-1 whitespace-nowrap" disabled={isBusy} onClick={() => adjustCredits(customer.id)} type="button">
                      {busyAction?.key === `credits:${customer.id}` ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.8} />
                      ) : (
                        <Coins className="h-3.5 w-3.5" strokeWidth={1.8} />
                      )}
                      {busyAction?.key === `credits:${customer.id}` ? "调整中" : "调整"}
                    </button>
                  </span>
                </td>
              </tr>
            );
            })}
            {!filteredItems.length ? (
              <tr>
                <td className="text-center text-[#999]" colSpan={6}>当前筛选下没有顾客记录。</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <AdminPagination
        total={filteredItems.length}
        page={currentPage}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={(nextPageSize) => {
          setPageSize(nextPageSize);
          setPage(1);
        }}
      />
    </div>
  );
}
