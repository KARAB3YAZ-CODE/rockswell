"use client"

import { useRef } from "react"
import { cn } from "@/lib/utils"

interface GlassCardProps {
  children: React.ReactNode
  className?: string
  intensity?: "light" | "medium" | "strong"
  glow?: boolean
  tilt?: boolean
  borderGradient?: boolean
  noise?: boolean
}

export function GlassCard({
  children,
  className,
  intensity = "medium",
  glow,
  tilt,
  borderGradient,
  noise,
}: GlassCardProps) {
  const cardRef = useRef<HTMLDivElement>(null)

  const glassStyles = {
    light: "bg-white/[0.02] backdrop-blur-[12px] border border-white/[0.05]",
    medium: "bg-white/[0.04] backdrop-blur-[20px] border border-white/[0.08]",
    strong: "bg-white/[0.06] backdrop-blur-[32px] border border-white/[0.12]",
  }

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!tilt || !cardRef.current) return
    const rect = cardRef.current.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width - 0.5
    const y = (e.clientY - rect.top) / rect.height - 0.5
    cardRef.current.style.transform = `perspective(1000px) rotateY(${x * 5}deg) rotateX(${-y * 5}deg)`
  }

  const handleMouseLeave = () => {
    if (!cardRef.current) return
    cardRef.current.style.transform = "perspective(1000px) rotateY(0deg) rotateX(0deg)"
  }

  return (
    <div
      ref={cardRef}
      onMouseMove={tilt ? handleMouseMove : undefined}
      onMouseLeave={tilt ? handleMouseLeave : undefined}
      className={cn(
        "relative rounded-2xl p-6",
        glassStyles[intensity],
        glow && "shadow-lg shadow-accent/5 hover:shadow-xl hover:shadow-accent/10",
        borderGradient && "gradient-border",
        className
      )}
    >
      {noise && (
        <div
          className="absolute inset-0 opacity-[0.03] pointer-events-none rounded-2xl"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
          }}
        />
      )}
      {children}
    </div>
  )
}
