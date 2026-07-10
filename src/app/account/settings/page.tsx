"use client"

import toast from "react-hot-toast"
import { Shell } from "@/components/layout/shell"
import { GlassCard } from "@/components/effects/glass-card"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/lib/auth"
import {
  Key, Smartphone, Shield, ChevronRight,
} from "lucide-react"

export default function SettingsPage() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <Shell>
        <div className="max-w-3xl space-y-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-60 w-full rounded-xl" />
          <Skeleton className="h-40 w-full rounded-xl" />
        </div>
      </Shell>
    )
  }

  if (!user) {
    return (
      <Shell>
        <div className="space-y-6">
          <h2 className="text-xl font-bold text-white">Ayarlar</h2>
          <p className="text-sm text-white/40">Veri bulunamadı.</p>
        </div>
      </Shell>
    )
  }

  return (
    <Shell>
      <div className="max-w-3xl space-y-6">
        <div>
          <h2 className="text-xl font-bold text-white">Ayarlar</h2>
          <p className="text-sm text-white/40">Hesap ve güvenlik ayarları</p>
        </div>

        <GlassCard intensity="light" className="p-5 space-y-4">
          <h3 className="text-sm font-semibold text-white">Profil Bilgileri</h3>
          <div className="grid sm:grid-cols-2 gap-4">
            {[
              { label: "Ad", value: user.name },
              { label: "Soyad", value: user.surname },
              { label: "E-posta", value: user.email },
              { label: "Telefon", value: user.phone },
            ].map((field) => (
              <div key={field.label}>
                <label className="text-xs text-white/40">{field.label}</label>
                <p className="text-sm text-white mt-0.5">{field.value}</p>
              </div>
            ))}
          </div>
          <Button variant="secondary" size="sm" onClick={() => toast.success("Profil düzenleme sayfası yakında")}>Bilgileri Düzenle</Button>
        </GlassCard>

        <GlassCard intensity="light" className="p-5 space-y-4">
          <h3 className="text-sm font-semibold text-white">Güvenlik</h3>
          <div className="space-y-3">
            {[
              { icon: Key, label: "Şifre Değiştir", desc: "Hesap şifrenizi güncelleyin" },
              { icon: Smartphone, label: "İki Faktörlü Doğrulama", desc: "Hesap güvenliğini artırın", badge: "Önerilen" },
              { icon: Shield, label: "API Anahtarları", desc: "API entegrasyon anahtarlarınız" },
            ].map((item) => {
              const Icon = item.icon
              return (
                <button
                  key={item.label}
                  onClick={() => toast.success(`${item.label} sayfası yakında`)}
                  className="flex items-center justify-between w-full p-3 rounded-xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Icon size={16} className="text-white/30" />
                    <div className="text-left">
                      <p className="text-sm text-white/70">{item.label}</p>
                      <p className="text-xs text-white/40">{item.desc}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {item.badge && <Badge variant="premium" size="sm">{item.badge}</Badge>}
                    <ChevronRight size={14} className="text-white/20" />
                  </div>
                </button>
              )
            })}
          </div>
        </GlassCard>
      </div>
    </Shell>
  )
}
