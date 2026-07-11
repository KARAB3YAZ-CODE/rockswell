"use client"

import { useEffect, useMemo, useState } from "react"
import toast from "react-hot-toast"
import { GlassCard } from "@/components/effects/glass-card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Field, Modal, ConfirmDialog, SectionHeader, Toggle, inputCls,
} from "@/components/admin/ui"
import { useData } from "@/hooks/use-data"
import {
  getAllHomeBanners,
  createHomeBanner,
  updateHomeBanner,
  deleteHomeBanner,
  reorderHomeBanners,
  setHomeBannerActive,
  type HomeBanner,
  type HomeBannerInput,
  type HomeBannerKind,
} from "@/lib/api"
import { cn } from "@/lib/utils"
import {
  LayoutTemplate, Plus, Pencil, Trash2, GripVertical, Eye, EyeOff,
} from "lucide-react"

const GRADIENTS = [
  { value: "from-accent/20 via-accent/5 to-transparent", label: "Yeşil" },
  { value: "from-info/20 via-info/5 to-transparent", label: "Mavi" },
  { value: "from-warning/20 via-warning/5 to-transparent", label: "Turuncu" },
  { value: "from-success/20 via-success/5 to-transparent", label: "Success" },
  { value: "from-danger/20 via-danger/5 to-transparent", label: "Kırmızı" },
]

const emptyForm = (kind: HomeBannerKind): HomeBannerInput => ({
  kind,
  title: "",
  subtitle: "",
  cta: kind === "hero" ? "İncele" : "Git",
  href: "/products",
  badge: "",
  gradient: GRADIENTS[0].value,
  imageUrl: "",
  isActive: true,
})

export default function AdminHomePage() {
  const { data, loading, refetch } = useData(() => getAllHomeBanners(), [])
  const [banners, setBanners] = useState<HomeBanner[]>([])
  const [form, setForm] = useState<{ banner: HomeBanner | null; kind: HomeBannerKind } | null>(null)
  const [del, setDel] = useState<HomeBanner | null>(null)
  const [dragId, setDragId] = useState<string | null>(null)
  const [dragKind, setDragKind] = useState<HomeBannerKind | null>(null)

  useEffect(() => {
    if (data) setBanners(data)
  }, [data])

  const heroes = useMemo(() => banners.filter((b) => b.kind === "hero"), [banners])
  const promos = useMemo(() => banners.filter((b) => b.kind === "promo"), [banners])

  const persistOrder = async (kind: HomeBannerKind, list: HomeBanner[]) => {
    const orderedIds = list.map((b) => b.id)
    setBanners((prev) => {
      const other = prev.filter((b) => b.kind !== kind)
      return [...other, ...list.map((b, i) => ({ ...b, sortOrder: i }))].sort((a, b) =>
        a.kind.localeCompare(b.kind) || a.sortOrder - b.sortOrder
      )
    })
    try {
      await reorderHomeBanners(kind, orderedIds)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Sıra kaydedilemedi")
      refetch()
    }
  }

  const onDrop = (kind: HomeBannerKind, targetId: string) => {
    if (!dragId || dragKind !== kind || dragId === targetId) {
      setDragId(null)
      setDragKind(null)
      return
    }
    const list = [...(kind === "hero" ? heroes : promos)]
    const from = list.findIndex((b) => b.id === dragId)
    const to = list.findIndex((b) => b.id === targetId)
    if (from < 0 || to < 0) return
    const [item] = list.splice(from, 1)
    list.splice(to, 0, item)
    setDragId(null)
    setDragKind(null)
    void persistOrder(kind, list)
  }

  const toggleActive = async (b: HomeBanner) => {
    try {
      await setHomeBannerActive(b.id, !b.isActive)
      setBanners((prev) => prev.map((x) => (x.id === b.id ? { ...x, isActive: !x.isActive } : x)))
      toast.success(b.isActive ? "Gizlendi" : "Yayında")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Güncellenemedi")
    }
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        icon={LayoutTemplate}
        tone="accent"
        title="Ana Sayfa Bannerları"
        subtitle="Firma ana sayfasındaki hero ve küçük banner’ları sürükleyerek sıralayın"
      />

      <p className="text-xs text-white/40 max-w-2xl">
        Hero banner’lar üst kaydırmalı alan; promo banner’lar ana sayfada 2–3’lü küçük kartlar olarak görünür.
        Kartı tutup sürükleyerek sırayı değiştirin.
      </p>

      {loading ? (
        <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-2xl" />)}</div>
      ) : (
        <>
          <BannerSection
            title="Hero banner’lar"
            kind="hero"
            items={heroes}
            dragId={dragId}
            onAdd={() => setForm({ banner: null, kind: "hero" })}
            onEdit={(b) => setForm({ banner: b, kind: b.kind })}
            onDelete={setDel}
            onToggle={toggleActive}
            onDragStart={(id) => { setDragId(id); setDragKind("hero") }}
            onDrop={(id) => onDrop("hero", id)}
          />
          <BannerSection
            title="Küçük promo banner’lar"
            kind="promo"
            items={promos}
            dragId={dragId}
            onAdd={() => setForm({ banner: null, kind: "promo" })}
            onEdit={(b) => setForm({ banner: b, kind: b.kind })}
            onDelete={setDel}
            onToggle={toggleActive}
            onDragStart={(id) => { setDragId(id); setDragKind("promo") }}
            onDrop={(id) => onDrop("promo", id)}
          />
        </>
      )}

      {form && (
        <BannerForm
          banner={form.banner}
          kind={form.kind}
          onClose={() => setForm(null)}
          onSaved={() => { setForm(null); refetch() }}
        />
      )}

      {del && (
        <ConfirmDialog
          title="Banner’ı Sil"
          message={`"${del.title}" silinecek. Devam edilsin mi?`}
          onCancel={() => setDel(null)}
          onConfirm={async () => {
            try {
              await deleteHomeBanner(del.id)
              toast.success("Silindi")
              setDel(null)
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

function BannerSection({
  title,
  kind,
  items,
  dragId,
  onAdd,
  onEdit,
  onDelete,
  onToggle,
  onDragStart,
  onDrop,
}: {
  title: string
  kind: HomeBannerKind
  items: HomeBanner[]
  dragId: string | null
  onAdd: () => void
  onEdit: (b: HomeBanner) => void
  onDelete: (b: HomeBanner) => void
  onToggle: (b: HomeBanner) => void
  onDragStart: (id: string) => void
  onDrop: (id: string) => void
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-white">{title} <span className="text-white/35 font-normal">({items.length})</span></h3>
        <Button size="sm" icon={<Plus size={14} />} onClick={onAdd}>Ekle</Button>
      </div>
      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-white/35">
          Henüz {kind === "hero" ? "hero" : "promo"} banner yok
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((b) => (
            <div
              key={b.id}
              draggable
              onDragStart={() => onDragStart(b.id)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => onDrop(b.id)}
              className={cn(dragId === b.id && "opacity-50")}
            >
              <GlassCard
                intensity="light"
                className={cn(
                  "p-3 cursor-grab active:cursor-grabbing",
                  dragId === b.id && "border-accent/40"
                )}
              >
                <div className="flex items-center gap-3">
                  <GripVertical size={16} className="text-white/25 shrink-0" />
                  <div
                    className={cn(
                      "hidden sm:block relative w-20 h-12 rounded-lg bg-gradient-to-br shrink-0 overflow-hidden",
                      b.gradient
                    )}
                    style={{ backgroundColor: "var(--card)" }}
                  >
                    {b.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={b.imageUrl} alt="" className="absolute inset-0 w-full h-full object-cover" draggable={false} />
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium text-white truncate">{b.title || "Başlıksız"}</p>
                      {b.badge && <Badge size="sm" variant="default">{b.badge}</Badge>}
                      <Badge size="sm" variant={b.isActive ? "success" : "default"}>{b.isActive ? "Yayında" : "Gizli"}</Badge>
                    </div>
                    <p className="text-xs text-white/40 truncate mt-0.5">{b.subtitle || b.href}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => onToggle(b)}
                      className="w-8 h-8 rounded-lg text-white/40 hover:text-white hover:bg-white/5 flex items-center justify-center"
                      title={b.isActive ? "Gizle" : "Yayınla"}
                    >
                      {b.isActive ? <Eye size={14} /> : <EyeOff size={14} />}
                    </button>
                    <button
                      type="button"
                      onClick={() => onEdit(b)}
                      className="w-8 h-8 rounded-lg text-white/40 hover:text-white hover:bg-white/5 flex items-center justify-center"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(b)}
                      className="w-8 h-8 rounded-lg text-danger/60 hover:text-danger hover:bg-danger/10 flex items-center justify-center"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </GlassCard>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function BannerForm({
  banner,
  kind,
  onClose,
  onSaved,
}: {
  banner: HomeBanner | null
  kind: HomeBannerKind
  onClose: () => void
  onSaved: () => void
}) {
  const isEdit = !!banner
  const [title, setTitle] = useState(banner?.title ?? "")
  const [subtitle, setSubtitle] = useState(banner?.subtitle ?? "")
  const [cta, setCta] = useState(banner?.cta ?? emptyForm(kind).cta)
  const [href, setHref] = useState(banner?.href ?? "/products")
  const [badge, setBadge] = useState(banner?.badge ?? "")
  const [gradient, setGradient] = useState(banner?.gradient ?? GRADIENTS[0].value)
  const [imageUrl, setImageUrl] = useState(banner?.imageUrl ?? "")
  const [isActive, setIsActive] = useState(banner?.isActive ?? true)
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    if (!title.trim()) { toast.error("Başlık gerekli"); return }
    setSaving(true)
    const input: HomeBannerInput = {
      kind,
      title: title.trim(),
      subtitle: subtitle.trim(),
      cta: cta.trim() || "İncele",
      href: href.trim() || "/products",
      badge: badge.trim(),
      gradient,
      imageUrl: imageUrl.trim(),
      isActive,
    }
    try {
      if (isEdit && banner) {
        await updateHomeBanner(banner.id, input)
        toast.success("Banner güncellendi")
      } else {
        await createHomeBanner(input)
        toast.success("Banner eklendi")
      }
      onSaved()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Kaydedilemedi")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      title={isEdit ? "Banner Düzenle" : kind === "hero" ? "Yeni Hero Banner" : "Yeni Promo Banner"}
      icon={LayoutTemplate}
      size="lg"
      onClose={onClose}
    >
      <div className={cn("rounded-xl h-28 bg-gradient-to-br p-4 flex flex-col justify-center mb-2", gradient)} style={{ backgroundColor: "var(--card)" }}>
        {badge && <span className="text-[10px] text-accent mb-1">{badge}</span>}
        <p className="text-sm font-bold text-white truncate">{title || "Önizleme başlık"}</p>
        <p className="text-xs text-white/50 truncate">{subtitle || "Alt metin"}</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Başlık"><input value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls} /></Field>
        <Field label="Rozet"><input value={badge} onChange={(e) => setBadge(e.target.value)} placeholder="Kampanya, Hızlı…" className={inputCls} /></Field>
        <div className="sm:col-span-2">
          <Field label="Alt metin"><input value={subtitle} onChange={(e) => setSubtitle(e.target.value)} className={inputCls} /></Field>
        </div>
        <Field label="Buton metni"><input value={cta} onChange={(e) => setCta(e.target.value)} className={inputCls} /></Field>
        <Field label="Link (href)"><input value={href} onChange={(e) => setHref(e.target.value)} placeholder="/products" className={inputCls} /></Field>
        <Field label="Renk / gradient">
          <select value={gradient} onChange={(e) => setGradient(e.target.value)} className={cn(inputCls, "cursor-pointer")}>
            {GRADIENTS.map((g) => (
              <option key={g.value} value={g.value} className="bg-card">{g.label}</option>
            ))}
          </select>
        </Field>
        <Field label="Görsel URL (opsiyonel)"><input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://…" className={inputCls} /></Field>
      </div>
      <Toggle checked={isActive} onChange={setIsActive} label="Yayında (ana sayfada görünsün)" />
      <Button className="w-full" onClick={submit} disabled={saving}>
        {saving ? "Kaydediliyor…" : isEdit ? "Kaydet" : "Oluştur"}
      </Button>
    </Modal>
  )
}
