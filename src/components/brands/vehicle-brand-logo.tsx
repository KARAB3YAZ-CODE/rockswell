"use client"

import { useState } from "react"
import { BrandLogo } from "./brand-logos"

const CDN = "https://cdn.jsdelivr.net/gh/filippofilip95/car-logos-dataset@master/logos/optimized"

// Maps catalog vehicle brand names to car-logos-dataset slugs.
const slugAliases: Record<string, string> = {
  MERCEDES: "mercedes-benz",
  "MERCEDES-BENZ": "mercedes-benz",
  MERCEDESBENZ: "mercedes-benz",
  VW: "volkswagen",
  "LAND ROVER": "land-rover",
  LANDROVER: "land-rover",
  "ALFA ROMEO": "alfa-romeo",
  ALFAROMEO: "alfa-romeo",
  CITROEN: "citroen",
  "CITROËN": "citroen",
  SKODA: "skoda",
  "ŠKODA": "skoda",
  TOFAS: "tofas",
  "TOFAŞ": "tofas",
}

function brandToSlug(brand: string): string {
  const upper = brand.trim().toUpperCase()
  if (slugAliases[upper]) return slugAliases[upper]
  return brand
    .trim()
    .toLowerCase()
    .replace(/ş/g, "s")
    .replace(/ç/g, "c")
    .replace(/ö/g, "o")
    .replace(/ü/g, "u")
    .replace(/ı/g, "i")
    .replace(/ğ/g, "g")
    .replace(/[\s/]+/g, "-")
}

/**
 * Renders the real vehicle brand logo on a light chip so colored/dark logos
 * stay visible on the dark theme. Falls back to the hand-drawn SVG on error.
 */
export function VehicleBrandLogo({
  brand,
  size = 48,
  className = "",
}: {
  brand: string
  size?: number
  className?: string
}) {
  const [failed, setFailed] = useState(false)
  const slug = brandToSlug(brand)

  if (failed) {
    return (
      <div
        className={`flex items-center justify-center rounded-xl bg-white/90 ${className}`}
        style={{ width: size, height: size }}
      >
        <BrandLogo brand={brand} className="w-3/4 h-3/4 text-black/70" />
      </div>
    )
  }

  return (
    <div
      className={`flex items-center justify-center rounded-xl bg-white/95 p-1.5 shrink-0 ${className}`}
      style={{ width: size, height: size }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`${CDN}/${slug}.png`}
        alt={`${brand} logo`}
        loading="lazy"
        onError={() => setFailed(true)}
        className="w-full h-full object-contain"
      />
    </div>
  )
}
