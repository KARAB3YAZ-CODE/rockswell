"use client"

import { forwardRef } from "react"
import { motion } from "framer-motion"
import { cn } from "@/lib/utils"

export interface ButtonProps {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "outline"
  size?: "sm" | "md" | "lg" | "xl"
  loading?: boolean
  icon?: React.ReactNode
  magnetic?: boolean
  disabled?: boolean
  className?: string
  children?: React.ReactNode
  onClick?: React.MouseEventHandler<HTMLButtonElement>
  type?: "button" | "submit" | "reset"
}

const variants = {
  primary: "bg-accent text-black hover:bg-accent/90 shadow-lg shadow-accent/20",
  secondary: "bg-white/5 text-white hover:bg-white/10 border border-white/10",
  ghost: "text-white/70 hover:text-white hover:bg-white/5",
  danger: "bg-danger text-white hover:bg-danger/90",
  outline: "bg-transparent text-white border border-white/20 hover:border-accent/50 hover:text-accent",
}

const sizes = {
  sm: "h-8 px-3 text-xs gap-1.5",
  md: "h-10 px-4 text-sm gap-2",
  lg: "h-12 px-6 text-base gap-2",
  xl: "h-14 px-8 text-lg gap-3",
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", loading, icon, magnetic, children, disabled, ...props }, ref) => {
    const Comp: React.ElementType = magnetic ? motion.button : "button"
    const magneticProps: Record<string, unknown> = magnetic
      ? {
          whileHover: { scale: 1.02 },
          whileTap: { scale: 0.98 },
          onMouseMove: (e: React.MouseEvent) => {
            const rect = (e.target as HTMLElement).getBoundingClientRect()
            const x = (e.clientX - rect.left - rect.width / 2) * 0.1
            const y = (e.clientY - rect.top - rect.height / 2) * 0.1
            ;(e.target as HTMLElement).style.transform = `translate(${x}px, ${y}px)`
          },
          onMouseLeave: (e: React.MouseEvent) => {
            ;(e.target as HTMLElement).style.transform = "translate(0px, 0px)"
          },
        }
      : {}

    return (
      <Comp
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          "relative inline-flex items-center justify-center font-medium rounded-xl transition-all duration-200",
          "focus:outline-none focus:ring-2 focus:ring-accent/30 focus:ring-offset-2 focus:ring-offset-background",
          "disabled:opacity-50 disabled:pointer-events-none",
          variants[variant],
          sizes[size],
          className
        )}
        {...magneticProps}
        {...(props as React.ComponentPropsWithoutRef<typeof Comp>)}
      >
        {loading ? (
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        ) : icon ? (
          <span className="shrink-0">{icon}</span>
        ) : null}
        {children}
      </Comp>
    )
  }
)
Button.displayName = "Button"
