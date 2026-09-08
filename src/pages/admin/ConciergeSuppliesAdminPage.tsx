import { useEffect, useMemo, useState, type ReactNode } from "react";
import AdminMenu from "./AdminMenu";
import AdminPageHeader from "./AdminPageHeader";
import { apiFetch } from "@/lib/queryClient";
import type {
  LocalizedText,
  ShoppingCategory,
  ShoppingCategoryChoice,
  ShoppingPriority,
  ShoppingRecommendationResponse,
} from "../../../shared/shopping";

type LocalizedList = Record<"en" | "es", string[]>;

type AdminShoppingProduct = {
  id?: string;
  product_id: string;
  category: ShoppingCategory;
  name: LocalizedText;
  price_label: LocalizedText;
  description: LocalizedText;
  benefits: LocalizedList;
  tags: string[];
  suitability: LocalizedList;
  cautions: LocalizedList;
  accessibility_notes: LocalizedList;
  availability_label: LocalizedText;
  price_tier: "low" | "medium" | "high";
  is_enabled: boolean;
  priority: number;
  admin_notes?: string | null;
  updated_at?: string;
};

type AdminShoppingPackage = {
  id?: string;
  package_id: string;
  label: LocalizedText;
  description: LocalizedText;
  need_text: LocalizedText;
  category: ShoppingCategoryChoice;
  priorities: ShoppingPriority[];
  constraints: LocalizedList;
  cta_label: LocalizedText;
  service_request: boolean;
  is_enabled: boolean;
  priority: number;
  product_ids: string[];
  admin_notes?: string | null;
  updated_at?: string;
};

type CatalogQueueFilter = "all" | "live" | "hidden" | "spanish_gaps" | "package_gaps" | "service_requests";

const CATEGORY_OPTIONS: ShoppingCategory[] = ["groceries", "pharmacy_basics", "household", "mobility_aids"];
const PACKAGE_CATEGORY_OPTIONS: ShoppingCategoryChoice[] = ["safe_home", ...CATEGORY_OPTIONS];
const PRIORITY_OPTIONS: ShoppingPriority[] = ["budget", "simplicity", "accessibility", "diet", "delivery", "safety"];
const PRICE_TIERS: AdminShoppingProduct["price_tier"][] = ["low", "medium", "high"];
const CATALOG_QUEUE_FILTERS: Array<{ id: CatalogQueueFilter; label: string; description: string }> = [
  { id: "all", label: "All catalog", description: "Products and packages" },
  { id: "live", label: "Live catalog", description: "Enabled entries" },
  { id: "hidden", label: "Hidden", description: "Disabled entries" },
  { id: "spanish_gaps", label: "Spanish gaps", description: "Missing ES copy" },
  { id: "package_gaps", label: "Package gaps", description: "No products linked" },
  { id: "service_requests", label: "Service requests", description: "Concierge handoff" },
];

const emptyText: LocalizedText = { en: "", es: "" };
const emptyList: LocalizedList = { en: [], es: [] };

const emptyProduct: AdminShoppingProduct = {
  product_id: "",
  category: "household",
  name: emptyText,
  price_label: { en: "Check price", es: "Revisar precio" },
  description: emptyText,
  benefits: emptyList,
  tags: [],
  suitability: emptyList,
  cautions: emptyList,
  accessibility_notes: emptyList,
  availability_label: { en: "Check availability", es: "Revisar disponibilidad" },
  price_tier: "medium",
  is_enabled: true,
  priority: 50,
  admin_notes: "",
};

const emptyPackage: AdminShoppingPackage = {
  package_id: "",
  label: emptyText,
  description: emptyText,
  need_text: emptyText,
  category: "safe_home",
  priorities: ["safety", "accessibility"],
  constraints: emptyList,
  cta_label: { en: "Compare choices", es: "Comparar opciones" },
  service_request: false,
  is_enabled: true,
  priority: 50,
  product_ids: [],
  admin_notes: "",
};

function cloneProduct(product: AdminShoppingProduct): AdminShoppingProduct {
  return JSON.parse(JSON.stringify(product)) as AdminShoppingProduct;
}

function clonePackage(item: AdminShoppingPackage): AdminShoppingPackage {
  return JSON.parse(JSON.stringify(item)) as AdminShoppingPackage;
}

function listToText(values?: string[]) {
  return (values ?? []).join(", ");
}

function textToList(value: string) {
  return value
    .split(/[,\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function Field({ label, optional, children }: { label: string; optional?: boolean; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 flex justify-between text-sm font-bold text-[#4d4351]">
        <span>{label}</span>
        {optional && <span className="font-normal text-purple-700">Optional</span>}
      </span>
      {children}
    </label>
  );
}

function TextInput({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder?: string }) {
  return (
    <input
      className="w-full rounded-2xl border border-[#eadfd5] px-4 py-3 text-sm font-semibold text-[#2f2135]"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
    />
  );
}

function TextArea({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder?: string }) {
  return (
    <textarea
      className="min-h-20 w-full rounded-2xl border border-[#eadfd5] px-4 py-3 text-sm font-semibold leading-relaxed text-[#2f2135]"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
    />
  );
}

function productPayload(product: AdminShoppingProduct) {
  const { id: _id, updated_at: _updatedAt, product_id: _productId, ...payload } = product;
  return payload;
}

function packagePayload(item: AdminShoppingPackage) {
  const { id: _id, updated_at: _updatedAt, package_id: _packageId, ...payload } = item;
  return payload;
}

function missingProductSpanish(product: AdminShoppingProduct) {
  return !product.name.es.trim() || !product.description.es.trim() || !product.price_label.es.trim();
}

function missingPackageSpanish(item: AdminShoppingPackage) {
  return !item.label.es.trim() || !item.description.es.trim() || !item.need_text.es.trim() || !item.cta_label.es.trim();
}

function packageHasLinkGap(item: AdminShoppingPackage) {
  return item.is_enabled && !item.service_request && item.product_ids.length === 0;
}

function matchesProductQueue(product: AdminShoppingProduct, filter: CatalogQueueFilter) {
  if (filter === "all") return true;
  if (filter === "live") return product.is_enabled;
  if (filter === "hidden") return !product.is_enabled;
  if (filter === "spanish_gaps") return missingProductSpanish(product);
  return false;
}

function matchesPackageQueue(item: AdminShoppingPackage, filter: CatalogQueueFilter) {
  if (filter === "all") return true;
  if (filter === "live") return item.is_enabled;
  if (filter === "hidden") return !item.is_enabled;
  if (filter === "spanish_gaps") return missingPackageSpanish(item);
  if (filter === "package_gaps") return packageHasLinkGap(item);
  return item.service_request;
}

export default function ConciergeSuppliesAdminPage() {
  const [products, setProducts] = useState<AdminShoppingProduct[]>([]);
  const [packages, setPackages] = useState<AdminShoppingPackage[]>([]);
  const [productDraft, setProductDraft] = useState<AdminShoppingProduct>(cloneProduct(emptyProduct));
  const [packageDraft, setPackageDraft] = useState<AdminShoppingPackage>(clonePackage(emptyPackage));
  const [catalogQueueFilter, setCatalogQueueFilter] = useState<CatalogQueueFilter>("all");
  const [previewNeed, setPreviewNeed] = useState("Hydration support after a health recommendation");
  const [previewPackageId, setPreviewPackageId] = useState("hydration_support");
  const [previewResult, setPreviewResult] = useState<ShoppingRecommendationResponse | null>(null);
  const [message, setMessage] = useState("");

  const productIds = useMemo(() => products.map((product) => product.product_id).sort(), [products]);

  async function api(path: string, options: RequestInit = {}) {
    const res = await apiFetch(`/api/admin/concierge/shopping${path}`, options);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "Admin request failed");
    return data;
  }

  async function refresh() {
    setMessage("");
    const [productData, packageData] = await Promise.all([
      api("/products"),
      api("/packages"),
    ]);
    setProducts(productData.products ?? []);
    setPackages(packageData.packages ?? []);
  }

  useEffect(() => {
    refresh().catch((err) => setMessage(err.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const visibleProducts = useMemo(
    () => products.filter((product) => matchesProductQueue(product, catalogQueueFilter)),
    [catalogQueueFilter, products],
  );
  const visiblePackages = useMemo(
    () => packages.filter((item) => matchesPackageQueue(item, catalogQueueFilter)),
    [catalogQueueFilter, packages],
  );
  const catalogQueueCounts = useMemo<Record<CatalogQueueFilter, number>>(() => ({
    all: products.length + packages.length,
    live: products.filter((product) => matchesProductQueue(product, "live")).length + packages.filter((item) => matchesPackageQueue(item, "live")).length,
    hidden: products.filter((product) => matchesProductQueue(product, "hidden")).length + packages.filter((item) => matchesPackageQueue(item, "hidden")).length,
    spanish_gaps: products.filter((product) => matchesProductQueue(product, "spanish_gaps")).length + packages.filter((item) => matchesPackageQueue(item, "spanish_gaps")).length,
    package_gaps: packages.filter((item) => matchesPackageQueue(item, "package_gaps")).length,
    service_requests: packages.filter((item) => matchesPackageQueue(item, "service_requests")).length,
  }), [packages, products]);

  function updateProduct(productId: string, patch: Partial<AdminShoppingProduct>) {
    setProducts((current) => current.map((product) => product.product_id === productId ? { ...product, ...patch } : product));
  }

  function updateProductText(productId: string, field: "name" | "price_label" | "description" | "availability_label", locale: "en" | "es", value: string) {
    setProducts((current) => current.map((product) => product.product_id === productId
      ? { ...product, [field]: { ...product[field], [locale]: value } }
      : product));
  }

  function updateProductList(productId: string, field: "benefits" | "suitability" | "cautions" | "accessibility_notes", locale: "en" | "es", value: string) {
    setProducts((current) => current.map((product) => product.product_id === productId
      ? { ...product, [field]: { ...product[field], [locale]: textToList(value) } }
      : product));
  }

  function updatePackage(packageId: string, patch: Partial<AdminShoppingPackage>) {
    setPackages((current) => current.map((item) => item.package_id === packageId ? { ...item, ...patch } : item));
  }

  function updatePackageText(packageId: string, field: "label" | "description" | "need_text" | "cta_label", locale: "en" | "es", value: string) {
    setPackages((current) => current.map((item) => item.package_id === packageId
      ? { ...item, [field]: { ...item[field], [locale]: value } }
      : item));
  }

  function updatePackageList(packageId: string, locale: "en" | "es", value: string) {
    setPackages((current) => current.map((item) => item.package_id === packageId
      ? { ...item, constraints: { ...item.constraints, [locale]: textToList(value) } }
      : item));
  }

  async function addProduct() {
    const body = { ...productDraft, product_id: productDraft.product_id.trim() };
    await api("/products", { method: "POST", body: JSON.stringify(body) });
    setMessage(`${body.product_id} added.`);
    setProductDraft(cloneProduct(emptyProduct));
    await refresh();
  }

  async function saveProduct(product: AdminShoppingProduct) {
    await api(`/products/${product.product_id}`, {
      method: "PATCH",
      body: JSON.stringify(productPayload(product)),
    });
    setMessage(`${product.product_id} saved.`);
    await refresh();
  }

  async function addPackage() {
    const body = { ...packageDraft, package_id: packageDraft.package_id.trim() };
    await api("/packages", { method: "POST", body: JSON.stringify(body) });
    setMessage(`${body.package_id} added.`);
    setPackageDraft(clonePackage(emptyPackage));
    await refresh();
  }

  async function savePackage(item: AdminShoppingPackage) {
    await api(`/packages/${item.package_id}`, {
      method: "PATCH",
      body: JSON.stringify(packagePayload(item)),
    });
    setMessage(`${item.package_id} saved.`);
    await refresh();
  }

  async function runPreview() {
    const data = await api("/preview", {
      method: "POST",
      body: JSON.stringify({
        needText: previewNeed,
        category: packages.find((item) => item.package_id === previewPackageId)?.category ?? "safe_home",
        priorities: packages.find((item) => item.package_id === previewPackageId)?.priorities ?? ["safety"],
        packageId: previewPackageId,
        locale: "en",
      }),
    });
    setPreviewResult(data);
    setMessage("Preview updated.");
  }

  return (
    <main className="min-h-screen bg-[#f7f2eb] px-6 py-8 text-[#2f2135]">
      <section className="mx-auto max-w-7xl">
        <AdminPageHeader
          title="Supply packages"
          subtitle="Curate the approved VYVA supply catalog and support packages used by Concierge Shopping. This never starts checkout or payment."
        >
          <button className="rounded-2xl bg-purple-700 px-5 py-3 font-bold text-white" onClick={() => refresh().catch((err) => setMessage(err.message))}>Refresh</button>
          {message && <span className="rounded-2xl bg-purple-50 px-4 py-3 text-purple-800">{message}</span>}
        </AdminPageHeader>

        <AdminMenu />

        <section className="mt-5 rounded-[2rem] border border-[#eadfd5] bg-white p-5 shadow-sm" data-testid="admin-shopping-catalog-queue">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="font-serif text-3xl">Catalog health</h2>
              <p className="mt-2 text-sm font-semibold text-[#7d6b65]">
                Showing {visibleProducts.length} of {products.length} products and {visiblePackages.length} of {packages.length} packages.
              </p>
            </div>
            {catalogQueueFilter !== "all" && (
              <button
                type="button"
                className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-purple-200 bg-purple-50 px-4 text-sm font-black text-purple-800"
                onClick={() => setCatalogQueueFilter("all")}
                data-testid="admin-shopping-clear-catalog-queue"
              >
                Show all
              </button>
            )}
          </div>
          <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-6">
            {CATALOG_QUEUE_FILTERS.map((queue) => {
              const active = catalogQueueFilter === queue.id;
              return (
                <button
                  key={queue.id}
                  type="button"
                  onClick={() => setCatalogQueueFilter(queue.id)}
                  className={`min-h-[92px] rounded-2xl border px-4 py-3 text-left transition ${
                    active
                      ? "border-purple-600 bg-purple-700 text-white shadow-sm"
                      : "border-[#eadfd5] bg-[#fffaf4] text-[#2f2135] hover:border-purple-200"
                  }`}
                  data-testid={`admin-shopping-queue-${queue.id}`}
                >
                  <span className="flex items-center justify-between gap-3">
                    <span className="text-sm font-black">{queue.label}</span>
                    <span className="text-2xl font-black leading-none">{catalogQueueCounts[queue.id]}</span>
                  </span>
                  <span className="sr-only">{queue.description}</span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="mt-5 rounded-[2rem] border border-[#eadfd5] bg-white p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-serif text-3xl">Preview senior view</h2>
              <p className="mt-2 max-w-3xl text-sm text-[#7d6b65]">
                Test saved, enabled products and packages before showing them in Concierge Shopping.
              </p>
            </div>
            <span className="rounded-full bg-emerald-50 px-4 py-2 text-sm font-bold text-emerald-700">No checkout</span>
          </div>
          <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_18rem_10rem]">
            <Field label="Need">
              <TextInput value={previewNeed} onChange={setPreviewNeed} />
            </Field>
            <Field label="Package">
              <select className="w-full rounded-2xl border border-[#eadfd5] px-4 py-3 text-sm font-bold" value={previewPackageId} onChange={(event) => setPreviewPackageId(event.target.value)}>
                {packages.map((item) => <option key={item.package_id} value={item.package_id}>{item.label.en || item.package_id}</option>)}
              </select>
            </Field>
            <button className="self-end rounded-2xl bg-purple-700 px-5 py-3 font-bold text-white" onClick={() => runPreview().catch((err) => setMessage(err.message))}>
              Preview
            </button>
          </div>
          {previewResult && (
            <div className="mt-4 grid gap-2 rounded-3xl bg-[#f7f2eb] p-4" data-testid="admin-shopping-preview-results">
              <p className="font-bold text-[#4d4351]">{previewResult.querySummary}</p>
              {previewResult.recommendations.map((item) => (
                <div key={item.product.id} className="rounded-2xl bg-white p-3">
                  <p className="font-black">{item.rankLabel}: {item.product.name}</p>
                  <p className="mt-1 text-sm text-[#7d6b65]">{item.reasons[0] ?? item.product.description}</p>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="mt-5 rounded-[2rem] border border-[#eadfd5] bg-white p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-serif text-3xl">Add supply item</h2>
              <p className="mt-2 text-sm text-[#7d6b65]">Create approved items first, then assign them to packages below.</p>
            </div>
            <span className="rounded-full bg-purple-50 px-4 py-2 text-sm font-bold text-purple-700">{products.length} items</span>
          </div>
          <div className="mt-4 grid gap-3 lg:grid-cols-4">
            <Field label="Product ID">
              <TextInput value={productDraft.product_id} onChange={(value) => setProductDraft((prev) => ({ ...prev, product_id: value }))} placeholder="hydration-bottle" />
            </Field>
            <Field label="Name EN">
              <TextInput value={productDraft.name.en} onChange={(value) => setProductDraft((prev) => ({ ...prev, name: { ...prev.name, en: value } }))} />
            </Field>
            <Field label="Category">
              <select className="w-full rounded-2xl border border-[#eadfd5] px-4 py-3 text-sm font-bold" value={productDraft.category} onChange={(event) => setProductDraft((prev) => ({ ...prev, category: event.target.value as ShoppingCategory }))}>
                {CATEGORY_OPTIONS.map((category) => <option key={category} value={category}>{category}</option>)}
              </select>
            </Field>
            <button className="self-end rounded-2xl bg-purple-700 px-5 py-3 font-bold text-white" onClick={() => addProduct().catch((err) => setMessage(err.message))}>
              Add item
            </button>
          </div>
        </section>

        <section className="mt-5 grid gap-4 xl:grid-cols-2" data-testid="admin-shopping-products">
          {visibleProducts.length === 0 ? (
            <div className="rounded-[2rem] border border-[#eadfd5] bg-white p-8 text-center text-sm font-bold text-[#7d6b65] xl:col-span-2">
              No supply items match this catalog queue.
            </div>
          ) : visibleProducts.map((product) => (
            <article key={product.product_id} className="rounded-[2rem] border border-[#eadfd5] bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xl font-black">{product.product_id}</p>
                  <p className="text-sm text-[#7d6b65]">{product.category} - {product.price_tier}</p>
                </div>
                <label className="flex items-center gap-2 rounded-full bg-purple-50 px-4 py-2 font-bold text-purple-700">
                  <input type="checkbox" checked={product.is_enabled} onChange={(event) => updateProduct(product.product_id, { is_enabled: event.target.checked })} />
                  Enabled
                </label>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <Field label="Category">
                  <select className="w-full rounded-2xl border border-[#eadfd5] px-4 py-3 text-sm font-bold" value={product.category} onChange={(event) => updateProduct(product.product_id, { category: event.target.value as ShoppingCategory })}>
                    {CATEGORY_OPTIONS.map((category) => <option key={category} value={category}>{category}</option>)}
                  </select>
                </Field>
                <Field label="Price tier">
                  <select className="w-full rounded-2xl border border-[#eadfd5] px-4 py-3 text-sm font-bold" value={product.price_tier} onChange={(event) => updateProduct(product.product_id, { price_tier: event.target.value as AdminShoppingProduct["price_tier"] })}>
                    {PRICE_TIERS.map((tier) => <option key={tier} value={tier}>{tier}</option>)}
                  </select>
                </Field>
                <Field label="Priority">
                  <input className="w-full rounded-2xl border border-[#eadfd5] px-4 py-3 text-sm font-bold" type="number" value={product.priority} onChange={(event) => updateProduct(product.product_id, { priority: Number(event.target.value) })} />
                </Field>
              </div>

              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <Field label="Name EN"><TextInput value={product.name.en} onChange={(value) => updateProductText(product.product_id, "name", "en", value)} /></Field>
                <Field label="Name ES"><TextInput value={product.name.es} onChange={(value) => updateProductText(product.product_id, "name", "es", value)} /></Field>
                <Field label="Description EN"><TextArea value={product.description.en} onChange={(value) => updateProductText(product.product_id, "description", "en", value)} /></Field>
                <Field label="Description ES"><TextArea value={product.description.es} onChange={(value) => updateProductText(product.product_id, "description", "es", value)} /></Field>
                <Field label="Price label EN"><TextInput value={product.price_label.en} onChange={(value) => updateProductText(product.product_id, "price_label", "en", value)} /></Field>
                <Field label="Price label ES"><TextInput value={product.price_label.es} onChange={(value) => updateProductText(product.product_id, "price_label", "es", value)} /></Field>
                <Field label="Availability EN"><TextInput value={product.availability_label.en} onChange={(value) => updateProductText(product.product_id, "availability_label", "en", value)} /></Field>
                <Field label="Availability ES"><TextInput value={product.availability_label.es} onChange={(value) => updateProductText(product.product_id, "availability_label", "es", value)} /></Field>
              </div>

              <div className="mt-3 grid gap-3">
                <Field label="Tags"><TextArea value={listToText(product.tags)} onChange={(value) => updateProduct(product.product_id, { tags: textToList(value) })} /></Field>
                <Field label="Benefits EN"><TextArea value={listToText(product.benefits.en)} onChange={(value) => updateProductList(product.product_id, "benefits", "en", value)} /></Field>
                <Field label="Benefits ES"><TextArea value={listToText(product.benefits.es)} onChange={(value) => updateProductList(product.product_id, "benefits", "es", value)} /></Field>
                <Field label="Cautions EN"><TextArea value={listToText(product.cautions.en)} onChange={(value) => updateProductList(product.product_id, "cautions", "en", value)} /></Field>
                <Field label="Cautions ES"><TextArea value={listToText(product.cautions.es)} onChange={(value) => updateProductList(product.product_id, "cautions", "es", value)} /></Field>
                <Field label="Check before buying EN"><TextArea value={listToText(product.accessibility_notes.en)} onChange={(value) => updateProductList(product.product_id, "accessibility_notes", "en", value)} /></Field>
                <Field label="Check before buying ES"><TextArea value={listToText(product.accessibility_notes.es)} onChange={(value) => updateProductList(product.product_id, "accessibility_notes", "es", value)} /></Field>
                <Field label="Admin notes" optional><TextArea value={product.admin_notes ?? ""} onChange={(value) => updateProduct(product.product_id, { admin_notes: value })} /></Field>
              </div>

              <button className="mt-4 rounded-2xl bg-purple-700 px-5 py-3 font-bold text-white" onClick={() => saveProduct(product).catch((err) => setMessage(err.message))}>
                Save item
              </button>
            </article>
          ))}
        </section>

        <section className="mt-5 rounded-[2rem] border border-[#eadfd5] bg-white p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-serif text-3xl">Add package</h2>
              <p className="mt-2 text-sm text-[#7d6b65]">Packages group approved items or prepare a Concierge service request.</p>
            </div>
            <span className="rounded-full bg-purple-50 px-4 py-2 text-sm font-bold text-purple-700">{packages.length} packages</span>
          </div>
          <div className="mt-4 grid gap-3 lg:grid-cols-4">
            <Field label="Package ID">
              <TextInput value={packageDraft.package_id} onChange={(value) => setPackageDraft((prev) => ({ ...prev, package_id: value }))} placeholder="hydration_support" />
            </Field>
            <Field label="Label EN">
              <TextInput value={packageDraft.label.en} onChange={(value) => setPackageDraft((prev) => ({ ...prev, label: { ...prev.label, en: value } }))} />
            </Field>
            <Field label="Category">
              <select className="w-full rounded-2xl border border-[#eadfd5] px-4 py-3 text-sm font-bold" value={packageDraft.category} onChange={(event) => setPackageDraft((prev) => ({ ...prev, category: event.target.value as ShoppingCategoryChoice }))}>
                {PACKAGE_CATEGORY_OPTIONS.map((category) => <option key={category} value={category}>{category}</option>)}
              </select>
            </Field>
            <button className="self-end rounded-2xl bg-purple-700 px-5 py-3 font-bold text-white" onClick={() => addPackage().catch((err) => setMessage(err.message))}>
              Add package
            </button>
          </div>
        </section>

        <section className="mt-5 grid gap-4 xl:grid-cols-2" data-testid="admin-shopping-packages">
          {visiblePackages.length === 0 ? (
            <div className="rounded-[2rem] border border-[#eadfd5] bg-white p-8 text-center text-sm font-bold text-[#7d6b65] xl:col-span-2">
              No packages match this catalog queue.
            </div>
          ) : visiblePackages.map((item) => (
            <article key={item.package_id} className="rounded-[2rem] border border-[#eadfd5] bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xl font-black">{item.package_id}</p>
                  <p className="text-sm text-[#7d6b65]">{item.category} - {item.product_ids.length} linked items</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <label className="flex items-center gap-2 rounded-full bg-purple-50 px-4 py-2 font-bold text-purple-700">
                    <input type="checkbox" checked={item.service_request} onChange={(event) => updatePackage(item.package_id, { service_request: event.target.checked })} />
                    Service request
                  </label>
                  <label className="flex items-center gap-2 rounded-full bg-purple-50 px-4 py-2 font-bold text-purple-700">
                    <input type="checkbox" checked={item.is_enabled} onChange={(event) => updatePackage(item.package_id, { is_enabled: event.target.checked })} />
                    Enabled
                  </label>
                </div>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <Field label="Category">
                  <select className="w-full rounded-2xl border border-[#eadfd5] px-4 py-3 text-sm font-bold" value={item.category} onChange={(event) => updatePackage(item.package_id, { category: event.target.value as ShoppingCategoryChoice })}>
                    {PACKAGE_CATEGORY_OPTIONS.map((category) => <option key={category} value={category}>{category}</option>)}
                  </select>
                </Field>
                <Field label="Priority">
                  <input className="w-full rounded-2xl border border-[#eadfd5] px-4 py-3 text-sm font-bold" type="number" value={item.priority} onChange={(event) => updatePackage(item.package_id, { priority: Number(event.target.value) })} />
                </Field>
                <Field label="Priorities">
                  <TextInput value={listToText(item.priorities)} onChange={(value) => updatePackage(item.package_id, { priorities: textToList(value).filter((priority): priority is ShoppingPriority => PRIORITY_OPTIONS.includes(priority as ShoppingPriority)) })} />
                </Field>
              </div>

              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <Field label="Label EN"><TextInput value={item.label.en} onChange={(value) => updatePackageText(item.package_id, "label", "en", value)} /></Field>
                <Field label="Label ES"><TextInput value={item.label.es} onChange={(value) => updatePackageText(item.package_id, "label", "es", value)} /></Field>
                <Field label="Description EN"><TextArea value={item.description.en} onChange={(value) => updatePackageText(item.package_id, "description", "en", value)} /></Field>
                <Field label="Description ES"><TextArea value={item.description.es} onChange={(value) => updatePackageText(item.package_id, "description", "es", value)} /></Field>
                <Field label="Need text EN"><TextArea value={item.need_text.en} onChange={(value) => updatePackageText(item.package_id, "need_text", "en", value)} /></Field>
                <Field label="Need text ES"><TextArea value={item.need_text.es} onChange={(value) => updatePackageText(item.package_id, "need_text", "es", value)} /></Field>
                <Field label="CTA EN"><TextInput value={item.cta_label.en} onChange={(value) => updatePackageText(item.package_id, "cta_label", "en", value)} /></Field>
                <Field label="CTA ES"><TextInput value={item.cta_label.es} onChange={(value) => updatePackageText(item.package_id, "cta_label", "es", value)} /></Field>
              </div>

              <div className="mt-3 grid gap-3">
                <Field label="Linked product IDs">
                  <TextArea value={listToText(item.product_ids)} onChange={(value) => updatePackage(item.package_id, { product_ids: textToList(value).filter((id) => productIds.includes(id)) })} placeholder={productIds.slice(0, 4).join(", ")} />
                </Field>
                <Field label="Constraints EN"><TextArea value={listToText(item.constraints.en)} onChange={(value) => updatePackageList(item.package_id, "en", value)} /></Field>
                <Field label="Constraints ES"><TextArea value={listToText(item.constraints.es)} onChange={(value) => updatePackageList(item.package_id, "es", value)} /></Field>
                <Field label="Admin notes" optional><TextArea value={item.admin_notes ?? ""} onChange={(value) => updatePackage(item.package_id, { admin_notes: value })} /></Field>
              </div>

              <button className="mt-4 rounded-2xl bg-purple-700 px-5 py-3 font-bold text-white" onClick={() => savePackage(item).catch((err) => setMessage(err.message))}>
                Save package
              </button>
            </article>
          ))}
        </section>
      </section>
    </main>
  );
}
