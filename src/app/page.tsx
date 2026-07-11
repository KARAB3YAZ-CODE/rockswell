"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Glow } from "@/components/effects/glow"
import { MouseGlowVariant } from "@/components/effects/mouse-glow"
import { motion } from "framer-motion"

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background overflow-hidden relative">
      <MouseGlowVariant />

      <div
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            "radial-gradient(ellipse 80% 50% at 50% -10%, rgba(57,255,20,0.18), transparent 55%), radial-gradient(ellipse 60% 40% at 100% 50%, rgba(0,180,120,0.08), transparent 50%), linear-gradient(180deg, #0a0c0a 0%, #050605 40%, #0b100c 100%)",
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />

      <motion.nav
        className="fixed top-0 left-0 right-0 z-40 bg-background/70 backdrop-blur-xl border-b border-white/5"
        initial={{ y: -24, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.55, ease: [0.25, 0.1, 0.25, 1] }}
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-accent flex items-center justify-center shadow-[0_0_24px_rgba(57,255,20,0.35)]">
              <span className="text-black font-black text-base tracking-tighter">R</span>
            </div>
            <span
              className="text-xl font-black text-white tracking-tight"
              style={{ fontFamily: "var(--font-geist-sans), ui-sans-serif, system-ui" }}
            >
              ROCKSWELL
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/login">
              <Button variant="ghost" size="sm">Giriş</Button>
            </Link>
            <Link href="/register">
              <Button size="sm">Bayi Başvurusu</Button>
            </Link>
          </div>
        </div>
      </motion.nav>

      <section className="relative min-h-screen flex flex-col justify-end sm:justify-center pb-16 sm:pb-0 pt-24">
        <Glow color="rgba(57, 255, 20," size={520} opacity={0.07} blur={110} className="top-[18%] left-1/2 -translate-x-1/2" />

        <div
          className="absolute inset-0 z-0"
          aria-hidden
          style={{
            backgroundImage:
              "linear-gradient(to top, #050605 8%, transparent 42%), url(https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?auto=format&fit=crop&w=2400&q=80)",
            backgroundSize: "cover",
            backgroundPosition: "center 35%",
          }}
        />
        <div className="absolute inset-0 z-[1] bg-gradient-to-r from-background via-background/85 to-background/40" />

        <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 w-full">
          <motion.div
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="max-w-xl"
          >
            <motion.p
              className="text-4xl sm:text-6xl lg:text-7xl font-black text-white tracking-tighter leading-[0.95] mb-5"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08, duration: 0.65 }}
            >
              ROCKSWELL
            </motion.p>
            <motion.h1
              className="text-xl sm:text-2xl font-semibold text-white/90 leading-snug"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.18, duration: 0.6 }}
            >
              Bayiler için otomotiv yedek parça sipariş platformu
            </motion.h1>
            <motion.p
              className="mt-4 text-sm sm:text-base text-white/50 max-w-md leading-relaxed"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.32, duration: 0.55 }}
            >
              Gerçek zamanlı stok, bayi fiyatı, açık hesap ve kurumsal sevkiyat — tek panelde.
            </motion.p>
            <motion.div
              className="flex flex-wrap gap-3 mt-8"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.42, duration: 0.55 }}
            >
              <Link href="/login">
                <Button size="lg">Bayi Girişi</Button>
              </Link>
              <Link href="/register">
                <Button variant="outline" size="lg">Kayıt Ol</Button>
              </Link>
            </motion.div>
          </motion.div>
        </div>
      </section>
    </div>
  )
}
