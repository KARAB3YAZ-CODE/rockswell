"use client"

import toast from "react-hot-toast"
import { Shell } from "@/components/layout/shell"
import { GlassCard } from "@/components/effects/glass-card"
import { Button } from "@/components/ui/button"
import { MessageSquare } from "lucide-react"

export default function SupportPage() {
  return (
    <Shell>
      <div className="max-w-3xl space-y-4">
        <div>
          <h2 className="text-xl font-bold text-white">Destek</h2>
          <p className="text-sm text-white/40">Size nasıl yardımcı olabiliriz?</p>
        </div>

        <GlassCard intensity="light" className="p-6 text-center">
          <MessageSquare size={40} className="mx-auto text-white/20 mb-3" />
          <p className="text-white/60 mb-4">7/24 canlı destek ekibimize ulaşın</p>
          <Button onClick={() => toast.success("Destek talebiniz oluşturuldu. En kısa sürede dönüş yapılacaktır.")}>
            Destek Talebi Oluştur
          </Button>
        </GlassCard>
      </div>
    </Shell>
  )
}
