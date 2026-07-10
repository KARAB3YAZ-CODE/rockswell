"use client"

import toast from "react-hot-toast"
import { Shell } from "@/components/layout/shell"
import {
  BarChart3, Package, Wallet, Truck,
} from "lucide-react"

export default function ReportsPage() {
  return (
    <Shell>
      <div className="max-w-3xl space-y-4">
        <div>
          <h2 className="text-xl font-bold text-white">Raporlar</h2>
          <p className="text-sm text-white/40">İşletme analitiği</p>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          {[
            { icon: BarChart3, title: "Satış Raporu", desc: "Aylık satış performansı" },
            { icon: Package, title: "Stok Raporu", desc: "Stok hareketleri" },
            { icon: Wallet, title: "Finansal Rapor", desc: "Cari hesap özeti" },
            { icon: Truck, title: "Lojistik Raporu", desc: "Sevkiyat takibi" },
          ].map((report) => {
            const Icon = report.icon
            return (
              <button
                key={report.title}
                onClick={() => toast.success(`${report.title} yakında`)}
                className="text-left rounded-2xl p-4 bg-card border border-border hover:bg-white/[0.06] transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-accent/10 text-accent flex items-center justify-center">
                    <Icon size={18} />
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-white">{report.title}</h3>
                    <p className="text-xs text-white/40">{report.desc}</p>
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </Shell>
  )
}
