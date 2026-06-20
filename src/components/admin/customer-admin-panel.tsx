"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Coins } from "lucide-react";
import { downloadCsv } from "@/components/admin/export-utils";
import type { Customer, PublicCustomer } from "@/lib/types";

export function CustomerAdminPanel({ siteId, customers }: { siteId: string; customers: PublicCustomer[] }) {
  const router = useRouter();
  const [items, setItems] = useState(customers);
  const [adjustments, setAdjustments] = useState<Record<string, string>>({});
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<Customer["status"] | "">("");
  const [message, setMessage] = useState("Customer changes are site-scoped and persisted.");

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

  async function updateStatus(customerId: string, status: Customer["status"]) {
    const response = await fetch(`/api/sites/${siteId}/customers/${customerId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status })
    });
    const result = (await response.json().catch(() => ({}))) as { customer?: PublicCustomer; error?: string };
    if (response.ok && result.customer) {
      setItems((current) => current.map((item) => (item.id === customerId ? result.customer ?? item : item)));
      setMessage(`${result.customer.email} set to ${result.customer.status}.`);
      router.refresh();
    } else {
      setMessage(result.error ?? "Status update failed.");
    }
  }

  async function adjustCredits(customerId: string) {
    const amount = Number(adjustments[customerId] ?? 0);
    const response = await fetch(`/api/sites/${siteId}/customers/${customerId}/credits/adjust`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount, reason: "site admin manual adjustment", actor: "site_admin_demo" })
    });
    const result = (await response.json().catch(() => ({}))) as { customer?: PublicCustomer; error?: string };
    if (response.ok && result.customer) {
      setItems((current) => current.map((item) => (item.id === customerId ? result.customer ?? item : item)));
      setAdjustments((current) => ({ ...current, [customerId]: "" }));
      setMessage(`${result.customer.email} credits adjusted by ${amount}.`);
      router.refresh();
    } else {
      setMessage(result.error ?? "Credit adjustment failed.");
    }
  }

  function resetFilters() {
    setQuery("");
    setStatusFilter("");
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
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索客户名、邮箱、客户 ID"
              value={query}
            />
            <select className="selectmini min-w-[150px]" onChange={(event) => setStatusFilter(event.target.value as Customer["status"] | "")} value={statusFilter}>
              <option value="">全部状态</option>
              <option value="active">active</option>
              <option value="past_due">past_due</option>
              <option value="blocked">blocked</option>
            </select>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="admin_btn inline-flex h-[30px] items-center gap-1" onClick={resetFilters} type="button">
              重置
            </button>
            <button className="admin_btn inline-flex h-[30px] items-center gap-1" onClick={exportCustomers} type="button">
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
            {filteredItems.map((customer) => (
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
                    <option value="active">active</option>
                    <option value="past_due">past_due</option>
                    <option value="blocked">blocked</option>
                  </select>
                </td>
                <td>
                  <span className="block font-mono text-[#333]">{customer.balance.available} cr</span>
                  <span className="font-mono text-[11px] text-[#999]">reserved {customer.balance.reserved} cr</span>
                </td>
                <td>
                  <span className="inline-flex items-center justify-center gap-1">
                    <input
                      className="inputtext input100 text-center"
                      onChange={(event) => setAdjustments((current) => ({ ...current, [customer.id]: event.target.value }))}
                      placeholder="+/- credits"
                      type="number"
                      value={adjustments[customer.id] ?? ""}
                    />
                    <button className="admin_btn inline-flex h-[30px] items-center gap-1" onClick={() => adjustCredits(customer.id)}>
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
    </div>
  );
}
