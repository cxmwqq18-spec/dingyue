import Link from "next/link";
import type { AdminTone } from "@/lib/admin-menu";
import type { AdminCommandAction, AdminQuickAction, AdminStatBadge } from "./admin-types";

function statToneClass(tone: AdminTone = "neutral") {
  return {
    good: "border-[#c8ead3] bg-[#effaf2] text-[#18794e]",
    warn: "border-[#f3d3aa] bg-[#fff5e8] text-[#b4691f]",
    bad: "border-[#f1c2c2] bg-[#fff1f1] text-[#c24141]",
    neutral: "border-[#d7dee8] bg-[#f7f9fc] text-[#667085]"
  }[tone];
}

function quickActionToneClass(tone: AdminTone = "neutral") {
  return {
    good: "hover:border-[#84cc9b] hover:bg-[#f6fff8] hover:text-[#18794e]",
    warn: "hover:border-[#f3d3aa] hover:bg-[#fff8ef] hover:text-[#b4691f]",
    bad: "hover:border-[#f1c2c2] hover:bg-[#fff4f4] hover:text-[#c24141]",
    neutral: "hover:border-[#479dff] hover:text-[#479dff]"
  }[tone];
}

function commandActionToneClass(tone: AdminTone = "neutral") {
  return {
    good: "border-[#bde3c7] bg-white text-[#18794e] hover:bg-[#f6fff8]",
    warn: "border-[#f3d3aa] bg-white text-[#b4691f] hover:bg-[#fff9f1]",
    bad: "border-[#f1c2c2] bg-white text-[#c24141] hover:bg-[#fff4f4]",
    neutral: "border-[#d7dee8] bg-white text-[#475467] hover:border-[#479dff] hover:text-[#479dff]"
  }[tone];
}

export function AdminCommandBar({
  commandActions,
  quickActions,
  stats
}: {
  commandActions: AdminCommandAction[];
  quickActions: AdminQuickAction[];
  stats: AdminStatBadge[];
}) {
  return (
    <div className="grid gap-2.5 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
      {commandActions.length ? (
        <div className="flex flex-wrap items-center gap-2" data-admin-command-bar="saas-style">
          {commandActions.map((item) => (
            <Link
              className={`inline-flex h-[30px] items-center gap-1 rounded-[7px] border px-2.5 text-[12px] font-medium shadow-none transition active:translate-y-px ${commandActionToneClass(item.tone)}`}
              href={item.href}
              key={`${item.href}:${item.label}`}
            >
              <item.icon className="h-3.5 w-3.5" strokeWidth={1.8} />
              <span>{item.label}</span>
              {item.badge ? <span className="rounded-[999px] border border-[#eef0f3] bg-[#fafbfd] px-1.5 py-0.5 font-mono text-[10px] text-[#98a2b3]">{item.badge}</span> : null}
            </Link>
          ))}
        </div>
      ) : null}

      {stats.length ? (
        <div className="flex flex-wrap gap-1.5">
          {stats.map((item) => (
            <span className={`inline-flex h-[24px] items-center rounded-[999px] border px-2.5 text-[11px] shadow-none ${statToneClass(item.tone)}`} key={`${item.label}:${item.value}`}>
              <span className="font-mono text-[10px] uppercase opacity-80">{item.label}</span>
              <span className="ml-2 font-mono">{item.value}</span>
            </span>
          ))}
        </div>
      ) : null}
      </div>

      {quickActions.length ? (
        <div className="flex flex-wrap gap-1.5 xl:justify-end">
          {quickActions.map((item) => (
            <Link
              className={`inline-flex h-[24px] items-center gap-1 rounded-[7px] border border-[#e5e9ef] bg-[#fbfcfe] px-2.5 text-[11px] text-[#667085] transition active:translate-y-px ${quickActionToneClass(item.tone)}`}
              href={item.href}
              key={`${item.href}:${item.label}`}
            >
              <item.icon className="h-3.5 w-3.5" strokeWidth={1.8} />
              {item.label}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}
