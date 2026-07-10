"use client"

import { motion } from "framer-motion"
import { Shell } from "@/components/layout/shell"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { GlassCard } from "@/components/effects/glass-card"
import { useCampaigns } from "@/hooks/use-data"
import { formatDate } from "@/lib/utils"
import { Percent } from "lucide-react"

export default function CampaignsPage() {
  const { campaigns, loading } = useCampaigns()

  return (
    <Shell>
      <div className="max-w-3xl space-y-4">
        <div>
          <h2 className="text-xl font-bold text-white">Aktif Kampanyalar</h2>
          <p className="text-sm text-white/40">Size özel fırsatlar</p>
        </div>

        {loading ? (
          <div className="grid sm:grid-cols-2 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-40 rounded-xl" />
            ))}
          </div>
        ) : campaigns.length === 0 ? (
          <div className="text-center py-12">
            <Percent size={32} className="mx-auto text-white/20 mb-3" />
            <p className="text-sm text-white/40">Şu anda aktif kampanya bulunmuyor.</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-4">
            {campaigns.map((campaign, i) => (
              <motion.div
                key={campaign.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
              >
                <GlassCard intensity="light" glow className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <Badge variant="premium" pulsing>
                      {campaign.type === "discount" ? `%${campaign.discountRate} İndirim` : campaign.type === "bundle" ? "Set Fırsatı" : "Kampanya"}
                    </Badge>
                  </div>
                  <h3 className="text-base font-semibold text-white">{campaign.name}</h3>
                  <p className="text-sm text-white/50 mt-1">{campaign.description}</p>
                  <div className="flex items-center justify-between mt-4 text-xs text-white/30">
                    <span>Son: {formatDate(campaign.endDate)}</span>
                    <span>{campaign.usedCount} kullanım</span>
                  </div>
                </GlassCard>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </Shell>
  )
}
