"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Coins } from "lucide-react";
import { AdminPagination, clampPage, pageItems, adminPageSizeOptions } from "@/components/admin/admin-pagination";
import { downloadCsv } from "@/components/admin/export-utils";
import { siteAdminJsonHeaders } from "@/lib/client-csrf";
import type { Customer, PublicCustomer } from "@/lib/types";

const customerStatusLabels: Record<Customer["status"], string> = {
  active: "正常",
  past_due: "逾期",
  blocked: "已封禁"
};

export function CustomerAdminPanel({ siteId, customers }: { siteId: string; customers: PublicCustomer[] }) {
  const router = useRouter();
  const [items, setItems] = useState(customers);
  const [adjustments, setAdjustments] = useState<Record<string, string>>({});
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<Customer["status"] | "">("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(adminPageSizeOptions[0]);
  const [message, setMessage] = useState("客户变更仅作用于当前站点，并会立即保存。");

  useEffect(() => {
    setItems(customers);
  }, [customers]);

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

  async function updateStatus(customerId: string, status: Customer["status"]) {
    const response = await fetch(`/api/sites/${siteId}/customers/${customerId}/status`, {
      method: "PATCH",
      headers: siteAdminJsonHeaders(siteId),
      body: JSON.stringify({ status })
    });
    const result = (await response.json().catch(() => ({}))) as { customer?: PublicCustomer; error?: string };
    if (response.ok && result.customer) {
      setItems((current) => current.map((item) => (item.id === customerId ? result.customer ?? item : item)));
      setMessage(`${result.customer.email} 已更新为${customerStatusLabels[result.customer.status]}。`);
      router.refresh();
    } else {
      setMessage(result.error ?? "状态更新失败。");
    }
  }

  async function adjustCredits(customerId: string) {
    const amount = Number(adjustments[customerId] ?? 0);
    const response = await fetch(`/api/sites/${siteId}/customers/${customerId}/credits/adjust`, {
      method: "POST",
      headers: siteAdminJsonHeaders(siteId),
      body: JSON.stringify({ amount, reason: "site admin manual adjustment", actor: "site_admin_demo" })
    });
    const result = (await response.json().catch(() => ({}))) as { customer?: PublicCustomer; error?: string };
    if (response.ok && result.customer) {
      setItems((current) => current.map((item) => (item.id === customerId ? result.customer ?? item : item)));
      setAdjustments((current) => ({ ...current, [customerId]: "" }));
      setMessage(`${result.customer.email} 已调整 ${amount} 点额度。`);
      router.refresh();
    } else {
      setMessage(result.error ?? "额度调整失败。");
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

  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-[16px] font-semibold text-[#333]">会员与顾客列表</h2>
          <p className="mt-1 text-[12px] text-[#666]">{message}</p>
        </div>
      </div>
      <div className="mt-4 rounded-[12px] border border-[#edf2f7] bg-[#fbfcfe] px-3 py-3">
        <div className="flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-wrap gap-2">
            <input
              className="inputtext min-w-[240px]"
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(1);
              }}
              placeholder="搜索客户名、邮箱、客户 ID"
              value={query}
            />
            <select
              className="selectmini min-w-[150px]"
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
            <button className="admin_btn inline-flex h-[30px] shrink-0 items-center gap-1 whitespace-nowrap" onClick={resetFilters} type="button">
              重置
            </button>
            <button className="admin_btn inline-flex h-[30px] shrink-0 items-center gap-1 whitespace-nowrap" onClick={exportCustomers} type="button">
              导出顾客
            </button>
          </div>
        </div>
      </div>
      <div className="mt-4 overflow-x-auto">
        <table className="list min-w-[960px]">
          <thead>
            <tr>
              <th className="bgtt aleft">客户</th>
              <th className="bgtt aleft">邮箱</th>
              <th className="bgtt">状态</th>
              <th className="bgtt">余额</th>
              <th className="bgtt">调整额度</th>
            </tr>
          </thead>
          <tbody>
            {visibleItems.map((customer) => (
              <tr key={customer.id}>
                <td className="aleft">
                  <span className="block font-medium text-[#333]">{customer.name}</span>
                  <span className="font-mono text-[11px] text-[#999]">{customer.id}</span>
                </td>
                <td className="aleft truncate text-[#666]">{customer.email}</td>
                <td>
                  <select
                    className="selectmini input100"
                    onChange={(event) => updateStatus(customer.id, event.target.value as Customer["status"])}
                    value={customer.status}
                  >
                    <option value="active">{customerStatusLabels.active}</option>
                    <option value="past_due">{customerStatusLabels.past_due}</option>
                    <option value="blocked">{customerStatusLabels.blocked}</option>
                  </select>
                </td>
                <td>
                  <span className="block font-mono text-[#333]">{customer.balance.available} 点</span>
                  <span className="font-mono text-[11px] text-[#999]">预扣 {customer.balance.reserved} 点</span>
                </td>
                <td>
                  <span className="inline-flex items-center justify-center gap-1">
                    <input
                      className="inputtext input100 text-center"
                      onChange={(event) => setAdjustments((current) => ({ ...current, [customer.id]: event.target.value }))}
                      placeholder="+/- 额度"
                      type="number"
                      value={adjustments[customer.id] ?? ""}
                    />
                    <button className="admin_btn inline-flex h-[30px] shrink-0 items-center gap-1 whitespace-nowrap" onClick={() => adjustCredits(customer.id)}>
                      <Coins className="h-3.5 w-3.5" strokeWidth={1.8} />
                      调整
                    </button>
                  </span>
                </td>
              </tr>
            ))}
            {!filteredItems.length ? (
              <tr>
                <td className="text-center text-[#999]" colSpan={5}>当前筛选下没有顾客记录。</td>
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
