"use client"

import Link from "next/link"
import { Shell } from "@/components/layout/shell"
import { GlassCard } from "@/components/effects/glass-card"
import { Button } from "@/components/ui/button"
import {
  HelpCircle, MessageSquare, Package, FileText, CreditCard, Search, ChevronRight,
} from "lucide-react"

const topics = [
  {
    icon: Package,
    title: "Sipariş nasıl verilir?",
    body: "Ürünleri sepete ekleyin, Havale veya Online ödeme seçin. Havale siparişleri yönetici onayına gider; online ödemede PayTR ile peşin tahsil edilir.",
  },
  {
    icon: CreditCard,
    title: "Kredi / açık hesap",
    body: "Firmanızın kredi limiti admin tarafından tanımlanır. Havale siparişleri limitten düşülür; online ödeme limiti kullanmaz. Limit aşımında havale engellenir.",
  },
  {
    icon: FileText,
    title: "Faturalar",
    body: "Onaylanan siparişlerde fatura oluşur. Faturalar menüsünden görüntüleyip PDF/Yazdır alabilirsiniz.",
  },
  {
    icon: Search,
    title: "OEM / VIN arama",
    body: "Üst arama kutusuna OEM numarası veya 17 haneli VIN yazarak uyumlu parçaları bulabilirsiniz.",
  },
]

export default function HelpPage() {
  return (
    <Shell>
      <div className="max-w-3xl space-y-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <HelpCircle size={20} className="text-accent" />
            <h2 className="text-xl font-bold text-white">Yardım Merkezi</h2>
          </div>
          <p className="text-sm text-white/40">Sık sorulan konular ve hızlı bağlantılar</p>
        </div>

        <div className="grid gap-3">
          {topics.map((t) => {
            const Icon = t.icon
            return (
              <GlassCard key={t.title} intensity="light" className="p-4">
                <div className="flex gap-3">
                  <div className="w-9 h-9 rounded-xl bg-accent/10 text-accent flex items-center justify-center shrink-0">
                    <Icon size={16} />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-white">{t.title}</h3>
                    <p className="text-xs text-white/50 mt-1 leading-relaxed">{t.body}</p>
                  </div>
                </div>
              </GlassCard>
            )
          })}
        </div>

        <GlassCard intensity="medium" className="p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <MessageSquare size={20} className="text-accent" />
            <div>
              <p className="text-sm font-medium text-white">Sorunuz çözülmedi mi?</p>
              <p className="text-xs text-white/40">Destek talebi oluşturun, ekibimiz dönüş yapsın.</p>
            </div>
          </div>
          <Link href="/account/support">
            <Button size="sm" icon={<ChevronRight size={14} />}>Destek Talebi</Button>
          </Link>
        </GlassCard>
      </div>
    </Shell>
  )
}
