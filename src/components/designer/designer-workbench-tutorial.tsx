"use client";

import { BookOpen, CheckCircle2, FileText, Globe2, Save, SearchCheck, X } from "lucide-react";

const steps = [
  {
    title: "选择页面",
    body: "先在左侧页面目录或顶部页面菜单选择要装修的页面。登录页、购物车、政策页可能没有页面模块，但仍会显示全局页头和页脚。"
  },
  {
    title: "定位文案",
    body: "在右侧文案定位器输入预览里看到的文字。结果会标明来源：当前页面、全局配置、导航菜单、SEO 或代码硬编码。"
  },
  {
    title: "修改字段",
    body: "默认是编辑定位模式：点击预览里的按钮或链接只会选中字段，不会跳转。要检查真实业务交互时，再切到真实交互预览。"
  },
  {
    title: "保存预览",
    body: "保存草稿只写入后台草稿区，不会影响线上。保存后可以刷新预览检查效果，也可以继续改其他页面。"
  },
  {
    title: "发布上线",
    body: "发布会更新整站线上快照：当前页面、隐藏草稿页和全局设置会一起上线。如果别人先改过草稿或线上版本，系统会用 409 拦住这次发布。"
  }
];

const examples = [
  "改 Logo：全局页头/页脚里找到品牌 Logo 或品牌字段。",
  "改导航：点“编辑导航”，维护页眉导航和页脚导航链接。",
  "改首页 Hero：选择首页，搜索首屏主标题，进入当前页面模块字段。",
  "改 Footer 公司信息：搜索地址、邮箱或 Company，跳到全局页脚字段。",
  "改 SEO 标题：点“编辑 SEO”，保存草稿后发布整站快照才会上线。",
  "处理 409 冲突：刷新装修器，重新确认草稿内容，再保存和发布。"
];

export function DesignerWorkbenchTutorial({
  open,
  onClose
}: {
  open: boolean;
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4 py-6" data-designer-layout="saas-workbench-tutorial-modal">
      <div className="flex max-h-[88vh] w-full max-w-[860px] flex-col overflow-hidden rounded-[14px] border border-[#d9dde4] bg-white shadow-[0_30px_80px_-30px_rgba(15,23,42,0.45)]">
        <div className="flex items-start justify-between gap-4 border-b border-[#e6e9ee] px-5 py-4">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 text-[12px] font-medium uppercase tracking-[0.14em] text-[#667085]">
              <BookOpen className="h-4 w-4" strokeWidth={1.8} />
              新手教程
            </div>
            <h2 className="mt-1 text-[20px] font-semibold text-[#101828]">后台装修文案操作流程</h2>
            <p className="mt-1 text-[13px] leading-6 text-[#667085]">
              目标是先找到文案来源，再编辑字段，最后保存草稿并发布整站快照。
            </p>
          </div>
          <button
            aria-label="关闭新手教程"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-[8px] border border-[#d9dde4] text-[#475467] transition hover:border-[#98a2b3] hover:text-[#101828]"
            onClick={onClose}
            type="button"
          >
            <X className="h-4 w-4" strokeWidth={1.8} />
          </button>
        </div>

        <div className="min-h-0 overflow-y-auto px-5 py-4">
          <div className="grid gap-3 md:grid-cols-5">
            {steps.map((step, index) => (
              <div className="rounded-[8px] border border-[#e6e9ee] bg-[#fafbfc] p-3" key={step.title}>
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#2f6fed] font-mono text-[12px] font-semibold text-white">
                  {index + 1}
                </span>
                <h3 className="mt-3 text-[13px] font-semibold text-[#101828]">{step.title}</h3>
                <p className="mt-2 text-[12px] leading-5 text-[#667085]">{step.body}</p>
              </div>
            ))}
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-[1.1fr_0.9fr]">
            <section className="rounded-[8px] border border-[#e6e9ee] bg-white p-4">
              <div className="flex items-center gap-2 text-[13px] font-semibold text-[#101828]">
                <SearchCheck className="h-4 w-4 text-[#2f6fed]" strokeWidth={1.8} />
                常见修改路径
              </div>
              <div className="mt-3 grid gap-2">
                {examples.map((example) => (
                  <div className="flex gap-2 text-[12px] leading-5 text-[#475467]" key={example}>
                    <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#18794e]" strokeWidth={1.8} />
                    <span>{example}</span>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-[8px] border border-[#f2d3a4] bg-[#fff8ed] p-4">
              <div className="flex items-center gap-2 text-[13px] font-semibold text-[#8a5a1f]">
                <Globe2 className="h-4 w-4" strokeWidth={1.8} />
                上线规则
              </div>
              <div className="mt-3 grid gap-3 text-[12px] leading-5 text-[#8a5a1f]">
                <p className="flex gap-2">
                  <Save className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={1.8} />
                  <span>保存草稿不会上线，只是把当前后台配置保存到草稿区。</span>
                </p>
                <p className="flex gap-2">
                  <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={1.8} />
                  <span>发布会把页面草稿、全局设置和隐藏草稿一起写入线上快照。</span>
                </p>
                <p>代码部署只更新渲染逻辑，不会自动覆盖数据库里的已发布文案；若字段契约变化，需要先做兼容或迁移。</p>
              </div>
            </section>
          </div>
        </div>

        <div className="flex justify-end border-t border-[#e6e9ee] px-5 py-4">
          <button
            className="rounded-[8px] border border-[#2f6fed] bg-[#2f6fed] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#2457c5]"
            onClick={onClose}
            type="button"
          >
            开始操作
          </button>
        </div>
      </div>
    </div>
  );
}
