"use client"

import { GlassCard } from "@/components/effects/glass-card"
import { SectionHeader } from "@/components/admin/ui"
import {
  DEFAULT_DISCOUNT_RATE,
  HAVALE_EXTRA_DISCOUNT_RATE,
  TAX_RATE,
  SHIPPING_COST,
  FREE_SHIPPING_THRESHOLD,
} from "@/lib/pricing"
import { ADMIN_URL, SITE_URL } from "@/lib/admin-host"
import { formatPrice } from "@/lib/utils"
import { Settings } from "lucide-react"

export default function AdminSettingsPage() {
  const rows = [
    { label: "Varsayılan firma iskontosu", value: `%${DEFAULT_DISCOUNT_RATE}` },
    { label: "Havale / EFT ekstra indirim", value: `%${HAVALE_EXTRA_DISCOUNT_RATE}` },
    { label: "KDV oranı", value: `%${TAX_RATE * 100}` },
    { label: "Kargo ücreti", value: formatPrice(SHIPPING_COST) },
    { label: "Ücretsiz kargo eşiği", value: formatPrice(FREE_SHIPPING_THRESHOLD) },
    { label: "Mağaza URL", value: SITE_URL },
    { label: "Admin URL", value: ADMIN_URL },
  ]

  return (
    <div className="space-y-4 max-w-2xl">
      <SectionHeader
        icon={Settings}
        tone="warning"
        title="Sistem Ayarları"
        subtitle="Platform sabitleri (firma iskontosu şirket kartından yönetilir)"
      />
      <GlassCard intensity="light" className="p-5 space-y-3">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
            <span className="text-sm text-white/50">{r.label}</span>
            <span className="text-sm font-medium text-white font-mono">{r.value}</span>
          </div>
        ))}
      </GlassCard>
      <p className="text-xs text-white/35">
        Firma bazlı iskonto ve kredi limiti için Şirketler sayfasını kullanın. Global sabitler kod/env üzerinden yönetilir.
      </p>
    </div>
  )
}
