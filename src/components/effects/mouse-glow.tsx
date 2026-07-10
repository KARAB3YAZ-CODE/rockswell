"use client"

import { useEffect, useRef } from "react"
import { cn } from "@/lib/utils"

interface MouseGlowProps {
  className?: string
  color?: string
  size?: number
}

export function MouseGlow({ className, color = "rgba(57, 255, 20, 0.06)", size = 400 }: MouseGlowProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (ref.current) {
        ref.current.style.transform = `translate(${e.clientX - size / 2}px, ${e.clientY - size / 2}px)`
      }
    }

    window.addEventListener("mousemove", handleMouseMove)
    return () => window.removeEventListener("mousemove", handleMouseMove)
  }, [size])

  return (
    <div
      ref={ref}
      className={cn("fixed pointer-events-none rounded-full z-50 transition-transform duration-300 ease-out", className)}
      style={{
        width: size,
        height: size,
        background: `radial-gradient(circle, ${color} 0%, transparent 70%)`,
      }}
    />
  )
}

export function MouseGlowVariant({ className }: { className?: string }) {
  return (
    <>
      <MouseGlow className="hidden lg:block" />
      <div className={cn(
        "fixed inset-0 pointer-events-none z-50",
        "bg-[radial-gradient(600px_circle_at_var(--mouse-x,_50%)_var(--mouse-y,_50%),rgba(57,255,20,0.03),transparent_40%)]",
        className
      )} />
    </>
  )
}
