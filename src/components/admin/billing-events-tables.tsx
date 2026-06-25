"use client";

import { useEffect, useMemo, useState } from "react";
import { AdminPagination, clampPage, pageItems } from "@/components/admin/admin-pagination";
import { StatusPill } from "@/components/ui";
import type { CreditLedgerEntry, GenerationJob, Order, PaymentEvent } from "@/lib/types";

type CustomerLookup = { id: string; email: string };

function formatDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value));
}

function ledgerTypeLabel(type: string) {
  const labels: Record<string, string> = {
    grant: "购买入账",
    adjustment: "人工调整",
    reserve: "生成预扣",
    release: "额度释放",
    consume: "生成扣减"
  };
  return labels[type] ?? type;
}

function ledgerRelation(
  entry: CreditLedgerEntry,
  ordersByRelationId: Map<string, Order>,
  jobsById: Map<string, GenerationJob>
) {
  const order = ordersByRelationId.get(entry.sourceId);
  const job = jobsById.get(entry.sourceId);
  if (order) return { label: "订单", value: `${order.sourceId} / ${order.credits} 点` };
  if (job) return { label: "任务", value: `${job.id} / 预扣 ${job.creditsReserved}` };
  if (entry.sourceType.startsWith("site_admin_adjustment")) return { label: "人工", value: entry.sourceType.split(":").slice(1).join(" / ") || entry.sourceId };
  return { label: entry.sourceType, value: entry.sourceId };
}

export function BillingEventsTables({
  customers,
  jobs,
  ledger,
  orders,
  paymentEvents,
  mode = "both"
}: {
  customers: CustomerLookup[];
  jobs: GenerationJob[];
  ledger: CreditLedgerEntry[];
  orders: Order[];
  paymentEvents: PaymentEvent[];
  mode?: "ledger" | "events" | "both";
}) {
  const [ledgerPage, setLedgerPage] = useState(1);
  const [ledgerPageSize, setLedgerPageSize] = useState(10);
  const [eventPage, setEventPage] = useState(1);
  const [eventPageSize, setEventPageSize] = useState(10);
  const customerEmailById = useMemo(() => new Map(customers.map((customer) => [customer.id, customer.email])), [customers]);
  const ordersByRelationId = useMemo(() => {
    const index = new Map<string, Order>();
    for (const order of orders) {
      index.set(order.id, order);
      index.set(order.sourceId, order);
    }
    return index;
  }, [orders]);
  const jobsById = useMemo(() => new Map(jobs.map((job) => [job.id, job])), [jobs]);

  useEffect(() => {
    setLedgerPage((current) => clampPage(current, ledger.length, ledgerPageSize));
  }, [ledger.length, ledgerPageSize]);

  useEffect(() => {
    setEventPage((current) => clampPage(current, paymentEvents.length, eventPageSize));
  }, [paymentEvents.length, eventPageSize]);

  const visibleLedger = pageItems(ledger, ledgerPage, ledgerPageSize);
  const visibleEvents = pageItems(paymentEvents, eventPage, eventPageSize);

  return (
    <div className="grid gap-5">
      {mode === "ledger" || mode === "both" ? (
      <div>
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="grid gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs font-semibold text-slate-500 md:grid-cols-[0.35fr_0.25fr_1fr_0.48fr]">
            <span>类型</span>
            <span>数量</span>
            <span>顾客 / 来源</span>
            <span>时间</span>
          </div>
          {visibleLedger.map((entry) => {
            const customerEmail = customerEmailById.get(entry.customerId);
            const relation = ledgerRelation(entry, ordersByRelationId, jobsById);
            return (
              <div className="grid gap-3 border-b border-slate-100 px-4 py-3 text-sm last:border-b-0 md:grid-cols-[0.35fr_0.25fr_1fr_0.48fr]" key={entry.id}>
                <span className="font-medium text-slate-900">{ledgerTypeLabel(entry.type)}</span>
                <span className={`font-mono ${entry.amount < 0 ? "text-red-700" : "text-slate-900"}`}>{entry.amount}</span>
                <span className="min-w-0">
                  <span className="block truncate text-xs font-medium text-slate-800">{customerEmail ?? entry.customerId}</span>
                  <span className="block truncate font-mono text-[11px] text-slate-500">{relation.label}: {relation.value}</span>
                </span>
                <span className="font-mono text-xs text-slate-400">{formatDate(entry.createdAt)}</span>
              </div>
            );
          })}
          {!ledger.length ? <div className="p-5 text-sm text-slate-500">暂无额度账本记录。</div> : null}
        </div>
        <AdminPagination
          onPageChange={setLedgerPage}
          onPageSizeChange={(pageSize) => {
            setLedgerPageSize(pageSize);
            setLedgerPage(1);
          }}
          page={ledgerPage}
          pageSize={ledgerPageSize}
          total={ledger.length}
        />
      </div>
      ) : null}

      {mode === "events" || mode === "both" ? (
      <div>
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-[12px] font-medium text-slate-500">支付事件</p>
          </div>
          {visibleEvents.length ? (
            visibleEvents.map((event) => (
              <div className="border-b border-slate-100 p-4 text-sm last:border-b-0" key={event.id}>
                <div className="flex items-center justify-between gap-3">
                  <p className="truncate font-medium text-slate-900">{event.eventType}</p>
                  <StatusPill label={event.provider} tone="neutral" />
                </div>
                <p className="mt-1 truncate font-mono text-xs text-slate-500">{event.providerEventId}</p>
              </div>
            ))
          ) : (
            <div className="p-5 text-sm text-slate-500">暂未记录支付事件。</div>
          )}
        </div>
        <AdminPagination
          onPageChange={setEventPage}
          onPageSizeChange={(pageSize) => {
            setEventPageSize(pageSize);
            setEventPage(1);
          }}
          page={eventPage}
          pageSize={eventPageSize}
          total={paymentEvents.length}
        />
      </div>
      ) : null}
    </div>
  );
}
