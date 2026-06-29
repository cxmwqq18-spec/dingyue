"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, Plus, Save, Trash2 } from "lucide-react";
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

type ProductDraft = {
  name: string;
  type: Product["type"];
  status: Product["status"];
  price: PriceDraft;
};

const textMetadataFields = new Set([
  "revisions",
  "planSubtitle",
  "featuresText",
  "badgeLabel",
  "editingLabel",
  "buttonLabel",
  "sidePanelEyebrow",
  "sidePanelTitle",
  "sidePanelBody",
  "sidePanelItemsText"
]);

function normalizeMetadata(metadata?: Price["metadata"]): Record<string, string | number | boolean> {
  return {
    generatedPhotos: typeof metadata?.generatedPhotos === "number" ? metadata.generatedPhotos : 0,
    destinationCount: typeof metadata?.destinationCount === "number" ? metadata.destinationCount : 0,
    deliveryDays: typeof metadata?.deliveryDays === "number" ? metadata.deliveryDays : 0,
    revisions: typeof metadata?.revisions === "string" ? metadata.revisions : "",
    planSubtitle: typeof metadata?.planSubtitle === "string" ? metadata.planSubtitle : "",
    featuresText: typeof metadata?.featuresText === "string" ? metadata.featuresText : "",
    badgeLabel: typeof metadata?.badgeLabel === "string" ? metadata.badgeLabel : "",
    editingLabel: typeof metadata?.editingLabel === "string" ? metadata.editingLabel : "",
    buttonLabel: typeof metadata?.buttonLabel === "string" ? metadata.buttonLabel : "",
    sidePanelEyebrow: typeof metadata?.sidePanelEyebrow === "string" ? metadata.sidePanelEyebrow : "",
    sidePanelTitle: typeof metadata?.sidePanelTitle === "string" ? metadata.sidePanelTitle : "",
    sidePanelBody: typeof metadata?.sidePanelBody === "string" ? metadata.sidePanelBody : "",
    sidePanelItemsText: typeof metadata?.sidePanelItemsText === "string" ? metadata.sidePanelItemsText : "",
    featured: typeof metadata?.featured === "boolean" ? metadata.featured : false
  };
}

function defaultMetadata(): Record<string, string | number | boolean> {
  return {
    generatedPhotos: 0,
    destinationCount: 0,
    deliveryDays: 0,
    revisions: "",
    planSubtitle: "",
    featuresText: "",
    badgeLabel: "",
    editingLabel: "",
    buttonLabel: "",
    sidePanelEyebrow: "",
    sidePanelTitle: "",
    sidePanelBody: "",
    sidePanelItemsText: "",
    featured: false
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
    metadata: defaultMetadata()
  };
}

function createDraftProduct(): ProductDraft {
  return {
    name: "新套餐",
    type: "subscription",
    status: "active",
    price: {
      label: "新套餐",
      amountCents: 0,
      currency: "usd",
      interval: "month",
      creditsGranted: 0,
      stripePriceId: "",
      metadata: defaultMetadata()
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

function productTypeLabel(type: Product["type"]) {
  return type === "subscription" ? "月度订阅商品" : "一次性积分包";
}

function intervalLabel(interval: Price["interval"]) {
  return interval === "month" ? "月度订阅" : "一次性购买";
}

function formatAmount(amountCents: number, currency: string) {
  return new Intl.NumberFormat("zh-CN", {
    currency: currency.toUpperCase(),
    maximumFractionDigits: amountCents % 100 === 0 ? 0 : 2,
    style: "currency"
  }).format(amountCents / 100);
}

function majorAmountValue(amountCents: number) {
  const amount = amountCents / 100;
  return Number.isInteger(amount) ? String(amount) : amount.toFixed(2).replace(/\.?0+$/, "");
}

function productSummary(product: Product) {
  const featured = product.prices.find((price) => price.metadata?.featured) ?? product.prices[0];
  const cheapest = [...product.prices].sort((left, right) => left.amountCents - right.amountCents)[0];
  return {
    featuredLabel: featured?.label ?? "未配置价格",
    lowest: cheapest ? formatAmount(cheapest.amountCents, cheapest.currency) : "未配置金额"
  };
}

function updatePriceMetadata(price: Price, field: string, value: string | boolean): Price {
  const metadata = normalizeMetadata(price.metadata);
  return {
    ...price,
    metadata: {
      ...metadata,
      [field]: typeof value === "boolean" ? value : textMetadataFields.has(field) ? value : numberValue(value)
    }
  };
}

function updateDraftMetadata(draft: PriceDraft, field: string, value: string | boolean): PriceDraft {
  return {
    ...draft,
    metadata: {
      ...draft.metadata,
      [field]: typeof value === "boolean" ? value : textMetadataFields.has(field) ? value : numberValue(value)
    }
  };
}

export function PricingEditor({ siteId, products }: { siteId: string; products: Product[] }) {
  const router = useRouter();
  const [items, setItems] = useState(products.map((product) => ({ ...product, prices: product.prices.map(normalizePrice) })));
  const [drafts, setDrafts] = useState<Record<string, PriceDraft>>({});
  const [productDraft, setProductDraft] = useState<ProductDraft>(() => createDraftProduct());
  const [creatingProduct, setCreatingProduct] = useState(false);
  const [message, setMessage] = useState("选择一个商品后维护价格。保存后会影响前台定价页、结账页和充值到账积分。");
  const [activeProductId, setActiveProductId] = useState(products[0]?.id ?? "");

  useEffect(() => {
    const normalizedProducts = products.map((product) => ({ ...product, prices: product.prices.map(normalizePrice) }));
    setItems(normalizedProducts);
    setDrafts(Object.fromEntries(products.map((product) => [product.id, createDraftPrice(product)])));
    setActiveProductId((current) => (normalizedProducts.some((product) => product.id === current) ? current : normalizedProducts[0]?.id ?? ""));
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

  function updatePriceAmount(productId: string, priceId: string, value: string) {
    const cents = Math.round(numberValue(value) * 100);
    updatePrice(productId, priceId, "amountCents", String(cents));
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

  function updateDraftAmount(productId: string, value: string) {
    const cents = Math.round(numberValue(value) * 100);
    updateDraft(productId, "amountCents", String(cents));
  }

  function updateProductDraft<K extends keyof ProductDraft>(field: K, value: ProductDraft[K]) {
    setProductDraft((current) => {
      if (field === "type") {
        const nextType = value as Product["type"];
        return {
          ...current,
          type: nextType,
          price: {
            ...current.price,
            interval: nextType === "subscription" ? "month" : "one_time"
          }
        };
      }
      return { ...current, [field]: value };
    });
  }

  function updateProductDraftPrice(field: keyof PriceDraft, value: string) {
    setProductDraft((current) => ({
      ...current,
      price: {
        ...current.price,
        [field]: field === "amountCents" || field === "creditsGranted" ? numberValue(value) : value
      }
    }));
  }

  function updateProductDraftAmount(value: string) {
    updateProductDraftPrice("amountCents", String(Math.round(numberValue(value) * 100)));
  }

  function updateProductDraftMeta(field: string, value: string | boolean) {
    setProductDraft((current) => ({
      ...current,
      price: updateDraftMetadata(current.price, field, value)
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
      setMessage(`${product.name} / ${normalized.label} 已保存。前台价格与结账到账积分会读取这份配置。`);
      router.refresh();
      return;
    }
    setMessage(result.error ? `${product.name} 保存失败：${result.error}` : `${product.name} / ${price.label} 保存失败。`);
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
      setMessage(`${product.name} / ${normalized.label} 已新增。请确认金额、周期和到账积分后打开定价页检查。`);
      router.refresh();
      return;
    }
    setMessage(result.error ? `${product.name} 新增失败：${result.error}` : `${product.name} 新增失败。`);
  }

  async function createProduct() {
    setCreatingProduct(true);
    const response = await fetch(`/api/sites/${siteId}/products`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(productDraft)
    });
    const result = (await response.json().catch(() => ({}))) as { product?: Product; error?: string };
    setCreatingProduct(false);
    if (response.ok && result.product) {
      const normalized = { ...result.product, prices: result.product.prices.map(normalizePrice) };
      setItems((current) => [normalized, ...current]);
      setDrafts((current) => ({ ...current, [normalized.id]: createDraftPrice(normalized) }));
      setActiveProductId(normalized.id);
      setProductDraft(createDraftProduct());
      setMessage(`${normalized.name} 已创建，并已自动创建首个价格。`);
      router.refresh();
      return;
    }
    setMessage(result.error ? `新增套餐商品失败：${result.error}` : "新增套餐商品失败。");
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
      setMessage(`${product.name} / ${result.deletedPrice.label} 已删除。`);
      router.refresh();
      return;
    }
    setMessage(result.error ? `${product.name} 删除失败：${result.error}` : `${product.name} 删除失败。`);
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
          planSubtitle: price.metadata?.planSubtitle ?? "",
          featuresText: price.metadata?.featuresText ?? "",
          badgeLabel: price.metadata?.badgeLabel ?? "",
          editingLabel: price.metadata?.editingLabel ?? "",
          buttonLabel: price.metadata?.buttonLabel ?? "",
          sidePanelEyebrow: price.metadata?.sidePanelEyebrow ?? "",
          sidePanelTitle: price.metadata?.sidePanelTitle ?? "",
          sidePanelBody: price.metadata?.sidePanelBody ?? "",
          sidePanelItemsText: price.metadata?.sidePanelItemsText ?? "",
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
        "planSubtitle",
        "featuresText",
        "badgeLabel",
        "editingLabel",
        "buttonLabel",
        "sidePanelEyebrow",
        "sidePanelTitle",
        "sidePanelBody",
        "sidePanelItemsText",
        "featured"
      ]
    );
    setMessage("商品、价格和套餐属性已导出为 CSV。");
  }

  function fieldLabel(label: string) {
    return <span className="mb-1 block text-[12px] font-medium text-[#667085]">{label}</span>;
  }

  const activeProduct = items.find((product) => product.id === activeProductId) ?? items[0];
  const activeDraft = activeProduct ? drafts[activeProduct.id] : undefined;

  return (
    <div className="right_box border border-[#eee] bg-white p-3">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-[16px] font-semibold text-[#333]">价格套餐维护</h2>
          <p className="mt-1 max-w-[720px] text-[12px] leading-5 text-[#667085]">{message}</p>
        </div>
        <button className="admin_btn inline-flex h-[34px] items-center gap-1.5 whitespace-nowrap px-3" onClick={exportPrices} type="button">
          <Download className="h-3.5 w-3.5" strokeWidth={1.8} />
          导出 CSV
        </button>
      </div>

      <div className="mt-4 rounded-[12px] border border-[#dbeafe] bg-[#eff6ff] p-4">
        <div className="grid gap-3 text-[12px] leading-5 text-[#35507a] md:grid-cols-3">
          <div>
            <p className="font-semibold text-[#1d4ed8]">这个模块维护什么</p>
            <p className="mt-1">前台价格卡、套餐文案、结账金额、购买后到账积分。</p>
          </div>
          <div>
            <p className="font-semibold text-[#1d4ed8]">推荐操作顺序</p>
            <p className="mt-1">先选商品，再改价格字段，保存后打开定价页核对。</p>
          </div>
          <div>
            <p className="font-semibold text-[#1d4ed8]">注意</p>
            <p className="mt-1">这里直接填写美元金额，例如 50；系统会自动按 cents 保存。</p>
          </div>
        </div>
      </div>

      <details className="mt-4 rounded-[12px] border border-dashed border-[#cbd5e1] bg-white p-4">
        <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[14px] font-semibold text-[#111827]">新增套餐商品</p>
            <p className="mt-1 text-[12px] leading-5 text-[#667085]">用于新增一个前台可售卖的订阅套餐或一次性 Credit 包，并自动创建首个价格。</p>
          </div>
          <span className="inline-flex items-center rounded-full border border-[#dbe4f0] bg-[#f8fafc] px-3 py-1.5 text-[12px] font-semibold text-[#475467]">
            <Plus className="mr-1.5 h-3.5 w-3.5" strokeWidth={1.8} />
            展开新增
          </span>
        </summary>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="block">
            {fieldLabel("商品名称")}
            <input className="inputtext w-full" onChange={(event) => updateProductDraft("name", event.target.value)} value={productDraft.name} />
          </label>
          <label className="block">
            {fieldLabel("商品类型")}
            <select className="selectmini w-full" onChange={(event) => updateProductDraft("type", event.target.value as Product["type"])} value={productDraft.type}>
              <option value="subscription">月度订阅商品</option>
              <option value="credit_pack">一次性 Credit 包</option>
            </select>
          </label>
          <label className="block">
            {fieldLabel("上架状态")}
            <select className="selectmini w-full" onChange={(event) => updateProductDraft("status", event.target.value as Product["status"])} value={productDraft.status}>
              <option value="active">上架</option>
              <option value="draft">草稿</option>
            </select>
          </label>
          <label className="block">
            {fieldLabel("首个价格标签")}
            <input className="inputtext w-full" onChange={(event) => updateProductDraftPrice("label", event.target.value)} value={productDraft.price.label} />
          </label>
          <label className="block">
            {fieldLabel("金额（美元）")}
            <input className="inputtext w-full" inputMode="decimal" onChange={(event) => updateProductDraftAmount(event.target.value)} value={majorAmountValue(productDraft.price.amountCents)} />
          </label>
          <label className="block">
            {fieldLabel("到账 Credits")}
            <input className="inputtext w-full" onChange={(event) => updateProductDraftPrice("creditsGranted", event.target.value)} value={productDraft.price.creditsGranted} />
          </label>
          <label className="block">
            {fieldLabel("套餐成片数")}
            <input className="inputtext w-full" onChange={(event) => updateProductDraftMeta("generatedPhotos", event.target.value)} value={String(productDraft.price.metadata.generatedPhotos ?? 0)} />
          </label>
          <label className="block">
            {fieldLabel("可选目的地数")}
            <input className="inputtext w-full" onChange={(event) => updateProductDraftMeta("destinationCount", event.target.value)} value={String(productDraft.price.metadata.destinationCount ?? 0)} />
          </label>
          <label className="block md:col-span-2">
            {fieldLabel("前台套餐描述")}
            <textarea className="inputtext min-h-[74px] w-full" onChange={(event) => updateProductDraftMeta("planSubtitle", event.target.value)} value={String(productDraft.price.metadata.planSubtitle ?? "")} />
          </label>
          <label className="block md:col-span-2">
            {fieldLabel("前台卖点列表（每行一条，留空则使用系统默认卖点）")}
            <textarea className="inputtext min-h-[112px] w-full" onChange={(event) => updateProductDraftMeta("featuresText", event.target.value)} value={String(productDraft.price.metadata.featuresText ?? "")} />
          </label>
        </div>
        <div className="mt-4 flex justify-end border-t border-[#eef2f6] pt-4">
          <button className="admin_btn inline-flex h-[34px] min-w-[108px] items-center justify-center gap-1.5 whitespace-nowrap px-3 disabled:cursor-not-allowed disabled:opacity-60" disabled={creatingProduct} onClick={createProduct} type="button">
            <Plus className="h-3.5 w-3.5" strokeWidth={1.8} />
            {creatingProduct ? "新增中" : "新增套餐"}
          </button>
        </div>
      </details>

      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        {items.map((product) => {
          const summary = productSummary(product);
          const selected = product.id === activeProduct?.id;
          return (
            <button
              aria-pressed={selected}
              className={`rounded-[12px] border p-4 text-left transition ${
                selected ? "border-[#2563eb] bg-[#eff6ff] shadow-[0_14px_34px_-28px_rgba(37,99,235,0.65)]" : "border-[#e4e9f0] bg-[#fafbfc] hover:border-[#bfdbfe] hover:bg-white"
              }`}
              key={product.id}
              onClick={() => setActiveProductId(product.id)}
              type="button"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-[14px] font-semibold text-[#111827]">{product.name}</p>
                  <p className="mt-1 text-[12px] text-[#667085]">{productTypeLabel(product.type)}</p>
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium ${product.status === "active" ? "bg-[#dcfce7] text-[#15803d]" : "bg-[#f1f5f9] text-[#64748b]"}`}>
                  {product.status === "active" ? "上架" : "停用"}
                </span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-[12px] text-[#667085]">
                <span>{product.prices.length} 个价格</span>
                <span className="text-right">{summary.lowest}</span>
              </div>
              <p className="mt-2 truncate text-[11px] text-[#98a2b3]">主推/默认：{summary.featuredLabel}</p>
            </button>
          );
        })}
      </div>

      {activeProduct ? (
        <div className="mt-4 rounded-[16px] border border-[#eceff3] bg-[#fafbfc] p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-[15px] font-semibold text-[#1f2937]">当前维护：{activeProduct.name}</h3>
              <p className="mt-1 text-[12px] text-[#667085]">
                {productTypeLabel(activeProduct.type)} / {activeProduct.status === "active" ? "已上架" : "未上架"} / {activeProduct.prices.length} 个价格
              </p>
            </div>
            <div className="whitespace-nowrap rounded-full border border-[#dbe4f0] bg-white px-3 py-1 text-[11px] font-medium text-[#4b5563]">
              只展开当前商品，减少误改
            </div>
          </div>

          <div className="mt-4 grid gap-3">
              {activeProduct.prices.map((price) => (
                <div className="rounded-[14px] border border-[#e4e9f0] bg-white p-4 shadow-[0_10px_24px_-26px_rgba(15,23,42,0.3)]" key={price.id}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-semibold text-[#111827]">{price.label}</p>
                      <p className="mt-1 truncate text-[12px] text-[#98a2b3]">
                        {formatAmount(price.amountCents, price.currency)} / {intervalLabel(price.interval)} / 到账 {price.creditsGranted} Credits
                      </p>
                    </div>
                    {price.metadata?.featured ? (
                      <span className="whitespace-nowrap rounded-full border border-[#f4d7a2] bg-[#fff6e7] px-2.5 py-1 text-[11px] font-semibold text-[#c47a15]">
                        主推套餐
                      </span>
                    ) : null}
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <label className="block">
                      {fieldLabel("价格标签")}
                      <input className="inputtext w-full" onChange={(event) => updatePrice(activeProduct.id, price.id, "label", event.target.value)} value={price.label} />
                    </label>
                    <label className="block">
                      {fieldLabel("周期")}
                      <select className="selectmini w-full" onChange={(event) => updatePrice(activeProduct.id, price.id, "interval", event.target.value)} value={price.interval}>
                        <option value="month">月度订阅</option>
                        <option value="one_time">一次性购买</option>
                      </select>
                    </label>
                    <label className="block">
                      {fieldLabel("金额（美元）")}
                      <input className="inputtext w-full" inputMode="decimal" onChange={(event) => updatePriceAmount(activeProduct.id, price.id, event.target.value)} value={majorAmountValue(price.amountCents)} />
                    </label>
                    <label className="block">
                      {fieldLabel("到账 Credits")}
                      <input className="inputtext w-full" onChange={(event) => updatePrice(activeProduct.id, price.id, "creditsGranted", event.target.value)} value={price.creditsGranted} />
                    </label>
                    <label className="block">
                      {fieldLabel("套餐成片数")}
                      <input className="inputtext w-full" onChange={(event) => updatePriceMeta(activeProduct.id, price.id, "generatedPhotos", event.target.value)} value={String(price.metadata?.generatedPhotos ?? 0)} />
                    </label>
                    <label className="block">
                      {fieldLabel("可选目的地数")}
                      <input className="inputtext w-full" onChange={(event) => updatePriceMeta(activeProduct.id, price.id, "destinationCount", event.target.value)} value={String(price.metadata?.destinationCount ?? 0)} />
                    </label>
                    <label className="block">
                      {fieldLabel("承诺交付天数")}
                      <input className="inputtext w-full" onChange={(event) => updatePriceMeta(activeProduct.id, price.id, "deliveryDays", event.target.value)} value={String(price.metadata?.deliveryDays ?? 0)} />
                    </label>
                    <label className="block">
                      {fieldLabel("修改/重修规则")}
                      <input className="inputtext w-full" onChange={(event) => updatePriceMeta(activeProduct.id, price.id, "revisions", event.target.value)} value={String(price.metadata?.revisions ?? "")} />
                    </label>
                    <label className="block">
                      {fieldLabel("角标文案")}
                      <input className="inputtext w-full" placeholder="例如 Most Popular" onChange={(event) => updatePriceMeta(activeProduct.id, price.id, "badgeLabel", event.target.value)} value={String(price.metadata?.badgeLabel ?? "")} />
                    </label>
                    <label className="block">
                      {fieldLabel("按钮文案")}
                      <input className="inputtext w-full" placeholder="例如 Select plan" onChange={(event) => updatePriceMeta(activeProduct.id, price.id, "buttonLabel", event.target.value)} value={String(price.metadata?.buttonLabel ?? "")} />
                    </label>
                    <label className="block">
                      {fieldLabel("编辑权益文案")}
                      <input className="inputtext w-full" placeholder="例如 Basic editing" onChange={(event) => updatePriceMeta(activeProduct.id, price.id, "editingLabel", event.target.value)} value={String(price.metadata?.editingLabel ?? "")} />
                    </label>
                    <label className="block md:col-span-2">
                      {fieldLabel("前台套餐描述")}
                      <textarea className="inputtext min-h-[74px] w-full" placeholder="显示在套餐标题下方的描述。" onChange={(event) => updatePriceMeta(activeProduct.id, price.id, "planSubtitle", event.target.value)} value={String(price.metadata?.planSubtitle ?? "")} />
                    </label>
                    <label className="block md:col-span-2">
                      {fieldLabel("前台卖点列表（每行一条，留空则使用系统默认卖点）")}
                      <textarea className="inputtext min-h-[120px] w-full" placeholder={"200 credits included\n15 AI-generated photos\nHigh-resolution images"} onChange={(event) => updatePriceMeta(activeProduct.id, price.id, "featuresText", event.target.value)} value={String(price.metadata?.featuresText ?? "")} />
                    </label>
                    <div className="md:col-span-2 rounded-[12px] border border-[#e8eef7] bg-[#fbfdff] p-3">
                      <p className="text-[12px] font-semibold text-[#344054]">右侧说明区文案（可选，通常填在主推套餐价格里）</p>
                      <div className="mt-3 grid gap-3 md:grid-cols-2">
                        <label className="block">
                          {fieldLabel("说明区小标题")}
                          <input className="inputtext w-full" placeholder="Why people subscribe" onChange={(event) => updatePriceMeta(activeProduct.id, price.id, "sidePanelEyebrow", event.target.value)} value={String(price.metadata?.sidePanelEyebrow ?? "")} />
                        </label>
                        <label className="block">
                          {fieldLabel("说明区标题")}
                          <input className="inputtext w-full" placeholder="Credits stay predictable..." onChange={(event) => updatePriceMeta(activeProduct.id, price.id, "sidePanelTitle", event.target.value)} value={String(price.metadata?.sidePanelTitle ?? "")} />
                        </label>
                        <label className="block md:col-span-2">
                          {fieldLabel("说明区正文")}
                          <textarea className="inputtext min-h-[74px] w-full" onChange={(event) => updatePriceMeta(activeProduct.id, price.id, "sidePanelBody", event.target.value)} value={String(price.metadata?.sidePanelBody ?? "")} />
                        </label>
                        <label className="block md:col-span-2">
                          {fieldLabel("说明区条目（每行：标题 | 描述）")}
                          <textarea className="inputtext min-h-[96px] w-full" placeholder={"Starter | Best for one focused headshot.\nPopular | Balanced for comparing package looks."} onChange={(event) => updatePriceMeta(activeProduct.id, price.id, "sidePanelItemsText", event.target.value)} value={String(price.metadata?.sidePanelItemsText ?? "")} />
                        </label>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-4 border-t border-[#eef2f6] pt-4">
                    <label className="inline-flex items-center gap-2 whitespace-nowrap text-[12px] font-medium text-[#4b5563]">
                      <input
                        checked={Boolean(price.metadata?.featured)}
                        onChange={(event) => updatePriceMeta(activeProduct.id, price.id, "featured", event.target.checked)}
                        type="checkbox"
                      />
                      设为主推套餐
                    </label>
                    <div className="flex shrink-0 items-center gap-2">
                      <button className="input_btn inline-flex h-[34px] min-w-[76px] items-center justify-center gap-1.5 whitespace-nowrap px-3" onClick={() => save(activeProduct, price.id)} type="button">
                        <Save className="h-3.5 w-3.5" strokeWidth={1.8} />
                        保存
                      </button>
                      <button className="admin_del inline-flex h-[34px] min-w-[76px] items-center justify-center gap-1.5 whitespace-nowrap px-3" onClick={() => deletePrice(activeProduct, price.id)} type="button">
                        <Trash2 className="h-3.5 w-3.5" strokeWidth={1.8} />
                        删除
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              <details className="rounded-[14px] border border-dashed border-[#d8dee8] bg-white/80 p-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
                  <div>
                    <p className="text-[13px] font-semibold text-[#111827]">新增价格</p>
                    <p className="mt-1 text-[12px] leading-5 text-[#98a2b3]">默认收起，只有需要新增价格时再展开。</p>
                  </div>
                  <span className="whitespace-nowrap rounded-full border border-[#dbe4f0] bg-[#f8fafc] px-2.5 py-1 text-[11px] font-semibold text-[#64748b]">
                    展开填写
                  </span>
                </summary>

                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <label className="block">
                    {fieldLabel("价格标签")}
                    <input className="inputtext w-full" onChange={(event) => updateDraft(activeProduct.id, "label", event.target.value)} value={activeDraft?.label ?? ""} />
                  </label>
                  <label className="block">
                    {fieldLabel("周期")}
                    <select className="selectmini w-full" onChange={(event) => updateDraft(activeProduct.id, "interval", event.target.value)} value={activeDraft?.interval ?? "month"}>
                      <option value="month">月度订阅</option>
                      <option value="one_time">一次性购买</option>
                    </select>
                  </label>
                  <label className="block">
                    {fieldLabel("金额（美元）")}
                    <input className="inputtext w-full" inputMode="decimal" onChange={(event) => updateDraftAmount(activeProduct.id, event.target.value)} value={majorAmountValue(activeDraft?.amountCents ?? 0)} />
                  </label>
                  <label className="block">
                    {fieldLabel("到账 Credits")}
                    <input className="inputtext w-full" onChange={(event) => updateDraft(activeProduct.id, "creditsGranted", event.target.value)} value={activeDraft?.creditsGranted ?? 0} />
                  </label>
                  <label className="block">
                    {fieldLabel("套餐成片数")}
                    <input className="inputtext w-full" onChange={(event) => updateDraftMeta(activeProduct.id, "generatedPhotos", event.target.value)} value={String(activeDraft?.metadata.generatedPhotos ?? 0)} />
                  </label>
                  <label className="block">
                    {fieldLabel("可选目的地数")}
                    <input className="inputtext w-full" onChange={(event) => updateDraftMeta(activeProduct.id, "destinationCount", event.target.value)} value={String(activeDraft?.metadata.destinationCount ?? 0)} />
                  </label>
                  <label className="block">
                    {fieldLabel("承诺交付天数")}
                    <input className="inputtext w-full" onChange={(event) => updateDraftMeta(activeProduct.id, "deliveryDays", event.target.value)} value={String(activeDraft?.metadata.deliveryDays ?? 0)} />
                  </label>
                  <label className="block">
                    {fieldLabel("修改/重修规则")}
                    <input className="inputtext w-full" onChange={(event) => updateDraftMeta(activeProduct.id, "revisions", event.target.value)} value={String(activeDraft?.metadata.revisions ?? "")} />
                  </label>
                  <label className="block">
                    {fieldLabel("角标文案")}
                    <input className="inputtext w-full" onChange={(event) => updateDraftMeta(activeProduct.id, "badgeLabel", event.target.value)} value={String(activeDraft?.metadata.badgeLabel ?? "")} />
                  </label>
                  <label className="block">
                    {fieldLabel("按钮文案")}
                    <input className="inputtext w-full" onChange={(event) => updateDraftMeta(activeProduct.id, "buttonLabel", event.target.value)} value={String(activeDraft?.metadata.buttonLabel ?? "")} />
                  </label>
                  <label className="block">
                    {fieldLabel("编辑权益文案")}
                    <input className="inputtext w-full" onChange={(event) => updateDraftMeta(activeProduct.id, "editingLabel", event.target.value)} value={String(activeDraft?.metadata.editingLabel ?? "")} />
                  </label>
                  <label className="block md:col-span-2">
                    {fieldLabel("前台套餐描述")}
                    <textarea className="inputtext min-h-[74px] w-full" onChange={(event) => updateDraftMeta(activeProduct.id, "planSubtitle", event.target.value)} value={String(activeDraft?.metadata.planSubtitle ?? "")} />
                  </label>
                  <label className="block md:col-span-2">
                    {fieldLabel("前台卖点列表（每行一条）")}
                    <textarea className="inputtext min-h-[112px] w-full" onChange={(event) => updateDraftMeta(activeProduct.id, "featuresText", event.target.value)} value={String(activeDraft?.metadata.featuresText ?? "")} />
                  </label>
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#eef2f6] pt-4">
                  <label className="inline-flex items-center gap-2 whitespace-nowrap text-[12px] font-medium text-[#4b5563]">
                    <input
                      checked={Boolean(activeDraft?.metadata.featured)}
                      onChange={(event) => updateDraftMeta(activeProduct.id, "featured", event.target.checked)}
                      type="checkbox"
                    />
                    设为主推套餐
                  </label>
                  <button className="admin_btn inline-flex h-[34px] min-w-[76px] items-center justify-center gap-1.5 whitespace-nowrap px-3" onClick={() => createPrice(activeProduct)} type="button">
                    <Plus className="h-3.5 w-3.5" strokeWidth={1.8} />
                    新增
                  </button>
                </div>
              </details>
          </div>
        </div>
      ) : null}
    </div>
  );
}
