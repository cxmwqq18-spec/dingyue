"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Save, Trash2 } from "lucide-react";
import type { Price, Product } from "@/lib/types";
import { downloadCsv } from "@/components/admin/export-utils";

type PriceDraft = {
  label: string;
  amountCents: number;
  currency: string;
  interval: Price["interval"];
  creditsGranted: number;
  stripePriceId: string;
  metadata: Record<string, string | number | boolean>;
};

function normalizeMetadata(metadata?: Price["metadata"]): Record<string, string | number | boolean> {
  return {
    generatedPhotos: typeof metadata?.generatedPhotos === "number" ? metadata.generatedPhotos : 0,
    destinationCount: typeof metadata?.destinationCount === "number" ? metadata.destinationCount : 0,
    deliveryDays: typeof metadata?.deliveryDays === "number" ? metadata.deliveryDays : 0,
    revisions: typeof metadata?.revisions === "string" ? metadata.revisions : "",
    featured: typeof metadata?.featured === "boolean" ? metadata.featured : false
  };
}

function createDraftPrice(product: Product): PriceDraft {
  const currency = product.prices[0]?.currency ?? "usd";
  const interval: Price["interval"] = product.type === "subscription" ? "month" : "one_time";
  return {
    label: product.type === "subscription" ? "New monthly price" : "New credit pack",
    amountCents: 0,
    currency,
    interval,
    creditsGranted: 0,
    stripePriceId: "",
    metadata: {
      generatedPhotos: 0,
      destinationCount: 0,
      deliveryDays: 0,
      revisions: "",
      featured: false
    }
  };
}

function normalizePrice(price: Price): Price {
  return {
    ...price,
    metadata: normalizeMetadata(price.metadata)
  };
}

function numberValue(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function updatePriceMetadata(price: Price, field: string, value: string | boolean): Price {
  const metadata = normalizeMetadata(price.metadata);
  return {
    ...price,
    metadata: {
      ...metadata,
      [field]: typeof value === "boolean" ? value : field === "revisions" ? value : numberValue(value)
    }
  };
}

function updateDraftMetadata(draft: PriceDraft, field: string, value: string | boolean): PriceDraft {
  return {
    ...draft,
    metadata: {
      ...draft.metadata,
      [field]: typeof value === "boolean" ? value : field === "revisions" ? value : numberValue(value)
    }
  };
}

export function PricingEditor({ siteId, products }: { siteId: string; products: Product[] }) {
  const router = useRouter();
  const [items, setItems] = useState(products.map((product) => ({ ...product, prices: product.prices.map(normalizePrice) })));
  const [drafts, setDrafts] = useState<Record<string, PriceDraft>>({});
  const [message, setMessage] = useState("价格与婚礼套餐属性都会持久化到 data/platform-state.json。");

  useEffect(() => {
    setItems(products.map((product) => ({ ...product, prices: product.prices.map(normalizePrice) })));
    setDrafts(Object.fromEntries(products.map((product) => [product.id, createDraftPrice(product)])));
  }, [products]);

  function updatePrice(productId: string, priceId: string, field: string, value: string) {
    setItems((current) =>
      current.map((product) => {
        if (product.id !== productId) return product;
        return {
          ...product,
          prices: product.prices.map((price) =>
            price.id === priceId
              ? {
                  ...price,
                  [field]: field === "amountCents" || field === "creditsGranted" ? numberValue(value) : value
                }
              : price
          )
        };
      })
    );
  }

  function updatePriceMeta(productId: string, priceId: string, field: string, value: string | boolean) {
    setItems((current) =>
      current.map((product) => {
        if (product.id !== productId) return product;
        return {
          ...product,
          prices: product.prices.map((price) => (price.id === priceId ? updatePriceMetadata(price, field, value) : price))
        };
      })
    );
  }

  function updateDraft(productId: string, field: string, value: string) {
    setDrafts((current) => ({
      ...current,
      [productId]: {
        ...(current[productId] ?? createDraftPrice(items.find((item) => item.id === productId) ?? products[0])),
        [field]: field === "amountCents" || field === "creditsGranted" ? numberValue(value) : value
      }
    }));
  }

  function updateDraftMeta(productId: string, field: string, value: string | boolean) {
    setDrafts((current) => ({
      ...current,
      [productId]: updateDraftMetadata(
        current[productId] ?? createDraftPrice(items.find((item) => item.id === productId) ?? products[0]),
        field,
        value
      )
    }));
  }

  async function save(product: Product, priceId: string) {
    const price = product.prices.find((item) => item.id === priceId);
    if (!price) {
      setMessage(`${product.name} save failed: price not found.`);
      return;
    }
    const response = await fetch(`/api/sites/${siteId}/products/${product.id}/prices/${price.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(price)
    });
    const result = (await response.json().catch(() => ({}))) as { price?: Product["prices"][number]; error?: string };
    if (response.ok && result.price) {
      const normalized = normalizePrice(result.price);
      setItems((current) =>
        current.map((item) =>
          item.id === product.id
            ? {
                ...item,
                prices: item.prices.map((entry) => (entry.id === normalized.id ? normalized : entry))
              }
            : item
        )
      );
      setMessage(`${product.name} / ${normalized.label} saved.`);
      router.refresh();
      return;
    }
    setMessage(result.error ? `${product.name} save failed: ${result.error}.` : `${product.name} / ${price.label} save failed.`);
  }

  async function createPrice(product: Product) {
    const draft = drafts[product.id];
    if (!draft) return;
    const response = await fetch(`/api/sites/${siteId}/products/${product.id}/prices`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draft)
    });
    const result = (await response.json().catch(() => ({}))) as { price?: Product["prices"][number]; error?: string };
    if (response.ok && result.price) {
      const normalized = normalizePrice(result.price);
      setItems((current) =>
        current.map((item) =>
          item.id === product.id
            ? {
                ...item,
                prices: [...item.prices, normalized]
              }
            : item
        )
      );
      setDrafts((current) => ({
        ...current,
        [product.id]: createDraftPrice(product)
      }));
      setMessage(`${product.name} / ${normalized.label} created.`);
      router.refresh();
      return;
    }
    setMessage(result.error ? `${product.name} create failed: ${result.error}.` : `${product.name} create failed.`);
  }

  async function deletePrice(product: Product, priceId: string) {
    const response = await fetch(`/api/sites/${siteId}/products/${product.id}/prices/${priceId}`, {
      method: "DELETE"
    });
    const result = (await response.json().catch(() => ({}))) as { deletedPrice?: Product["prices"][number]; error?: string };
    if (response.ok && result.deletedPrice) {
      setItems((current) =>
        current.map((item) =>
          item.id === product.id
            ? {
                ...item,
                prices: item.prices.filter((entry) => entry.id !== priceId)
              }
            : item
        )
      );
      setMessage(`${product.name} / ${result.deletedPrice.label} deleted.`);
      router.refresh();
      return;
    }
    setMessage(result.error ? `${product.name} delete failed: ${result.error}.` : `${product.name} delete failed.`);
  }

  function exportPrices() {
    downloadCsv(
      `${siteId}-products-prices.csv`,
      items.flatMap((product) =>
        product.prices.map((price) => ({
          productId: product.id,
          productName: product.name,
          productType: product.type,
          productStatus: product.status,
          priceId: price.id,
          label: price.label,
          amountCents: price.amountCents,
          currency: price.currency,
          interval: price.interval,
          creditsGranted: price.creditsGranted,
          stripePriceId: price.stripePriceId,
          generatedPhotos: price.metadata?.generatedPhotos ?? 0,
          destinationCount: price.metadata?.destinationCount ?? 0,
          deliveryDays: price.metadata?.deliveryDays ?? 0,
          revisions: price.metadata?.revisions ?? "",
          featured: price.metadata?.featured ?? false
        }))
      ),
      [
        "productId",
        "productName",
        "productType",
        "productStatus",
        "priceId",
        "label",
        "amountCents",
        "currency",
        "interval",
        "creditsGranted",
        "stripePriceId",
        "generatedPhotos",
        "destinationCount",
        "deliveryDays",
        "revisions",
        "featured"
      ]
    );
    setMessage("商品、价格和婚礼套餐属性已导出为 CSV。");
  }

  function fieldLabel(label: string) {
    return <span className="mb-1 block text-[11px] font-medium uppercase tracking-[0.14em] text-[#98a2b3]">{label}</span>;
  }

  return (
    <div className="right_box border border-[#eee] bg-white p-3">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-[16px] font-semibold text-[#333]">套餐与价格</h2>
          <p className="mt-1 text-[12px] text-[#666]">{message}</p>
        </div>
        <button className="admin_btn inline-flex h-[30px] items-center gap-1" onClick={exportPrices} type="button">
          导出 CSV
        </button>
      </div>
      <div className="mt-4 space-y-4">
        {items.map((product) => (
          <div className="rounded-[16px] border border-[#eceff3] bg-[#fafbfc] p-4" key={product.id}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-[15px] font-semibold text-[#1f2937]">{product.name}</h3>
                <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.12em] text-[#98a2b3]">
                  {product.type} / {product.status} / {product.prices.length} price{product.prices.length > 1 ? "s" : ""}
                </p>
              </div>
              <div className="rounded-full border border-[#dbe4f0] bg-white px-3 py-1 text-[11px] font-medium text-[#4b5563]">
                {product.type === "subscription" ? "订阅套餐" : "积分加购"}
              </div>
            </div>

            <div className="mt-4 grid gap-3 xl:grid-cols-2">
              {product.prices.map((price) => (
                <div className="rounded-[14px] border border-[#e4e9f0] bg-white p-4 shadow-[0_10px_24px_-26px_rgba(15,23,42,0.3)]" key={price.id}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-semibold text-[#111827]">{price.label}</p>
                      <p className="mt-1 truncate font-mono text-[10px] text-[#98a2b3]">{price.id}</p>
                    </div>
                    {price.metadata?.featured ? (
                      <span className="rounded-full border border-[#f4d7a2] bg-[#fff6e7] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#c47a15]">
                        featured
                      </span>
                    ) : null}
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <label className="block">
                      {fieldLabel("价格标签")}
                      <input className="inputtext w-full" onChange={(event) => updatePrice(product.id, price.id, "label", event.target.value)} value={price.label} />
                    </label>
                    <label className="block">
                      {fieldLabel("周期")}
                      <select className="selectmini w-full" onChange={(event) => updatePrice(product.id, price.id, "interval", event.target.value)} value={price.interval}>
                        <option value="month">month</option>
                        <option value="one_time">one_time</option>
                      </select>
                    </label>
                    <label className="block">
                      {fieldLabel("金额")}
                      <input className="inputtext w-full" onChange={(event) => updatePrice(product.id, price.id, "amountCents", event.target.value)} value={price.amountCents} />
                    </label>
                    <label className="block">
                      {fieldLabel("Credits")}
                      <input className="inputtext w-full" onChange={(event) => updatePrice(product.id, price.id, "creditsGranted", event.target.value)} value={price.creditsGranted} />
                    </label>
                    <label className="block">
                      {fieldLabel("成片数")}
                      <input className="inputtext w-full" onChange={(event) => updatePriceMeta(product.id, price.id, "generatedPhotos", event.target.value)} value={String(price.metadata?.generatedPhotos ?? 0)} />
                    </label>
                    <label className="block">
                      {fieldLabel("目的地数")}
                      <input className="inputtext w-full" onChange={(event) => updatePriceMeta(product.id, price.id, "destinationCount", event.target.value)} value={String(price.metadata?.destinationCount ?? 0)} />
                    </label>
                    <label className="block">
                      {fieldLabel("交付天数")}
                      <input className="inputtext w-full" onChange={(event) => updatePriceMeta(product.id, price.id, "deliveryDays", event.target.value)} value={String(price.metadata?.deliveryDays ?? 0)} />
                    </label>
                    <label className="block">
                      {fieldLabel("修订规则")}
                      <input className="inputtext w-full" onChange={(event) => updatePriceMeta(product.id, price.id, "revisions", event.target.value)} value={String(price.metadata?.revisions ?? "")} />
                    </label>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#eef2f6] pt-4">
                    <label className="inline-flex items-center gap-2 text-[12px] font-medium text-[#4b5563]">
                      <input
                        checked={Boolean(price.metadata?.featured)}
                        onChange={(event) => updatePriceMeta(product.id, price.id, "featured", event.target.checked)}
                        type="checkbox"
                      />
                      设为主推套餐
                    </label>
                    <div className="flex items-center gap-2">
                      <button className="input_btn inline-flex h-[30px] items-center gap-1" onClick={() => save(product, price.id)} type="button">
                        <Save className="h-3.5 w-3.5" strokeWidth={1.8} />
                        保存
                      </button>
                      <button className="admin_del inline-flex h-[30px] items-center gap-1" onClick={() => deletePrice(product, price.id)} type="button">
                        <Trash2 className="h-3.5 w-3.5" strokeWidth={1.8} />
                        删除
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              <div className="rounded-[14px] border border-dashed border-[#d8dee8] bg-white/80 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[13px] font-semibold text-[#111827]">新增价格</p>
                    <p className="mt-1 text-[12px] leading-5 text-[#98a2b3]">为当前商品添加新的订阅价或积分包价格。</p>
                  </div>
                  <span className="rounded-full border border-[#dbe4f0] bg-[#f8fafc] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#64748b]">
                    new
                  </span>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <label className="block">
                    {fieldLabel("价格标签")}
                    <input className="inputtext w-full" onChange={(event) => updateDraft(product.id, "label", event.target.value)} value={drafts[product.id]?.label ?? ""} />
                  </label>
                  <label className="block">
                    {fieldLabel("周期")}
                    <select className="selectmini w-full" onChange={(event) => updateDraft(product.id, "interval", event.target.value)} value={drafts[product.id]?.interval ?? "month"}>
                      <option value="month">month</option>
                      <option value="one_time">one_time</option>
                    </select>
                  </label>
                  <label className="block">
                    {fieldLabel("金额")}
                    <input className="inputtext w-full" onChange={(event) => updateDraft(product.id, "amountCents", event.target.value)} value={drafts[product.id]?.amountCents ?? 0} />
                  </label>
                  <label className="block">
                    {fieldLabel("Credits")}
                    <input className="inputtext w-full" onChange={(event) => updateDraft(product.id, "creditsGranted", event.target.value)} value={drafts[product.id]?.creditsGranted ?? 0} />
                  </label>
                  <label className="block">
                    {fieldLabel("成片数")}
                    <input className="inputtext w-full" onChange={(event) => updateDraftMeta(product.id, "generatedPhotos", event.target.value)} value={String(drafts[product.id]?.metadata.generatedPhotos ?? 0)} />
                  </label>
                  <label className="block">
                    {fieldLabel("目的地数")}
                    <input className="inputtext w-full" onChange={(event) => updateDraftMeta(product.id, "destinationCount", event.target.value)} value={String(drafts[product.id]?.metadata.destinationCount ?? 0)} />
                  </label>
                  <label className="block">
                    {fieldLabel("交付天数")}
                    <input className="inputtext w-full" onChange={(event) => updateDraftMeta(product.id, "deliveryDays", event.target.value)} value={String(drafts[product.id]?.metadata.deliveryDays ?? 0)} />
                  </label>
                  <label className="block">
                    {fieldLabel("修订规则")}
                    <input className="inputtext w-full" onChange={(event) => updateDraftMeta(product.id, "revisions", event.target.value)} value={String(drafts[product.id]?.metadata.revisions ?? "")} />
                  </label>
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#eef2f6] pt-4">
                  <label className="inline-flex items-center gap-2 text-[12px] font-medium text-[#4b5563]">
                    <input
                      checked={Boolean(drafts[product.id]?.metadata.featured)}
                      onChange={(event) => updateDraftMeta(product.id, "featured", event.target.checked)}
                      type="checkbox"
                    />
                    设为主推套餐
                  </label>
                  <button className="admin_btn inline-flex h-[30px] items-center gap-1" onClick={() => createPrice(product)} type="button">
                    <Plus className="h-3.5 w-3.5" strokeWidth={1.8} />
                    新增
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
