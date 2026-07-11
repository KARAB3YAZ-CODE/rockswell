"use client"

import { useMemo, useState } from "react"
import toast from "react-hot-toast"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { GlassCard } from "@/components/effects/glass-card"
import { Skeleton } from "@/components/ui/skeleton"
import { useData } from "@/hooks/use-data"
import {
  getAllCompanies,
  getAllProductsAdmin,
  listCompanyPrices,
  upsertCompanyPrice,
  deleteCompanyPrice,
  importCompanyPricesCsv,
} from "@/lib/api"
import { formatPrice, cn } from "@/lib/utils"
import { SectionHeader, inputCls, Field, Modal, ConfirmDialog } from "@/components/admin/ui"
import { Tag, Plus, Trash2, Upload, Search } from "lucide-react"

export default function AdminPricesPage() {
  const { data: companies, loading: companiesLoading } = useData(() => getAllCompanies(), [])
  const { data: products } = useData(() => getAllProductsAdmin(), [])
  const [companyId, setCompanyId] = useState("")
  const { data: prices, loading, refetch } = useData(
    () => (companyId ? listCompanyPrices(companyId) : Promise.resolve([])),
    [companyId]
  )
  const [search, setSearch] = useState("")
  const [addOpen, setAddOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [delId, setDelId] = useState<string | null>(null)
  const [sku, setSku] = useState("")
  const [price, setPrice] = useState("")
  const [discount, setDiscount] = useState("0")
  const [csvText, setCsvText] = useState("")
  const [saving, setSaving] = useState(false)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return prices ?? []
    return (prices ?? []).filter(
      (p) =>
        p.sku.toLowerCase().includes(q) ||
        p.productName.toLowerCase().includes(q)
    )
  }, [prices, search])

  const productBySku = useMemo(() => {
    const map = new Map<string, string>()
    for (const p of products ?? []) map.set(p.sku.toLowerCase(), p.id)
    return map
  }, [products])

  const submitAdd = async () => {
    if (!companyId) { toast.error("Firma seçin"); return }
    const productId = productBySku.get(sku.trim().toLowerCase())
    if (!productId) { toast.error("SKU bulunamadı"); return }
    const dealerPrice = Number(price.replace(",", "."))
    if (!Number.isFinite(dealerPrice) || dealerPrice < 0) { toast.error("Geçersiz fiyat"); return }
    setSaving(true)
    try {
      await upsertCompanyPrice({
        companyId,
        productId,
        dealerPrice,
        contractPrice: dealerPrice,
        netPrice: dealerPrice,
        listPrice: dealerPrice,
        discountRate: Number(discount.replace(",", ".")) || 0,
      })
      toast.success("Fiyat kaydedildi")
      setAddOpen(false)
      setSku("")
      setPrice("")
      setDiscount("0")
      refetch()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Kaydedilemedi")
    } finally {
      setSaving(false)
    }
  }

  const submitImport = async () => {
    if (!companyId) { toast.error("Firma seçin"); return }
    if (!csvText.trim()) { toast.error("CSV boş"); return }
    setSaving(true)
    try {
      const result = await importCompanyPricesCsv(companyId, csvText)
      toast.success(`${result.upserted} satır içe aktarıldı${result.skipped.length ? ` · ${result.skipped.length} atlandı` : ""}`)
      setImportOpen(false)
      setCsvText("")
      refetch()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "İçe aktarma başarısız")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <SectionHeader
        icon={Tag}
        tone="accent"
        title="Sözleşmeli Fiyatlar"
        subtitle="Firma bazlı özel fiyat listesi"
        action={
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" icon={<Upload size={14} />} disabled={!companyId} onClick={() => setImportOpen(true)}>
              CSV İçe Aktar
            </Button>
            <Button size="sm" icon={<Plus size={14} />} disabled={!companyId} onClick={() => setAddOpen(true)}>
              Fiyat Ekle
            </Button>
          </div>
        }
      />

      <div className="rounded-2xl border border-border bg-card/60 p-3 flex flex-col sm:flex-row gap-2">
        <select
          value={companyId}
          onChange={(e) => setCompanyId(e.target.value)}
          className={cn(inputCls, "sm:w-72 cursor-pointer")}
          disabled={companiesLoading}
        >
          <option value="" className="bg-card">Firma seçin…</option>
          {(companies ?? []).map((c) => (
            <option key={c.id} value={c.id} className="bg-card">
              {c.name}{!c.isActive ? " (pasif)" : ""}
            </option>
          ))}
        </select>
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="SKU veya ürün adı ara…"
            className={cn(inputCls, "pl-9")}
            disabled={!companyId}
          />
        </div>
      </div>

      {!companyId ? (
        <div className="text-center py-16 rounded-2xl border border-border bg-card/40">
          <Tag size={32} className="mx-auto text-white/20 mb-3" />
          <p className="text-sm text-white/40">Fiyat listesini görmek için firma seçin</p>
        </div>
      ) : loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 rounded-2xl border border-border bg-card/40">
          <p className="text-sm text-white/40 mb-3">Bu firmaya özel fiyat yok</p>
          <Button size="sm" icon={<Plus size={14} />} onClick={() => setAddOpen(true)}>İlk fiyatı ekle</Button>
        </div>
      ) : (
        <GlassCard intensity="light" className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5 text-left text-xs text-white/40">
                  <th className="px-4 py-3 font-medium">SKU</th>
                  <th className="px-4 py-3 font-medium">Ürün</th>
                  <th className="px-4 py-3 font-medium text-right">Sözleşme</th>
                  <th className="px-4 py-3 font-medium text-right">Net</th>
                  <th className="px-4 py-3 font-medium text-right">İskonto</th>
                  <th className="px-4 py-3 font-medium" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => (
                  <tr key={row.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                    <td className="px-4 py-3 font-mono text-xs text-accent">{row.sku}</td>
                    <td className="px-4 py-3 text-white/80">{row.productName}</td>
                    <td className="px-4 py-3 text-right text-white/70">
                      {formatPrice(row.contractPrice ?? row.dealerPrice)}
                    </td>
                    <td className="px-4 py-3 text-right text-white/70">
                      {formatPrice(row.netPrice ?? row.dealerPrice)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {row.discountRate > 0 ? (
                        <Badge size="sm" variant="premium">%{row.discountRate}</Badge>
                      ) : (
                        <span className="text-white/30">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => setDelId(row.id)}
                        className="p-1.5 rounded-lg text-white/30 hover:text-danger hover:bg-danger/10"
                        aria-label="Sil"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </GlassCard>
      )}

      {addOpen && (
        <Modal title="Sözleşmeli Fiyat Ekle" icon={Tag} onClose={() => setAddOpen(false)}>
          <Field label="SKU">
            <input value={sku} onChange={(e) => setSku(e.target.value)} className={inputCls} placeholder="Ürün SKU" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Fiyat (₺)">
              <input type="number" min={0} step={0.01} value={price} onChange={(e) => setPrice(e.target.value)} className={inputCls} />
            </Field>
            <Field label="İskonto (%)">
              <input type="number" min={0} max={100} step={0.5} value={discount} onChange={(e) => setDiscount(e.target.value)} className={inputCls} />
            </Field>
          </div>
          <Button className="w-full" onClick={submitAdd} disabled={saving}>
            {saving ? "Kaydediliyor…" : "Kaydet"}
          </Button>
        </Modal>
      )}

      {importOpen && (
        <Modal title="CSV İçe Aktar" icon={Upload} size="lg" onClose={() => setImportOpen(false)}>
          <p className="text-xs text-white/40 mb-2">
            Format: <code className="text-accent">sku;fiyat;iskonto</code> — başlık satırı isteğe bağlı
          </p>
          <textarea
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
            rows={10}
            className={cn(inputCls, "font-mono text-xs")}
            placeholder={"sku;fiyat;iskonto\nABC-123;450.00;5"}
          />
          <Button className="w-full mt-3" onClick={submitImport} disabled={saving}>
            {saving ? "Aktarılıyor…" : "İçe Aktar"}
          </Button>
        </Modal>
      )}

      {delId && (
        <ConfirmDialog
          title="Fiyatı Sil"
          message="Bu sözleşmeli fiyat satırı silinecek. Devam edilsin mi?"
          onCancel={() => setDelId(null)}
          onConfirm={async () => {
            try {
              await deleteCompanyPrice(delId)
              toast.success("Silindi")
              setDelId(null)
              refetch()
            } catch (e) {
              toast.error(e instanceof Error ? e.message : "Silinemedi")
            }
          }}
        />
      )}
    </div>
  )
}
