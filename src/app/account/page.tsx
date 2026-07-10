"use client"

import Link from "next/link"
import { Shell } from "@/components/layout/shell"
import { Badge } from "@/components/ui/badge"
import { GlassCard } from "@/components/effects/glass-card"
import { Skeleton } from "@/components/ui/skeleton"
import { useAuth } from "@/lib/auth"
import {
  User, Building2, FileText, Package,
  ChevronRight, MapPin, Phone, Mail, Key,
} from "lucide-react"

export default function AccountOverviewPage() {
  const { user, company, loading } = useAuth()

  if (loading) {
    return (
      <Shell>
        <div className="space-y-6 max-w-3xl">
          <Skeleton className="h-24 w-full rounded-xl" />
          <div className="grid sm:grid-cols-2 gap-4">
            <Skeleton className="h-40 rounded-xl" />
            <Skeleton className="h-40 rounded-xl" />
          </div>
        </div>
      </Shell>
    )
  }

  if (!user || !company) {
    return (
      <Shell>
        <div className="text-center py-12 text-white/40">
          <p>Veri bulunamadı.</p>
        </div>
      </Shell>
    )
  }

  return (
    <Shell>
      <div className="max-w-3xl space-y-6">
        <div>
          <h2 className="text-xl font-bold text-white">Genel Bakış</h2>
          <p className="text-sm text-white/40">Hesap bilgileriniz ve özet</p>
        </div>

        <GlassCard intensity="medium" className="p-5">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-accent/20 text-accent flex items-center justify-center text-xl font-bold">
              {user.name[0]}{user.surname[0]}
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">{user.name} {user.surname}</h3>
              <p className="text-sm text-white/50">{user.email}</p>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="info" size="sm">Satın Alma Yöneticisi</Badge>
                <Badge variant="success" size="sm">Aktif</Badge>
              </div>
            </div>
          </div>
        </GlassCard>

        <div className="grid sm:grid-cols-2 gap-4">
          <GlassCard intensity="light" className="p-4">
            <h4 className="text-xs font-medium text-white/40 uppercase tracking-wider mb-3">Şirket Bilgileri</h4>
            <div className="space-y-2">
              {[
                { icon: Building2, label: "Şirket", value: company.name },
                { icon: FileText, label: "Vergi No", value: company.taxNumber },
                { icon: MapPin, label: "Adres", value: `${company.address.street}, ${company.address.district}` },
                { icon: Phone, label: "Telefon", value: company.phone },
                { icon: Mail, label: "E-posta", value: company.email },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-2.5">
                  <item.icon size={14} className="text-white/30 shrink-0" />
                  <span className="text-xs text-white/40">{item.label}:</span>
                  <span className="text-xs text-white/70">{item.value}</span>
                </div>
              ))}
            </div>
          </GlassCard>

          <GlassCard intensity="light" className="p-4">
            <h4 className="text-xs font-medium text-white/40 uppercase tracking-wider mb-3">Hızlı İşlemler</h4>
            <div className="space-y-2">
              {[
                { icon: Package, label: "Yeni Sipariş", href: "/products" },
                { icon: FileText, label: "Faturalar", href: "/account/invoices" },
                { icon: Key, label: "Ayarlar", href: "/account/settings" },
              ].map((item) => {
                const Icon = item.icon
                return (
                  <Link
                    key={item.label}
                    href={item.href}
                    className="flex items-center gap-2.5 w-full px-2 py-2 rounded-lg hover:bg-white/5 transition-colors"
                  >
                    <Icon size={14} className="text-accent shrink-0" />
                    <span className="text-sm text-white/70">{item.label}</span>
                    <ChevronRight size={12} className="ml-auto text-white/20" />
                  </Link>
                )
              })}
            </div>
          </GlassCard>
        </div>
      </div>
    </Shell>
  )
}
