"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw } from "lucide-react";
import type { AiApp, GenerationJob, PublicCustomer } from "@/lib/types";
import { StatusPill } from "@/components/ui";

function tone(status: string): "good" | "warn" | "bad" | "neutral" {
  if (status === "succeeded") return "good";
  if (status === "failed" || status === "refunded") return "bad";
  if (status === "queued" || status === "running") return "warn";
  return "neutral";
}

export function JobsAdminPanel({
  siteId,
  jobs,
  customers,
  aiApps
}: {
  siteId: string;
  jobs: GenerationJob[];
  customers: PublicCustomer[];
  aiApps: AiApp[];
}) {
  const router = useRouter();
  const [items, setItems] = useState(jobs);
  const [message, setMessage] = useState("Failed or refunded jobs can be rerun from the site admin.");

  useEffect(() => {
    setItems(jobs);
  }, [jobs]);

  async function rerun(jobId: string) {
    const response = await fetch(`/api/sites/${siteId}/ai/jobs/${jobId}/rerun`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actor: "site_admin_demo" })
    });
    const result = (await response.json().catch(() => ({}))) as { job?: GenerationJob; error?: string };
    if (response.ok && result.job) {
      setItems((current) => [result.job as GenerationJob, ...current]);
      setMessage(`Rerun created: ${result.job.id}.`);
      router.refresh();
    } else {
      setMessage(result.error ?? "Rerun failed.");
    }
  }

  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-[16px] font-semibold text-[#333]">生成任务队列</h2>
          <p className="mt-1 text-[12px] text-[#666]">{message}</p>
        </div>
      </div>
      <div className="mt-4 overflow-x-auto">
        <table className="list min-w-[880px]">
          <thead>
            <tr>
              <th className="bgtt aleft">工具 / 任务</th>
              <th className="bgtt aleft">顾客</th>
              <th className="bgtt">状态</th>
              <th className="bgtt">预扣</th>
              <th className="bgtt">操作</th>
            </tr>
          </thead>
          <tbody>
            {items.map((job) => {
              const customer = customers.find((item) => item.id === job.customerId);
              const app = aiApps.find((item) => item.id === job.aiAppId);
              const canRerun = job.status === "failed" || job.status === "refunded";
              return (
                <tr key={job.id}>
                  <td className="aleft">
                    <span className="block font-medium text-[#333]">{app?.name ?? job.aiAppId}</span>
                    <span className="font-mono text-[11px] text-[#999]">{job.id}</span>
                  </td>
                  <td className="aleft truncate text-[#666]">{customer?.email ?? job.customerId}</td>
                  <td><StatusPill label={job.status} tone={tone(job.status)} /></td>
                  <td className="font-mono text-[#333]">{job.creditsReserved} cr</td>
                  <td>
                    <button
                      className="admin_btn inline-flex items-center gap-1 disabled:opacity-35"
                      disabled={!canRerun}
                      onClick={() => rerun(job.id)}
                    >
                      <RotateCcw className="h-3 w-3" strokeWidth={1.8} />
                      重跑
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
