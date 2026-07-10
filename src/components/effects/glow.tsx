"use client"

import { cn } from "@/lib/utils"

interface GlowProps {
  className?: string
  color?: string
  size?: number
  opacity?: number
  blur?: number
}

export function Glow({
  className,
  color = "rgba(57, 255, 20,",
  size = 300,
  opacity = 0.08,
  blur = 80,
}: GlowProps) {
  return (
    <div
      className={cn("absolute pointer-events-none rounded-full", className)}
      style={{
        width: size,
        height: size,
        background: `radial-gradient(circle, ${color}${opacity}) 0%, ${color}0) 70%)`,
        filter: `blur(${blur}px)`,
      }}
    />
  )
}

export function GradientGlow({ className }: { className?: string }) {
  return (
    <div
      className={cn("absolute pointer-events-none", className)}
      style={{
        width: "100%",
        height: "100%",
        background:
          "radial-gradient(ellipse at 50% 0%, rgba(57, 255, 20, 0.06) 0%, transparent 60%), radial-gradient(ellipse at 80% 20%, rgba(0, 229, 255, 0.04) 0%, transparent 50%), radial-gradient(ellipse at 20% 80%, rgba(57, 255, 20, 0.03) 0%, transparent 50%)",
        pointerEvents: "none",
      }}
    />
  )
}
