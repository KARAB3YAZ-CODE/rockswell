"use client"

import { cn } from "@/lib/utils"

interface CardProps {
  children: React.ReactNode
  className?: string
  hover?: boolean
  glow?: boolean
  glass?: boolean
  gradient?: boolean
  onClick?: () => void
}

export function Card({ children, className, hover, glow, glass, gradient, onClick }: CardProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        "relative rounded-2xl p-6 overflow-hidden",
        glass ? "glass" : "bg-card border border-border",
        hover && "card-hover cursor-pointer",
        glow && "neon-glow",
        gradient && "gradient-border",
        className
      )}
    >
      {children}
    </div>
  )
}

export function CardHeader({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("flex items-center justify-between mb-4", className)}>{children}</div>
}

export function CardTitle({ children, className }: { children: React.ReactNode; className?: string }) {
  return <h3 className={cn("text-lg font-semibold text-white", className)}>{children}</h3>
}

export function CardContent({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("", className)}>{children}</div>
}
