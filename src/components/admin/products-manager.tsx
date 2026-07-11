"use client"

import { useMemo, useState } from "react"
import toast from "react-hot-toast"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { TableSkeleton } from "@/components/ui/skeleton"
import { useData } from "@/hooks/use-data"
import {
  getAllProductsAdmin,
  createProduct,
  updateProduct,
  deleteProduct,
  uploadProductImage,
  bulkSetProductActive,
  bulkDeleteProducts,
  bulkAdjustProductPrices,
  type ProductInput,
} from "@/lib/api"
import { formatPrice, cn } from "@/lib/utils"
import type { Product } from "@/lib/types"
import { siteAbsoluteUrl } from "@/lib/admin-host"
import {
  inputCls, Field, Toggle, Warn, IconBtn, Modal, ConfirmDialog, SectionHeader,
} from "@/components/admin/ui"
import {
  Package, Plus, Search, Pencil, Trash2, Eye, ImagePlus, Star, Link2,
  LayoutGrid, List, Ban, CheckCircle, Percent, X, Filter,
} from "lucide-react"

type BrowseMode = "all" | "category" | "brand"
type StatusFilter = "all" | "active" | "inactive"
type ViewMode = "grid" | "list"

const PAGE_SIZE = 48

export function missingProduct(p: Product): string[] {
  const m: string[] = []
  if (!p.basePrice || p.basePrice <= 0) m.push("fiyat")
  if (!p.brand) m.push("marka")
  if (!p.category) m.push("kategori")
  if (!p.images?.length) m.push("fotoğraf")
  return m
}

export function AdminProducts() {
  const { data, loading, refetch } = useData(() => getAllProductsAdmin(), [])
  const products = data ?? []

  const [browse, setBrowse] = useState<BrowseMode>("all")
  const [groupValue, setGroupValue] = useState<string>("")
  const [status, setStatus] = useState<StatusFilter>("all")
  const [search, setSearch] = useState("")
  const [view, setView] = useState<ViewMode>("grid")
  const [page, setPage] = useState(0)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [form, setForm] = useState<Product | "new" | null>(null)
  const [del, setDel] = useState<Product | null>(null)
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)
  const [bulkPercent, setBulkPercent] = useState("10")
  const [bulkPriceOpen, setBulkPriceOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  const categories = useMemo(() => {
    const map = new Map<string, number>()
    for (const p of products) {
      const key = p.category?.trim() || "Kategorisiz"
      map.set(key, (map.get(key) ?? 0) + 1)
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "tr"))
  }, [products])

  const brands = useMemo(() => {
    const map = new Map<string, number>()
    for (const p of products) {
      const key = p.brand?.trim() || "Markasız"
      map.set(key, (map.get(key) ?? 0) + 1)
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "tr"))
  }, [products])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return products.filter((p) => {
      if (status === "active" && !p.isActive) return false
      if (status === "inactive" && p.isActive) return false
      if (browse === "category" && groupValue) {
        const cat = p.category?.trim() || "Kategorisiz"
        if (cat !== groupValue) return false
      }
      if (browse === "brand" && groupValue) {
        const brand = p.brand?.trim() || "Markasız"
        if (brand !== groupValue) return false
      }
      if (!q) return true
      return (
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.brand.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q)
      )
    })
  }, [products, search, status, browse, groupValue])

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const pageSafe = Math.min(page, pageCount - 1)
  const pageItems = filtered.slice(pageSafe * PAGE_SIZE, pageSafe * PAGE_SIZE + PAGE_SIZE)

  const selectedIds = [...selected]
  const allPageSelected = pageItems.length > 0 && pageItems.every((p) => selected.has(p.id))

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const togglePage = () => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (allPageSelected) pageItems.forEach((p) => next.delete(p.id))
      else pageItems.forEach((p) => next.add(p.id))
      return next
    })
  }

  const selectFiltered = () => {
    setSelected(new Set(filtered.map((p) => p.id)))
    toast.success(`${filtered.length} ürün seçildi`)
  }

  const clearSelection = () => setSelected(new Set())

  const runBulk = async (fn: () => Promise<void>) => {
    setBusy(true)
    try {
      await fn()
      clearSelection()
      refetch()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "İşlem başarısız")
    } finally {
      setBusy(false)
    }
  }

  const setBrowseMode = (mode: BrowseMode) => {
    setBrowse(mode)
    setGroupValue("")
    setPage(0)
    clearSelection()
  }

  return (
    <div className="space-y-4">
      <SectionHeader
        icon={Package}
        tone="success"
        title="Ürün Yönetimi"
        subtitle={`${products.length} ürün · ${filtered.length} görünür · ${selected.size} seçili`}
        action={
          <Button size="sm" icon={<Plus size={14} />} onClick={() => setForm("new")}>
            Yeni Ürün
          </Button>
        }
      />

      {/* Browse modes */}
      <div className="flex flex-wrap gap-2">
        {(
          [
            { id: "all" as const, label: "Tüm ürünler" },
            { id: "category" as const, label: "Kategori bazlı" },
            { id: "brand" as const, label: "Marka bazlı" },
          ]
        ).map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => setBrowseMode(m.id)}
            className={cn(
              "text-xs px-3 py-2 rounded-xl border transition-colors font-medium",
              browse === m.id
                ? "bg-accent/15 border-accent/40 text-accent"
                : "border-white/10 text-white/50 hover:text-white hover:bg-white/5"
            )}
          >
            {m.label}
          </button>
        ))}
      </div>

      <div className="flex flex-col lg:flex-row gap-4 items-start">
        {/* Side groups */}
        {browse !== "all" && (
          <div className="w-full lg:w-[220px] shrink-0 rounded-2xl border border-white/[0.08] bg-white/[0.02] overflow-hidden h-fit max-h-[70vh] flex flex-col">
            <div className="px-3 py-2.5 border-b border-white/5 text-xs text-white/40 font-medium flex items-center gap-1.5">
              <Filter size={12} />
              {browse === "category" ? "Kategoriler" : "Markalar"}
            </div>
            <div className="overflow-y-auto p-2 space-y-0.5">
              <button
                type="button"
                onClick={() => { setGroupValue(""); setPage(0) }}
                className={cn(
                  "w-full text-left text-xs px-2.5 py-2 rounded-lg transition-colors",
                  !groupValue ? "bg-accent/15 text-accent" : "text-white/55 hover:bg-white/5"
                )}
              >
                Tümü ({browse === "category" ? categories.length : brands.length} grup)
              </button>
              {(browse === "category" ? categories : brands).map(([name, count]) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => { setGroupValue(name); setPage(0); clearSelection() }}
                  className={cn(
                    "w-full text-left text-xs px-2.5 py-2 rounded-lg transition-colors flex items-center justify-between gap-2",
                    groupValue === name ? "bg-accent/15 text-accent" : "text-white/55 hover:bg-white/5"
                  )}
                >
                  <span className="truncate">{name}</span>
                  <span className="text-[10px] text-white/30 tabular-nums shrink-0">{count}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-3 min-w-0 flex-1 w-full">
          {/* Toolbar */}
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-3 space-y-3">
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
                <input
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(0) }}
                  placeholder="Ad, SKU, marka, kategori ara…"
                  className={cn(inputCls, "pl-9")}
                />
              </div>
              <div className="flex gap-2">
                <select
                  value={status}
                  onChange={(e) => { setStatus(e.target.value as StatusFilter); setPage(0) }}
                  className={cn(inputCls, "w-auto min-w-[120px]")}
                >
                  <option value="all">Tüm durum</option>
                  <option value="active">Aktif</option>
                  <option value="inactive">Pasif</option>
                </select>
                <div className="flex rounded-xl border border-white/10 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setView("grid")}
                    className={cn("px-2.5 py-2", view === "grid" ? "bg-white/10 text-white" : "text-white/40")}
                    title="Kart görünümü"
                  >
                    <LayoutGrid size={15} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setView("list")}
                    className={cn("px-2.5 py-2", view === "list" ? "bg-white/10 text-white" : "text-white/40")}
                    title="Liste görünümü"
                  >
                    <List size={15} />
                  </button>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <label className="inline-flex items-center gap-2 text-xs text-white/50 cursor-pointer select-none">
                <input type="checkbox" checked={allPageSelected} onChange={togglePage} className="accent-[var(--accent,#39ff14)]" />
                Sayfadakileri seç
              </label>
              <button type="button" onClick={selectFiltered} className="text-xs text-accent/80 hover:text-accent">
                Filtrelenenlerin tümünü seç ({filtered.length})
              </button>
              {selected.size > 0 && (
                <button type="button" onClick={clearSelection} className="text-xs text-white/40 hover:text-white inline-flex items-center gap-1">
                  <X size={12} /> Seçimi temizle
                </button>
              )}
            </div>

            {selected.size > 0 && (
              <div className="flex flex-wrap gap-2 pt-1 border-t border-white/5">
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={busy}
                  icon={<Percent size={13} />}
                  onClick={() => setBulkPriceOpen(true)}
                >
                  Toplu zam / indirim
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={busy}
                  icon={<Ban size={13} />}
                  onClick={() =>
                    runBulk(async () => {
                      const n = await bulkSetProductActive(selectedIds, false)
                      toast.success(`${n} ürün pasife alındı`)
                    })
                  }
                >
                  Pasife al
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={busy}
                  icon={<CheckCircle size={13} />}
                  onClick={() =>
                    runBulk(async () => {
                      const n = await bulkSetProductActive(selectedIds, true)
                      toast.success(`${n} ürün aktifleştirildi`)
                    })
                  }
                >
                  Aktifleştir
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  disabled={busy}
                  icon={<Trash2 size={13} />}
                  onClick={() => setBulkDeleteOpen(true)}
                >
                  Toplu sil
                </Button>
              </div>
            )}
          </div>

          {/* Content */}
          {loading ? (
            <div className="p-4 rounded-2xl border border-white/[0.08]"><TableSkeleton rows={6} /></div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 rounded-2xl border border-white/[0.08] bg-white/[0.02]">
              <Package size={36} className="mx-auto text-white/20 mb-3" />
              <p className="text-sm text-white/40">Ürün bulunamadı</p>
            </div>
          ) : view === "grid" ? (
            <div
              className="grid gap-4"
              style={{ gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}
            >
              {pageItems.map((product) => {
                const missing = missingProduct(product)
                const isSel = selected.has(product.id)
                const thumb = product.images.find((u) => Boolean(u?.trim()))
                return (
                  <div
                    key={product.id}
                    className={cn(
                      "rounded-2xl border bg-[#14161c] overflow-hidden transition-all flex flex-col min-w-0",
                      isSel
                        ? "border-accent/50 shadow-[0_0_0_1px_rgba(57,255,20,0.15)]"
                        : "border-white/[0.08] hover:border-white/20 hover:bg-[#171a22]"
                    )}
                  >
                    <div className="relative w-full aspect-square bg-[#0c0e12] border-b border-white/5">
                      {thumb ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={thumb}
                          alt={product.name}
                          className="absolute inset-0 w-full h-full object-contain p-4"
                          loading="lazy"
                          onError={(e) => {
                            e.currentTarget.style.display = "none"
                            const fallback = e.currentTarget.nextElementSibling as HTMLElement | null
                            if (fallback) fallback.classList.remove("hidden")
                          }}
                        />
                      ) : null}
                      <div
                        className={cn(
                          "absolute inset-0 flex flex-col items-center justify-center gap-2 text-white/25",
                          thumb ? "hidden" : ""
                        )}
                      >
                        <Package size={36} strokeWidth={1.25} />
                        <span className="text-[11px]">Fotoğraf yok</span>
                      </div>

                      <label
                        className="absolute top-3 left-3 z-10 flex items-center justify-center w-6 h-6 rounded-lg bg-black/60 border border-white/15 backdrop-blur-sm cursor-pointer"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          checked={isSel}
                          onChange={() => toggleOne(product.id)}
                          className="w-3.5 h-3.5 accent-[#39ff14]"
                        />
                      </label>
                      <div className="absolute top-3 right-3 z-10">
                        <Badge variant={product.isActive ? "success" : "default"} size="sm">
                          {product.isActive ? "Aktif" : "Pasif"}
                        </Badge>
                      </div>
                    </div>

                    <div className="p-4 flex flex-col gap-3 flex-1">
                      <div className="min-w-0 space-y-1">
                        <p className="text-[13px] font-semibold text-white leading-snug line-clamp-2" title={product.name}>
                          {product.name}
                        </p>
                        <p className="text-[11px] text-white/40 truncate">
                          {[product.brand, product.category].filter(Boolean).join(" · ") || "—"}
                        </p>
                        <p className="text-[10px] text-white/25 font-mono truncate">{product.sku}</p>
                      </div>

                      <div className="flex items-end justify-between gap-2 mt-auto">
                        <div>
                          <p className="text-base font-bold text-accent tabular-nums leading-none">
                            {formatPrice(product.basePrice)}
                          </p>
                          <p className="text-[11px] text-white/35 mt-1">
                            Stok {product.stock[0]?.available ?? 0}
                          </p>
                        </div>
                        {missing.length > 0 && <Warn items={missing} />}
                      </div>

                      <div className="flex items-center gap-1 pt-1 border-t border-white/5">
                        <a
                          href={siteAbsoluteUrl(`/products/${product.id}`)}
                          className="w-9 h-9 rounded-xl flex items-center justify-center text-white/40 hover:text-white hover:bg-white/5"
                          title="Mağazada gör"
                        >
                          <Eye size={15} />
                        </a>
                        <button
                          type="button"
                          onClick={() => setForm(product)}
                          className="flex-1 h-9 rounded-xl text-xs font-medium text-white/70 hover:text-white hover:bg-white/5 transition-colors"
                        >
                          Düzenle
                        </button>
                        <IconBtn icon={Trash2} label="Sil" tone="danger" onClick={() => setDel(product)} />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="rounded-2xl border border-white/[0.08] overflow-hidden bg-white/[0.02]">
              <div className="overflow-auto max-h-[65vh]">
                <table className="w-full">
                  <thead className="sticky top-0 bg-[#12141a] z-10">
                    <tr className="border-b border-white/5">
                      <th className="p-3 w-10" />
                      <th className="text-left text-xs font-medium text-white/30 p-3">Ürün</th>
                      <th className="text-left text-xs font-medium text-white/30 p-3">SKU</th>
                      <th className="text-right text-xs font-medium text-white/30 p-3">Fiyat</th>
                      <th className="text-right text-xs font-medium text-white/30 p-3">Stok</th>
                      <th className="text-center text-xs font-medium text-white/30 p-3">Durum</th>
                      <th className="text-right text-xs font-medium text-white/30 p-3">İşlem</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageItems.map((product) => {
                      const missing = missingProduct(product)
                      return (
                        <tr key={product.id} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                          <td className="p-3">
                            <input
                              type="checkbox"
                              checked={selected.has(product.id)}
                              onChange={() => toggleOne(product.id)}
                              className="accent-[var(--accent,#39ff14)]"
                            />
                          </td>
                          <td className="p-3">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-14 h-14 rounded-xl bg-[#0c0e12] border border-white/5 overflow-hidden shrink-0 flex items-center justify-center">
                                {product.images.find((u) => u?.trim()) ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={product.images.find((u) => u?.trim())}
                                    alt=""
                                    className="w-full h-full object-contain p-1.5"
                                    loading="lazy"
                                  />
                                ) : (
                                  <Package size={16} className="text-white/25" />
                                )}
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm text-white/85 truncate flex items-center gap-2">
                                  {product.name}
                                  <Warn items={missing} />
                                </p>
                                <p className="text-[11px] text-white/35 truncate">
                                  {product.brand || "—"} · {product.category || "—"}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="p-3 text-sm text-white/40 font-mono">{product.sku}</td>
                          <td className="p-3 text-right text-sm font-medium text-white">{formatPrice(product.basePrice)}</td>
                          <td className="p-3 text-right text-sm text-white/60">{product.stock[0]?.available ?? 0}</td>
                          <td className="p-3 text-center">
                            <Badge variant={product.isActive ? "success" : "default"} size="sm">
                              {product.isActive ? "Aktif" : "Pasif"}
                            </Badge>
                          </td>
                          <td className="p-3">
                            <div className="flex items-center justify-end gap-1">
                              <a href={siteAbsoluteUrl(`/products/${product.id}`)} className="w-7 h-7 rounded-lg flex items-center justify-center text-white/30 hover:text-white hover:bg-white/5">
                                <Eye size={14} />
                              </a>
                              <IconBtn icon={Pencil} label="Düzenle" onClick={() => setForm(product)} />
                              <IconBtn icon={Trash2} label="Sil" tone="danger" onClick={() => setDel(product)} />
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {pageCount > 1 && (
            <div className="flex items-center justify-between gap-3 text-xs text-white/40">
              <span>
                {pageSafe * PAGE_SIZE + 1}–{Math.min(filtered.length, (pageSafe + 1) * PAGE_SIZE)} / {filtered.length}
              </span>
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" disabled={pageSafe <= 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>
                  Önceki
                </Button>
                <Button size="sm" variant="secondary" disabled={pageSafe >= pageCount - 1} onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}>
                  Sonraki
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {form && (
        <ProductForm
          product={form === "new" ? null : form}
          onClose={() => setForm(null)}
          onSaved={() => { setForm(null); refetch() }}
        />
      )}

      {del && (
        <ConfirmDialog
          title="Ürünü Sil"
          message={`"${del.name}" kalıcı olarak silinecek. Devam edilsin mi?`}
          onCancel={() => setDel(null)}
          onConfirm={async () => {
            try {
              await deleteProduct(del.id)
              toast.success("Ürün silindi")
              setDel(null)
              refetch()
            } catch (e) {
              toast.error(e instanceof Error ? e.message : "Silinemedi")
            }
          }}
        />
      )}

      {bulkDeleteOpen && (
        <ConfirmDialog
          title="Toplu Sil"
          message={`${selected.size} ürün kalıcı olarak silinecek. Bu işlem geri alınamaz.`}
          onCancel={() => setBulkDeleteOpen(false)}
          onConfirm={async () => {
            setBulkDeleteOpen(false)
            await runBulk(async () => {
              const n = await bulkDeleteProducts(selectedIds)
              toast.success(`${n} ürün silindi`)
            })
          }}
        />
      )}

      {bulkPriceOpen && (
        <Modal title="Toplu fiyat güncelle" icon={Percent} onClose={() => setBulkPriceOpen(false)}>
          <p className="text-sm text-white/50 mb-3">
            Seçili {selected.size} ürüne yüzde zam veya indirim uygulanır. İndirim için negatif yazın (ör. -10).
          </p>
          <Field label="Yüzde (%)">
            <input
              type="number"
              value={bulkPercent}
              onChange={(e) => setBulkPercent(e.target.value)}
              className={inputCls}
              step="0.5"
            />
          </Field>
          <div className="flex gap-2 mt-4">
            <Button
              className="flex-1"
              disabled={busy}
              onClick={async () => {
                const percent = Number(bulkPercent)
                if (!Number.isFinite(percent) || percent === 0) {
                  toast.error("Geçerli bir yüzde girin")
                  return
                }
                setBulkPriceOpen(false)
                await runBulk(async () => {
                  const n = await bulkAdjustProductPrices(selectedIds, percent)
                  toast.success(`${n} ürün güncellendi (%${percent})`)
                })
              }}
            >
              Uygula
            </Button>
            <Button variant="secondary" onClick={() => setBulkPriceOpen(false)}>İptal</Button>
          </div>
        </Modal>
      )}
    </div>
  )
}

export function ProductForm({ product, onClose, onSaved }: { product: Product | null; onClose: () => void; onSaved: () => void }) {
  const isEdit = !!product
  const [sku, setSku] = useState(product?.sku ?? "")
  const [name, setName] = useState(product?.name ?? "")
  const [brand, setBrand] = useState(product?.brand ?? "")
  const [category, setCategory] = useState(product?.category ?? "")
  const [description, setDescription] = useState(product?.description ?? "")
  const [basePrice, setBasePrice] = useState(String(product?.basePrice ?? ""))
  const [stockQuantity, setStockQuantity] = useState(String(product?.stock[0]?.available ?? "0"))
  const [isActive, setIsActive] = useState(product?.isActive ?? true)
  const [images, setImages] = useState<string[]>(product?.images ?? [])
  const [imageUrl, setImageUrl] = useState("")
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)

  const folderKey = product?.id || sku || "new"

  const addUrl = () => {
    const url = imageUrl.trim()
    if (!url) return
    try {
      // eslint-disable-next-line no-new
      new URL(url)
    } catch {
      toast.error("Geçerli bir görsel URL girin")
      return
    }
    if (images.includes(url)) {
      toast.error("Bu görsel zaten ekli")
      return
    }
    setImages((prev) => [...prev, url])
    setImageUrl("")
  }

  const onUpload = async (files: FileList | null) => {
    if (!files?.length) return
    setUploading(true)
    try {
      const uploaded: string[] = []
      for (const file of Array.from(files)) {
        const url = await uploadProductImage(file, folderKey)
        uploaded.push(url)
      }
      setImages((prev) => [...prev, ...uploaded])
      toast.success(`${uploaded.length} fotoğraf yüklendi`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Yükleme başarısız")
    } finally {
      setUploading(false)
    }
  }

  const removeImage = (url: string) => setImages((prev) => prev.filter((u) => u !== url))
  const makePrimary = (url: string) =>
    setImages((prev) => [url, ...prev.filter((u) => u !== url)])

  const submit = async () => {
    if (!name.trim() || !sku.trim()) { toast.error("Ad ve SKU gerekli"); return }
    setSaving(true)
    const input: ProductInput = {
      sku, name, brand, category, description,
      basePrice: Number(basePrice) || 0,
      stockQuantity: Number(stockQuantity) || 0,
      isActive,
      images,
    }
    try {
      if (isEdit && product) { await updateProduct(product.id, input); toast.success("Ürün güncellendi") }
      else { await createProduct(input); toast.success("Ürün oluşturuldu") }
      onSaved()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Kaydedilemedi")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title={isEdit ? "Ürünü Düzenle" : "Yeni Ürün"} icon={Package} size="lg" onClose={onClose}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Ürün Adı"><input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} /></Field>
        <Field label="SKU"><input value={sku} onChange={(e) => setSku(e.target.value)} className={inputCls} /></Field>
        <Field label="Marka"><input value={brand} onChange={(e) => setBrand(e.target.value)} className={inputCls} /></Field>
        <Field label="Kategori"><input value={category} onChange={(e) => setCategory(e.target.value)} className={inputCls} /></Field>
        <Field label="Fiyat (₺)"><input type="number" value={basePrice} onChange={(e) => setBasePrice(e.target.value)} className={inputCls} /></Field>
        <Field label="Stok Adedi"><input type="number" value={stockQuantity} onChange={(e) => setStockQuantity(e.target.value)} className={inputCls} /></Field>
      </div>
      <Field label="Açıklama"><textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className={cn(inputCls, "h-auto py-2 resize-none")} /></Field>

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-medium text-white/50">Fotoğraflar ({images.length})</p>
          <label className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-accent/30 bg-accent/10 text-accent cursor-pointer hover:bg-accent/15">
            <ImagePlus size={13} />
            {uploading ? "Yükleniyor…" : "Dosya yükle"}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              multiple
              className="hidden"
              disabled={uploading}
              onChange={(e) => {
                void onUpload(e.target.files)
                e.target.value = ""
              }}
            />
          </label>
        </div>

        {images.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] p-6 text-center">
            <Package size={28} className="mx-auto text-white/20 mb-2" />
            <p className="text-xs text-white/40">Henüz fotoğraf yok. Dosya yükleyin veya URL ekleyin.</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {images.map((url, i) => (
              <div key={url} className="relative group aspect-square rounded-xl overflow-hidden border border-white/10 bg-white/[0.03]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="" className="w-full h-full object-contain p-1.5" />
                {i === 0 && (
                  <span className="absolute left-1.5 top-1.5 text-[9px] px-1.5 py-0.5 rounded bg-accent text-black font-medium">
                    Ana
                  </span>
                )}
                <div className="absolute inset-x-0 bottom-0 p-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-t from-black/80 to-transparent">
                  {i !== 0 && (
                    <button
                      type="button"
                      title="Ana fotoğraf yap"
                      onClick={() => makePrimary(url)}
                      className="flex-1 h-7 rounded-md bg-white/10 hover:bg-accent/30 text-white flex items-center justify-center"
                    >
                      <Star size={12} />
                    </button>
                  )}
                  <button
                    type="button"
                    title="Kaldır"
                    onClick={() => removeImage(url)}
                    className="flex-1 h-7 rounded-md bg-danger/20 hover:bg-danger/40 text-danger flex items-center justify-center"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          <div className="relative flex-1">
            <Link2 size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
            <input
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addUrl() } }}
              placeholder="veya görsel URL yapıştır…"
              className={cn(inputCls, "pl-9")}
            />
          </div>
          <Button type="button" variant="secondary" size="sm" onClick={addUrl}>Ekle</Button>
        </div>
      </div>

      <Toggle checked={isActive} onChange={setIsActive} label="Ürün aktif (mağazada görünür)" />
      <Button className="w-full" onClick={submit} disabled={saving || uploading}>
        {saving ? "Kaydediliyor..." : isEdit ? "Kaydet" : "Oluştur"}
      </Button>
    </Modal>
  )
}
