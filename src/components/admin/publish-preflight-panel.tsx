import { AlertTriangle, BadgeCheck, CircleAlert, ShieldCheck } from "lucide-react";
import type { PublishPreflightCheck, PublishPreflightResult, PublishPreflightSeverity } from "@/lib/theme/publish-preflight";

const severityMeta: Record<PublishPreflightSeverity, { label: string; tagClass: string; rowClass: string; Icon: typeof ShieldCheck }> = {
  pass: {
    label: "通过",
    tagClass: "tag_green",
    rowClass: "",
    Icon: BadgeCheck,
  },
  warn: {
    label: "提醒",
    tagClass: "tag_org",
    rowClass: "bg-[#fffaf2]",
    Icon: AlertTriangle,
  },
  block: {
    label: "阻断",
    tagClass: "tag_gray cred",
    rowClass: "bg-[#fff5f5]",
    Icon: CircleAlert,
  }
};

function groupTitle(scope: PublishPreflightCheck["scope"]) {
  const titles: Record<PublishPreflightCheck["scope"], string> = {
    pages: "页面",
    navigation: "导航",
    commerce: "交易",
    ai: "AI",
    media: "素材",
    settings: "设置"
  };
  return titles[scope];
}

export function PublishPreflightPanel({ result }: { result: PublishPreflightResult }) {
  const groups = (["pages", "navigation", "commerce", "ai", "media", "settings"] as PublishPreflightCheck["scope"][])
    .map((scope) => ({ scope, checks: result.checks.filter((check) => check.scope === scope) }))
    .filter((group) => group.checks.length);

  return (
    <section className="right_box border border-[#eee] bg-white p-3" data-admin-layout="publish-preflight-panel">
      <div className="xt_tt">
        <span>发布前校验</span>
        <em className="ml-2 not-italic font-mono text-[10px] text-[#999]">publish preflight</em>
        <div className="clear" />
      </div>
      <div className="tixing mt-3">
        发布会把当前 draft pages 和 theme settings 推到前台。这里先检查页面、菜单、价格、AI 工具、素材绑定和 SEO。
      </div>
      <div className="search mt-3 border border-[#f1f1f1] bg-[#fafafa] px-3 py-1">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <span className={result.canPublish ? "tag_green" : "tag_gray cred"}>{result.canPublish ? "ready" : "blocked"}</span>
            <span className="inline-flex h-[30px] items-center border border-[#ddd] bg-white px-2 text-[12px] text-[#666]">阻断：<b className="ml-1 font-mono font-normal text-[#333]">{result.summary.blockers}</b></span>
            <span className="inline-flex h-[30px] items-center border border-[#ddd] bg-white px-2 text-[12px] text-[#666]">提醒：<b className="ml-1 font-mono font-normal text-[#333]">{result.summary.warnings}</b></span>
            <span className="inline-flex h-[30px] items-center border border-[#ddd] bg-white px-2 text-[12px] text-[#666]">分数：<b className="ml-1 font-mono font-normal text-[#333]">{result.score}</b></span>
          </div>
        </div>
      </div>

      <div className="mt-3 grid gap-3 xl:grid-cols-2">
          {groups.map((group) => (
            <div className="border border-[#eee] bg-white p-2" key={group.scope}>
              <div className="mb-2 flex items-center justify-between border-b border-[#f1f1f1] pb-2">
                <h3 className="text-[13px] font-semibold text-[#333]">{groupTitle(group.scope)}</h3>
                <span className="tag_gray">{group.checks.length} checks</span>
              </div>
              <table className="list">
                <tbody>
                  {group.checks.map((check) => {
                    const meta = severityMeta[check.severity];
                    return (
                      <tr className={meta.rowClass} key={check.id}>
                        <td className="w-[72px]">
                          <span className={meta.tagClass}>{meta.label}</span>
                        </td>
                        <td className="aleft">
                          <div className="flex items-start gap-2">
                            <meta.Icon className="mt-0.5 h-4 w-4 shrink-0 text-[#999]" strokeWidth={1.8} />
                            <div className="min-w-0">
                              <p className="font-medium text-[#333]">{check.title}</p>
                              <p className="mt-1 text-[12px] leading-5 text-[#666]">{check.detail}</p>
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ))}
      </div>
    </section>
  );
}
