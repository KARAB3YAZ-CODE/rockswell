"use client"

import { motion } from "framer-motion"
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
  const Comp = motion.div
  return (
    <Comp
      onClick={onClick}
      className={cn(
        "relative rounded-2xl p-6 overflow-hidden",
        glass ? "glass" : "bg-card border border-border",
        hover && "card-hover cursor-pointer",
        glow && "neon-glow",
        gradient && "gradient-border",
        className
      )}
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }}
    >
      {children}
    </Comp>
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
