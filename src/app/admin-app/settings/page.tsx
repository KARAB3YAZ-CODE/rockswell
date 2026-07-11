"use client"

import { useEffect, useState } from "react"
import toast from "react-hot-toast"
import { GlassCard } from "@/components/effects/glass-card"
import { Button } from "@/components/ui/button"
import { SectionHeader, Field, Toggle, inputCls } from "@/components/admin/ui"
import { useData } from "@/hooks/use-data"
import { getSiteSettings, updateSiteSettings, type SiteSettings } from "@/lib/api"
import {
  DEFAULT_DISCOUNT_RATE,
  HAVALE_EXTRA_DISCOUNT_RATE,
  TAX_RATE,
  SHIPPING_COST,
  FREE_SHIPPING_THRESHOLD,
  type VolumeDiscountTier,
} from "@/lib/pricing"
import { ADMIN_URL, SITE_URL } from "@/lib/admin-host"
import { formatPrice } from "@/lib/utils"
import { Settings, Wrench, Tag, Plus, Trash2, Unlock } from "lucide-react"

export default function AdminSettingsPage() {
  const { data, loading, refetch } = useData(() => getSiteSettings(), [])
  const [form, setForm] = useState<SiteSettings | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (data) setForm(data)
  }, [data])

  const constants = [
    { label: "Varsayılan firma iskontosu", value: `%${DEFAULT_DISCOUNT_RATE}` },
    { label: "Havale / EFT ekstra indirim", value: `%${HAVALE_EXTRA_DISCOUNT_RATE}` },
    { label: "KDV oranı", value: `%${TAX_RATE * 100}` },
    { label: "Kargo ücreti", value: formatPrice(SHIPPING_COST) },
    { label: "Ücretsiz kargo eşiği", value: formatPrice(FREE_SHIPPING_THRESHOLD) },
    { label: "Mağaza URL", value: SITE_URL },
    { label: "Admin URL", value: ADMIN_URL },
  ]

  const updateTier = (tiers: VolumeDiscountTier[]) => {
    if (!form) return
    setForm({ ...form, volumeDiscountTiers: tiers })
  }

  const save = async () => {
    if (!form) return
    setSaving(true)
    try {
      const next = await updateSiteSettings({
        maintenanceEnabled: form.maintenanceEnabled,
        maintenanceMessage: form.maintenanceMessage,
        priceUpdateEnabled: form.priceUpdateEnabled,
        priceUpdateDate: form.priceUpdateDate,
        priceUpdateMessage: form.priceUpdateMessage,
        volumeDiscountTiers: form.volumeDiscountTiers,
      })
      setForm(next)
      refetch()
      toast.success("Ayarlar kaydedildi")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Kaydedilemedi")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <SectionHeader
        icon={Settings}
        tone="warning"
        title="Sistem Ayarları"
        subtitle="Bakım modu, fiyat güncelleme, hacim iskonto kademeleri"
      />

      <GlassCard intensity="light" className="p-5 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <Wrench size={16} className="text-warning" />
          <h3 className="text-sm font-semibold text-white">Bakım Modu</h3>
        </div>
        <p className="text-xs text-white/40">
          Açıkken firmalar mağazaya giremez; bakım ekranı görür. Admin hesabı mağazayı yine açabilir.
        </p>
        {loading || !form ? (
          <p className="text-sm text-white/40">Yükleniyor…</p>
        ) : (
          <>
            <Toggle
              checked={form.maintenanceEnabled}
              onChange={(v) => setForm({ ...form, maintenanceEnabled: v })}
              label={form.maintenanceEnabled ? "Bakım açık" : "Bakım kapalı"}
            />
            <Field label="Bakım mesajı">
              <textarea
                rows={3}
                value={form.maintenanceMessage}
                onChange={(e) => setForm({ ...form, maintenanceMessage: e.target.value })}
                className={`${inputCls} h-auto py-2 resize-none`}
              />
            </Field>
          </>
        )}
      </GlassCard>

      <GlassCard intensity="light" className="p-5 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <Tag size={16} className="text-accent" />
          <h3 className="text-sm font-semibold text-white">Fiyat Güncelleme Bildirimi</h3>
        </div>
        <p className="text-xs text-white/40">
          Açıkken firma ekranında üst bantta fiyatların belirtilen tarihte güncelleneceği gösterilir.
        </p>
        {loading || !form ? (
          <p className="text-sm text-white/40">Yükleniyor…</p>
        ) : (
          <>
            <Toggle
              checked={form.priceUpdateEnabled}
              onChange={(v) => setForm({ ...form, priceUpdateEnabled: v })}
              label={form.priceUpdateEnabled ? "Bildirim açık" : "Bildirim kapalı"}
            />
            <Field label="Güncelleme tarihi">
              <input
                type="date"
                value={form.priceUpdateDate ?? ""}
                onChange={(e) => setForm({ ...form, priceUpdateDate: e.target.value || null })}
                className={inputCls}
              />
            </Field>
            <Field label="Özel mesaj (opsiyonel)">
              <textarea
                rows={2}
                value={form.priceUpdateMessage}
                onChange={(e) => setForm({ ...form, priceUpdateMessage: e.target.value })}
                placeholder="Boş bırakılırsa varsayılan metin kullanılır"
                className={`${inputCls} h-auto py-2 resize-none`}
              />
            </Field>
          </>
        )}
      </GlassCard>

      <GlassCard intensity="light" className="p-5 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Unlock size={16} className="text-accent" />
            <h3 className="text-sm font-semibold text-white">Hacim İskonto Kademeleri</h3>
          </div>
          {form && (
            <button
              type="button"
              onClick={() =>
                updateTier([
                  ...form.volumeDiscountTiers,
                  {
                    threshold: (form.volumeDiscountTiers.at(-1)?.threshold ?? 0) + 50_000,
                    bonusPercent: (form.volumeDiscountTiers.at(-1)?.bonusPercent ?? 0) + 5,
                  },
                ])
              }
              className="inline-flex items-center gap-1 text-xs text-accent hover:text-accent/80"
            >
              <Plus size={12} /> Kademe ekle
            </button>
          )}
        </div>
        <p className="text-xs text-white/40">
          Firma iskontosunun üzerine, sipariş ara toplamı eşiğe ulaşınca ekstra iskonto açılır.
          Örn: %25 firma + 50.000 TL’de +%5 → efektif %30.
        </p>
        {loading || !form ? (
          <p className="text-sm text-white/40">Yükleniyor…</p>
        ) : form.volumeDiscountTiers.length === 0 ? (
          <p className="text-sm text-white/40">Kademe yok — ekleyin veya kaydedince varsayılanlar gelir.</p>
        ) : (
          <div className="space-y-2">
            {form.volumeDiscountTiers.map((tier, i) => (
              <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-end">
                <Field label="Eşik (TL)">
                  <input
                    type="number"
                    min={0}
                    step={1000}
                    value={tier.threshold}
                    onChange={(e) => {
                      const next = [...form.volumeDiscountTiers]
                      next[i] = { ...next[i], threshold: Number(e.target.value) || 0 }
                      updateTier(next)
                    }}
                    className={inputCls}
                  />
                </Field>
                <Field label="Ekstra iskonto (%)">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={1}
                    value={tier.bonusPercent}
                    onChange={(e) => {
                      const next = [...form.volumeDiscountTiers]
                      next[i] = { ...next[i], bonusPercent: Number(e.target.value) || 0 }
                      updateTier(next)
                    }}
                    className={inputCls}
                  />
                </Field>
                <button
                  type="button"
                  onClick={() => updateTier(form.volumeDiscountTiers.filter((_, j) => j !== i))}
                  className="h-10 w-10 mb-0.5 rounded-xl flex items-center justify-center text-white/30 hover:text-danger hover:bg-danger/5"
                  aria-label="Kademeyi sil"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </GlassCard>

      {form && (
        <Button onClick={save} disabled={saving} className="w-full sm:w-auto">
          {saving ? "Kaydediliyor…" : "Ayarları Kaydet"}
        </Button>
      )}

      <GlassCard intensity="light" className="p-5 space-y-3">
        <h3 className="text-sm font-semibold text-white mb-2">Platform sabitleri</h3>
        {constants.map((r) => (
          <div key={r.label} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0 gap-3">
            <span className="text-sm text-white/50">{r.label}</span>
            <span className="text-sm font-medium text-white font-mono text-right break-all">{r.value}</span>
          </div>
        ))}
      </GlassCard>

      <p className="text-xs text-white/35">
        Firma bazlı iskonto ve kredi limiti için Şirketler sayfasını kullanın. Hacim kademeleri tüm firmalara uygulanır.
      </p>
    </div>
  )
}
