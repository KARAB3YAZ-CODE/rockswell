"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Glow } from "@/components/effects/glow"
import { MouseGlowVariant } from "@/components/effects/mouse-glow"
import { motion } from "framer-motion"

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background overflow-hidden">
      <MouseGlowVariant />

      {/* Navbar */}
      <motion.nav
        className="fixed top-0 left-0 right-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border"
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.6, ease: [0.25, 0.1, 0.25, 1] }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center">
                <span className="text-black font-bold text-lg">R</span>
              </div>
              <span className="text-lg font-bold text-white tracking-tight">ROCKSWELL</span>
            </div>

            <div className="flex items-center gap-3">
              <Link href="/login">
                <Button variant="ghost" size="sm">Giriş Yap</Button>
              </Link>
              <Link href="/register">
                <Button size="sm">Ücretsiz Kayıt</Button>
              </Link>
            </div>
          </div>
        </div>
      </motion.nav>

      {/* Hero */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
        <Glow color="rgba(57, 255, 20," size={600} opacity={0.05} blur={120} className="top-1/4 -left-48" />
        <Glow color="rgba(0, 229, 255," size={500} opacity={0.03} blur={100} className="bottom-1/4 -right-48" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(57,255,20,0.03)_0%,transparent_60%)]" />

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center pt-32">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.25, 0.1, 0.25, 1] }}
          >
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent/10 border border-accent/20 text-accent text-xs font-medium mb-6">
              Türkiye&apos;nin En Gelişmiş B2B Platformu
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white leading-tight tracking-tight">
              Profesyonel Otomotiv
              <span className="text-gradient block mt-2">Yedek Parça Dağıtım Platformu</span>
            </h1>

            <p className="mt-6 text-lg text-white/50 leading-relaxed max-w-xl mx-auto">
              Türkiye&apos;nin en kapsamlı B2B otomotiv yedek parça platformu. Bayi fiyatları, gerçek zamanlı stok ve kurumsal lojistik ile işinizi büyütün.
            </p>

            <div className="flex flex-wrap justify-center gap-3 mt-10">
              <Link href="/login">
                <Button size="xl" magnetic>
                  Giriş Yap
                </Button>
              </Link>
              <Link href="/register">
                <Button variant="outline" size="xl">
                  Ücretsiz Kayıt
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  )
}
