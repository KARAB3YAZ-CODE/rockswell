"use client"

import { useMemo, useState } from "react"
import toast from "react-hot-toast"
import { GlassCard } from "@/components/effects/glass-card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { TableSkeleton } from "@/components/ui/skeleton"
import { useData } from "@/hooks/use-data"
import {
  getAllProductsAdmin,
  getAllWarehouses,
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
import { supabase } from "@/lib/supabase"
import {
  inputCls, Field, Toggle, Warn, IconBtn, Modal, ConfirmDialog, SectionHeader,
} from "@/components/admin/ui"
import {
  Package, Plus, Search, Pencil, Trash2, Eye, ImagePlus, Star, Link2,
  LayoutGrid, List, Ban, CheckCircle, Percent, X, Filter, Upload,
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

function vehicleBrandLabel(p: Product, max = 3): string {
  const names = [
    ...new Set(
      (p.compatibleVehicles ?? [])
        .map((v) => v.brand?.trim())
        .filter((b): b is string => Boolean(b))
    ),
  ]
  if (names.length === 0) return ""
  if (names.length <= max) return names.join(", ")
  return `${names.slice(0, max).join(", ")} +${names.length - max}`
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
  const [importOpen, setImportOpen] = useState(false)
  const [csvText, setCsvText] = useState("")
  const [importing, setImporting] = useState(false)

  const categories = useMemo(() => {
    const map = new Map<string, number>()
    for (const p of products) {
      const key = p.category?.trim() || "Kategorisiz"
      map.set(key, (map.get(key) ?? 0) + 1)
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "tr"))
  }, [products])

  const vehicleBrands = useMemo(() => {
    const map = new Map<string, number>()
    for (const p of products) {
      const names = [
        ...new Set(
          (p.compatibleVehicles ?? [])
            .map((v) => v.brand?.trim())
            .filter((b): b is string => Boolean(b))
        ),
      ]
      if (names.length === 0) {
        map.set("Uyumluluk yok", (map.get("Uyumluluk yok") ?? 0) + 1)
        continue
      }
      for (const name of names) {
        map.set(name, (map.get(name) ?? 0) + 1)
      }
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
        const names = (p.compatibleVehicles ?? [])
          .map((v) => v.brand?.trim())
          .filter(Boolean)
        if (groupValue === "Uyumluluk yok") {
          if (names.length > 0) return false
        } else if (!names.includes(groupValue)) {
          return false
        }
      }
      if (!q) return true
      const vehicleHit = (p.compatibleVehicles ?? []).some(
        (v) =>
          v.brand?.toLowerCase().includes(q) ||
          v.model?.toLowerCase().includes(q)
      )
      return (
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.brand.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        vehicleHit
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
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" icon={<Upload size={14} />} onClick={() => setImportOpen(true)}>
              CSV İçe Aktar
            </Button>
            <Button size="sm" icon={<Plus size={14} />} onClick={() => setForm("new")}>
              Yeni Ürün
            </Button>
          </div>
        }
      />

      {/* Browse modes */}
      <div className="flex flex-wrap gap-2">
        {(
          [
            { id: "all" as const, label: "Tüm ürünler" },
            { id: "category" as const, label: "Kategori bazlı" },
            { id: "brand" as const, label: "Araç markası" },
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
          <div className="w-full lg:w-[220px] shrink-0 rounded-2xl border border-border bg-card/60 overflow-hidden h-fit max-h-[70vh] flex flex-col">
            <div className="px-3 py-2.5 border-b border-border text-xs text-white/40 font-medium flex items-center gap-1.5">
              <Filter size={12} />
              {browse === "category" ? "Kategoriler" : "Araç markaları"}
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
                Tümü ({browse === "category" ? categories.length : vehicleBrands.length} grup)
              </button>
              {(browse === "category" ? categories : vehicleBrands).map(([name, count]) => (
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
          <div className="rounded-2xl border border-border bg-card/60 p-3 space-y-3">
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
                <input
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(0) }}
                  placeholder="Ad, SKU, araç markası, kategori ara…"
                  className={cn(inputCls, "pl-9")}
                />
              </div>
              <div className="flex gap-2">
                <select
                  value={status}
                  onChange={(e) => { setStatus(e.target.value as StatusFilter); setPage(0) }}
                  className={cn(inputCls, "w-auto min-w-[120px]")}
                >
                  <option value="all" className="bg-card">Tüm durum</option>
                  <option value="active" className="bg-card">Aktif</option>
                  <option value="inactive" className="bg-card">Pasif</option>
                </select>
                <div className="flex rounded-xl border border-border overflow-hidden bg-white/[0.02]">
                  <button
                    type="button"
                    onClick={() => setView("grid")}
                    className={cn("px-2.5 py-2 transition-colors", view === "grid" ? "bg-accent/15 text-accent" : "text-white/40 hover:text-white")}
                    title="Kart görünümü"
                  >
                    <LayoutGrid size={15} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setView("list")}
                    className={cn("px-2.5 py-2 transition-colors", view === "list" ? "bg-accent/15 text-accent" : "text-white/40 hover:text-white")}
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
            <div className="p-4 rounded-2xl border border-border bg-card/40"><TableSkeleton rows={6} /></div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 rounded-2xl border border-border bg-card/40">
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
                  <GlassCard
                    key={product.id}
                    intensity="light"
                    className={cn(
                      "p-0 overflow-hidden transition-all flex flex-col min-w-0 group",
                      isSel
                        ? "border-accent/40 shadow-lg shadow-accent/5"
                        : "hover:border-accent/20"
                    )}
                  >
                    <div className="relative w-full aspect-square bg-white/[0.06] border-b border-white/5 overflow-hidden">
                      {thumb ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={thumb}
                          alt={product.name}
                          className="absolute inset-0 w-full h-full object-cover"
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
                          "absolute inset-0 flex flex-col items-center justify-center gap-2 text-white/25 bg-gradient-to-b from-white/[0.04] to-transparent",
                          thumb ? "hidden" : ""
                        )}
                      >
                        <div className="w-14 h-14 rounded-2xl bg-accent/10 border border-accent/15 flex items-center justify-center">
                          <Package size={26} className="text-accent/50" strokeWidth={1.25} />
                        </div>
                        <span className="text-[11px] text-white/35">Fotoğraf yok</span>
                      </div>

                      <label
                        className="absolute top-3 left-3 z-10 flex items-center justify-center w-6 h-6 rounded-lg bg-card/80 border border-border backdrop-blur-sm cursor-pointer"
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

                    <div className="p-4 flex flex-col gap-3 flex-1 bg-gradient-to-b from-transparent to-card/40">
                      <div className="min-w-0 space-y-1">
                        <p className="text-[10px] text-white/30 font-mono truncate">{product.sku}</p>
                        <p
                          className="text-[13px] font-semibold text-white leading-snug line-clamp-2 group-hover:text-accent transition-colors"
                          title={product.name}
                        >
                          {product.name}
                        </p>
                        <p className="text-[11px] text-white/40 truncate">
                          {[vehicleBrandLabel(product) || product.brand, product.category].filter(Boolean).join(" · ") || "—"}
                        </p>
                      </div>

                      <div className="flex items-end justify-between gap-2 mt-auto pt-2 border-t border-white/5">
                        <div>
                          <p className="text-base font-bold text-accent tabular-nums leading-none">
                            {formatPrice(product.basePrice)}
                          </p>
                          <p className="text-[11px] text-white/35 mt-1">
                            Stok {product.stock.reduce((s, w) => s + (w.available ?? 0), 0)}
                          </p>
                        </div>
                        {missing.length > 0 && <Warn items={missing} />}
                      </div>

                      <div className="flex items-center gap-1">
                        <a
                          href={siteAbsoluteUrl(`/products/${product.id}`)}
                          className="w-9 h-9 rounded-xl flex items-center justify-center text-white/40 hover:text-white hover:bg-white/5 transition-colors"
                          title="Mağazada gör"
                        >
                          <Eye size={15} />
                        </a>
                        <button
                          type="button"
                          onClick={() => setForm(product)}
                          className="flex-1 h-9 rounded-xl text-xs font-medium text-white/60 hover:text-accent hover:bg-accent/10 transition-colors"
                        >
                          Düzenle
                        </button>
                        <IconBtn icon={Trash2} label="Sil" tone="danger" onClick={() => setDel(product)} />
                      </div>
                    </div>
                  </GlassCard>
                )
              })}
            </div>
          ) : (
            <div className="rounded-2xl border border-border bg-card/60 overflow-hidden">
              <div className="overflow-auto max-h-[65vh]">
                <table className="w-full">
                  <thead className="sticky top-0 bg-card z-10">
                    <tr className="border-b border-border">
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
                      const thumb = product.images.find((u) => u?.trim())
                      return (
                        <tr key={product.id} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                          <td className="p-3">
                            <input
                              type="checkbox"
                              checked={selected.has(product.id)}
                              onChange={() => toggleOne(product.id)}
                              className="accent-[#39ff14]"
                            />
                          </td>
                          <td className="p-3">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-16 h-16 rounded-xl bg-white/[0.06] border border-border overflow-hidden shrink-0 flex items-center justify-center">
                                {thumb ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={thumb}
                                    alt=""
                                    className="w-full h-full object-cover"
                                    loading="lazy"
                                  />
                                ) : (
                                  <Package size={16} className="text-accent/40" />
                                )}
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm text-white/85 truncate flex items-center gap-2">
                                  {product.name}
                                  <Warn items={missing} />
                                </p>
                                <p className="text-[11px] text-white/35 truncate">
                                  {vehicleBrandLabel(product) || product.brand || "—"} · {product.category || "—"}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="p-3 text-sm text-white/40 font-mono">{product.sku}</td>
                          <td className="p-3 text-right text-sm font-medium text-accent">{formatPrice(product.basePrice)}</td>
                          <td className="p-3 text-right text-sm text-white/60">{product.stock.reduce((s, w) => s + (w.available ?? 0), 0)}</td>
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
          categoryOptions={categories.map(([n]) => n).filter((n) => n !== "Kategorisiz")}
          vehicleBrandOptions={vehicleBrands.map(([n]) => n).filter((n) => n !== "Uyumluluk yok")}
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

      {importOpen && (
        <Modal title="Katalog CSV İçe Aktar" icon={Upload} size="lg" onClose={() => setImportOpen(false)}>
          <p className="text-xs text-white/40 mb-2">
            Format: <code className="text-accent">sku;name;brand;category;oem;price;warehouse_code;qty;description</code>
          </p>
          <textarea
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
            rows={12}
            className={cn(inputCls, "font-mono text-xs")}
            placeholder={"sku;name;brand;category;oem;price;warehouse_code;qty\nRW-001;Örnek Ürün;ROCKSWELL;Filtreler;;100;ANA;50"}
          />
          <Button
            className="w-full mt-3"
            disabled={importing || !csvText.trim()}
            onClick={async () => {
              setImporting(true)
              try {
                const { data: { session } } = await supabase.auth.getSession()
                if (!session?.access_token) throw new Error("Oturum gerekli")
                const res = await fetch("/api/admin/import/catalog", {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${session.access_token}`,
                  },
                  body: JSON.stringify({ csvText }),
                })
                const body = await res.json()
                if (!res.ok) throw new Error(body.error || "İçe aktarma başarısız")
                toast.success(
                  `${body.upserted} ürün içe aktarıldı` +
                    (body.errors?.length ? ` · ${body.errors.length} hata` : "") +
                    (body.skipped?.length ? ` · ${body.skipped.length} atlandı` : "")
                )
                setImportOpen(false)
                setCsvText("")
                refetch()
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "İçe aktarma başarısız")
              } finally {
                setImporting(false)
              }
            }}
          >
            {importing ? "Aktarılıyor…" : "İçe Aktar"}
          </Button>
        </Modal>
      )}
    </div>
  )
}

const COMMON_VEHICLE_BRANDS = [
  "AUDI", "BMW", "MERCEDES", "VOLKSWAGEN", "SEAT", "SKODA", "RENAULT", "FIAT",
  "PEUGEOT", "CITROEN", "FORD", "OPEL", "DACIA", "HYUNDAI", "HONDA", "TOYOTA",
  "MAZDA", "NISSAN", "VOLVO", "KIA", "PORSCHE", "JEEP", "LAND ROVER", "TOFAS",
]

function uniqueSorted(values: string[]) {
  return [...new Set(values.map((v) => v.trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, "tr"))
}

function applyVehicleBrands(
  existing: Product["compatibleVehicles"],
  brands: string[]
): Product["compatibleVehicles"] {
  const selected = new Set(brands.map((b) => b.trim()).filter(Boolean))
  const kept = (existing ?? []).filter((v) => selected.has(v.brand?.trim()))
  const keptBrands = new Set(kept.map((v) => v.brand.trim()))
  const stubs = [...selected]
    .filter((b) => !keptBrands.has(b))
    .map((brand) => ({
      brand,
      model: "",
      yearStart: 0,
      yearEnd: 0,
      engine: "",
      fuel: "",
      transmission: "",
    }))
  return [...kept, ...stubs]
}

export function ProductForm({
  product,
  categoryOptions = [],
  vehicleBrandOptions = [],
  onClose,
  onSaved,
}: {
  product: Product | null
  categoryOptions?: string[]
  vehicleBrandOptions?: string[]
  onClose: () => void
  onSaved: () => void
}) {
  const isEdit = !!product
  const [sku, setSku] = useState(product?.sku ?? "")
  const [name, setName] = useState(product?.name ?? "")
  const [brand, setBrand] = useState(product?.brand ?? "ROCKSWELL")
  const [category, setCategory] = useState(product?.category ?? "")
  const [categoryCustom, setCategoryCustom] = useState(false)
  const [vehicleBrands, setVehicleBrands] = useState<string[]>(() =>
    uniqueSorted((product?.compatibleVehicles ?? []).map((v) => v.brand))
  )
  const [brandQuery, setBrandQuery] = useState("")
  const [customVehicleBrand, setCustomVehicleBrand] = useState("")
  const [description, setDescription] = useState(product?.description ?? "")
  const [basePrice, setBasePrice] = useState(String(product?.basePrice ?? ""))
  const [stockLines, setStockLines] = useState<{ warehouseId: string; warehouseName: string; quantity: string }[]>(() => {
    if (product?.stock?.length) {
      return product.stock.map((s) => ({
        warehouseId: s.warehouseId,
        warehouseName: s.warehouseName,
        quantity: String(s.quantity ?? s.available ?? 0),
      }))
    }
    return [{ warehouseId: "", warehouseName: "", quantity: "0" }]
  })
  const { data: warehouses } = useData(() => getAllWarehouses(), [])
  const [isActive, setIsActive] = useState(product?.isActive ?? true)
  const [images, setImages] = useState<string[]>(product?.images ?? [])
  const [imageUrl, setImageUrl] = useState("")
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)

  const folderKey = product?.id || sku || "new"

  const allCategories = useMemo(
    () => uniqueSorted([...categoryOptions, category]),
    [categoryOptions, category]
  )

  const allVehicleBrandOptions = useMemo(
    () => uniqueSorted([...COMMON_VEHICLE_BRANDS, ...vehicleBrandOptions, ...vehicleBrands]),
    [vehicleBrandOptions, vehicleBrands]
  )

  const filteredBrandOptions = useMemo(() => {
    const q = brandQuery.trim().toLowerCase()
    if (!q) return allVehicleBrandOptions
    return allVehicleBrandOptions.filter((b) => b.toLowerCase().includes(q))
  }, [allVehicleBrandOptions, brandQuery])

  const toggleVehicleBrand = (b: string) => {
    setVehicleBrands((prev) =>
      prev.includes(b) ? prev.filter((x) => x !== b) : uniqueSorted([...prev, b])
    )
  }

  const addCustomVehicleBrand = () => {
    const next = customVehicleBrand.trim().toUpperCase()
    if (!next) return
    setVehicleBrands((prev) => uniqueSorted([...prev, next]))
    setCustomVehicleBrand("")
    setBrandQuery("")
  }

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
    if (!category.trim()) { toast.error("Kategori seçin veya yazın"); return }
    setSaving(true)
    const resolvedLines = stockLines
      .filter((l) => l.warehouseId)
      .map((l) => ({
        warehouseId: l.warehouseId,
        warehouseName:
          l.warehouseName ||
          (warehouses ?? []).find((w) => w.id === l.warehouseId)?.name ||
          l.warehouseId,
        quantity: Number(l.quantity) || 0,
      }))
    const input: ProductInput = {
      sku,
      name,
      brand: brand.trim() || "ROCKSWELL",
      category: category.trim(),
      description,
      basePrice: Number(basePrice) || 0,
      stockQuantity: resolvedLines.reduce((s, l) => s + l.quantity, 0),
      stockLines: resolvedLines.length ? resolvedLines : undefined,
      isActive,
      images,
      compatibleVehicles: applyVehicleBrands(product?.compatibleVehicles ?? [], vehicleBrands),
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
    <Modal
      title={isEdit ? "Ürünü Düzenle" : "Yeni Ürün"}
      subtitle={isEdit ? product?.sku : "Kategori ve araç markası ile sınıflandırın"}
      icon={Package}
      size="lg"
      onClose={onClose}
    >
      <div className="space-y-5">
        <section className="space-y-3">
          <p className="text-[11px] font-medium uppercase tracking-wide text-white/35">Temel bilgiler</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Ürün Adı">
              <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
            </Field>
            <Field label="SKU">
              <input value={sku} onChange={(e) => setSku(e.target.value)} className={inputCls} />
            </Field>
          </div>
        </section>

        <section className="space-y-3">
          <p className="text-[11px] font-medium uppercase tracking-wide text-white/35">Sınıflandırma</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Kategori">
              {categoryCustom ? (
                <div className="space-y-1.5">
                  <input
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    placeholder="Yeni kategori adı…"
                    className={inputCls}
                    autoFocus
                  />
                  <button
                    type="button"
                    className="text-[11px] text-accent hover:underline"
                    onClick={() => setCategoryCustom(false)}
                  >
                    Listeden seç
                  </button>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <select
                    value={category}
                    onChange={(e) => {
                      if (e.target.value === "__new__") {
                        setCategoryCustom(true)
                        setCategory("")
                        return
                      }
                      setCategory(e.target.value)
                    }}
                    className={cn(inputCls, "cursor-pointer")}
                  >
                    <option value="" className="bg-card">Kategori seçin…</option>
                    {allCategories.map((c) => (
                      <option key={c} value={c} className="bg-card">{c}</option>
                    ))}
                    <option value="__new__" className="bg-card">+ Yeni kategori yaz…</option>
                  </select>
                </div>
              )}
            </Field>
            <Field label="Üretici marka">
              <input
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                list="product-manufacturer-brands"
                placeholder="ROCKSWELL"
                className={inputCls}
              />
              <datalist id="product-manufacturer-brands">
                <option value="ROCKSWELL" />
              </datalist>
            </Field>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-medium text-white/50">
                Araç markaları
                {vehicleBrands.length > 0 && (
                  <span className="text-white/30 font-normal"> · {vehicleBrands.length} seçili</span>
                )}
              </p>
              {vehicleBrands.length > 0 && (
                <button
                  type="button"
                  onClick={() => setVehicleBrands([])}
                  className="text-[11px] text-white/35 hover:text-white"
                >
                  Temizle
                </button>
              )}
            </div>

            {vehicleBrands.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {vehicleBrands.map((b) => (
                  <button
                    key={b}
                    type="button"
                    onClick={() => toggleVehicleBrand(b)}
                    className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-lg bg-accent/15 border border-accent/35 text-accent"
                  >
                    {b}
                    <X size={11} />
                  </button>
                ))}
              </div>
            )}

            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
              <input
                value={brandQuery}
                onChange={(e) => setBrandQuery(e.target.value)}
                placeholder="Araç markası ara (Audi, VW, Seat…)"
                className={cn(inputCls, "pl-9")}
              />
            </div>

            <div className="max-h-36 overflow-y-auto rounded-xl border border-border bg-white/[0.02] p-2 flex flex-wrap gap-1.5 content-start">
              {filteredBrandOptions.length === 0 ? (
                <p className="text-[11px] text-white/35 p-2">Sonuç yok — aşağıdan ekleyin</p>
              ) : (
                filteredBrandOptions.map((b) => {
                  const active = vehicleBrands.includes(b)
                  return (
                    <button
                      key={b}
                      type="button"
                      onClick={() => toggleVehicleBrand(b)}
                      className={cn(
                        "text-[11px] px-2.5 py-1.5 rounded-lg border transition-colors",
                        active
                          ? "bg-accent/15 border-accent/40 text-accent"
                          : "border-white/10 text-white/55 hover:text-white hover:bg-white/5"
                      )}
                    >
                      {b}
                    </button>
                  )
                })
              )}
            </div>

            <div className="flex gap-2">
              <input
                value={customVehicleBrand}
                onChange={(e) => setCustomVehicleBrand(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    addCustomVehicleBrand()
                  }
                }}
                placeholder="Listede yoksa yeni araç markası…"
                className={inputCls}
              />
              <Button type="button" variant="secondary" size="sm" onClick={addCustomVehicleBrand}>
                Ekle
              </Button>
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <p className="text-[11px] font-medium uppercase tracking-wide text-white/35">Fiyat & stok</p>
          <Field label="Fiyat (₺)">
            <input type="number" value={basePrice} onChange={(e) => setBasePrice(e.target.value)} className={inputCls} />
          </Field>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-white/50">Depo stokları</p>
              <button
                type="button"
                className="text-[11px] text-accent hover:underline"
                onClick={() =>
                  setStockLines((prev) => [...prev, { warehouseId: "", warehouseName: "", quantity: "0" }])
                }
              >
                + Depo satırı
              </button>
            </div>
            {stockLines.map((line, idx) => (
              <div key={idx} className="grid grid-cols-[1fr_100px_auto] gap-2">
                <select
                  value={line.warehouseId}
                  onChange={(e) => {
                    const wh = (warehouses ?? []).find((w) => w.id === e.target.value)
                    setStockLines((prev) =>
                      prev.map((l, i) =>
                        i === idx
                          ? { warehouseId: e.target.value, warehouseName: wh?.name ?? "", quantity: l.quantity }
                          : l
                      )
                    )
                  }}
                  className={cn(inputCls, "cursor-pointer")}
                >
                  <option value="" className="bg-card">Depo seçin…</option>
                  {(warehouses ?? []).map((w) => (
                    <option key={w.id} value={w.id} className="bg-card">{w.name} ({w.code})</option>
                  ))}
                </select>
                <input
                  type="number"
                  min={0}
                  value={line.quantity}
                  onChange={(e) =>
                    setStockLines((prev) =>
                      prev.map((l, i) => (i === idx ? { ...l, quantity: e.target.value } : l))
                    )
                  }
                  className={inputCls}
                  placeholder="Adet"
                />
                <button
                  type="button"
                  className="px-2 text-white/30 hover:text-danger"
                  onClick={() => setStockLines((prev) => prev.filter((_, i) => i !== idx))}
                  disabled={stockLines.length <= 1}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </section>

        <Field label="Açıklama">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className={cn(inputCls, "h-auto py-2 resize-none")}
          />
        </Field>

        <section className="space-y-3">
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
                <div key={url} className="relative group aspect-square rounded-xl overflow-hidden border border-white/10 bg-white/[0.06]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="" className="w-full h-full object-cover" />
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
        </section>

        <Toggle checked={isActive} onChange={setIsActive} label="Ürün aktif (mağazada görünür)" />
        <Button className="w-full" onClick={submit} disabled={saving || uploading}>
          {saving ? "Kaydediliyor..." : isEdit ? "Kaydet" : "Oluştur"}
        </Button>
      </div>
    </Modal>
  )
}
