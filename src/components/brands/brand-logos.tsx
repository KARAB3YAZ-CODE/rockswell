import type { SVGProps } from "react"

type LogoComponent = (props: SVGProps<SVGSVGElement>) => React.ReactElement

const fallback: LogoComponent = (props) => (
  <svg viewBox="0 0 40 40" fill="none" {...props}>
    <rect x="5" y="5" width="30" height="30" rx="6" stroke="currentColor" strokeWidth="1.5" />
  </svg>
)

const logos: Record<string, LogoComponent> = {
  BMW: (props) => (
    <svg viewBox="0 0 40 40" fill="none" {...props}>
      <circle cx="20" cy="20" r="17" stroke="currentColor" strokeWidth="2" />
      <circle cx="20" cy="20" r="12" stroke="currentColor" strokeWidth="1" />
      <path d="M20 8 A12 12 0 0 1 32 20 L20 20 Z" fill="currentColor" fillOpacity="0.3" />
      <path d="M20 8 A12 12 0 0 0 8 20 L20 20 Z" fill="currentColor" fillOpacity="0.06" />
      <path d="M20 32 A12 12 0 0 1 8 20 L20 20 Z" fill="currentColor" fillOpacity="0.3" />
      <path d="M20 32 A12 12 0 0 0 32 20 L20 20 Z" fill="currentColor" fillOpacity="0.06" />
    </svg>
  ),
  MERCEDES: (props) => (
    <svg viewBox="0 0 40 40" fill="none" {...props}>
      <circle cx="20" cy="20" r="16" stroke="currentColor" strokeWidth="2" />
      <path d="M20 6L25 22H15Z" fill="currentColor" fillOpacity="0.25" />
      <path d="M20 34L15 22H25Z" fill="currentColor" fillOpacity="0.08" />
      <path d="M8 13L22 19L8 27Z" fill="currentColor" fillOpacity="0.08" />
      <path d="M32 13L18 19L32 27Z" fill="currentColor" fillOpacity="0.25" />
    </svg>
  ),
  AUDI: (props) => (
    <svg viewBox="0 0 40 40" fill="none" {...props}>
      <circle cx="8" cy="20" r="7" stroke="currentColor" strokeWidth="2" />
      <circle cx="17" cy="20" r="7" stroke="currentColor" strokeWidth="2" />
      <circle cx="26" cy="20" r="7" stroke="currentColor" strokeWidth="2" />
      <circle cx="35" cy="20" r="7" stroke="currentColor" strokeWidth="2" />
    </svg>
  ),
  VOLKSWAGEN: (props) => (
    <svg viewBox="0 0 40 40" fill="none" {...props}>
      <circle cx="20" cy="20" r="17" stroke="currentColor" strokeWidth="2" />
      <path d="M13 29l7-20 7 20" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="currentColor" fillOpacity="0.08" />
      <path d="M20 9l-7 20M20 9l7 20" stroke="currentColor" strokeWidth="1.2" strokeOpacity="0.3" />
    </svg>
  ),
  RENAULT: (props) => (
    <svg viewBox="0 0 40 40" fill="none" {...props}>
      <path d="M20 2L37 36H3Z" stroke="currentColor" strokeWidth="2" fill="currentColor" fillOpacity="0.08" />
      <path d="M20 9L30 33H10Z" fill="currentColor" fillOpacity="0.25" />
      <path d="M20 17L25 29H15Z" fill="currentColor" fillOpacity="0.15" />
    </svg>
  ),
  FIAT: (props) => (
    <svg viewBox="0 0 40 40" fill="none" {...props}>
      <rect x="6" y="10" width="28" height="20" rx="5" stroke="currentColor" strokeWidth="2" fill="currentColor" fillOpacity="0.04" />
      <path d="M10 16h20M10 20h20M10 24h20" stroke="currentColor" strokeWidth="0.8" strokeOpacity="0.25" />
    </svg>
  ),
  PEUGEOT: (props) => (
    <svg viewBox="0 0 40 40" fill="none" {...props}>
      <rect x="5" y="5" width="30" height="30" rx="7" stroke="currentColor" strokeWidth="2" fill="currentColor" fillOpacity="0.04" />
      <path d="M13 12c0-3 5-3 6 0s0 4-2 4-2 2 0 3 3 0 3 3c0 3-5 3-6 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="15" cy="13" r="1" fill="currentColor" fillOpacity="0.4" />
    </svg>
  ),
  CITROEN: (props) => (
    <svg viewBox="0 0 40 40" fill="none" {...props}>
      <path d="M4 25L12 12L20 25L28 12L36 25" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" />
      <path d="M4 30L12 17L20 30L28 17L36 30" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeOpacity="0.3" />
    </svg>
  ),
  FORD: (props) => (
    <svg viewBox="0 0 40 40" fill="none" {...props}>
      <rect x="4" y="11" width="32" height="18" rx="9" stroke="currentColor" strokeWidth="2" fill="currentColor" fillOpacity="0.04" />
      <path d="M12 17q4-4 10 0t0 10" stroke="currentColor" strokeWidth="1.2" strokeOpacity="0.4" fill="currentColor" fillOpacity="0.06" />
    </svg>
  ),
  OPEL: (props) => (
    <svg viewBox="0 0 40 40" fill="none" {...props}>
      <circle cx="20" cy="20" r="15" stroke="currentColor" strokeWidth="2" />
      <path d="M20 8L11 23h7l-3 12 12-16h-6l4-11h-5z" fill="currentColor" fillOpacity="0.3" />
    </svg>
  ),
  SEAT: (props) => (
    <svg viewBox="0 0 40 40" fill="none" {...props}>
      <circle cx="20" cy="20" r="16" stroke="currentColor" strokeWidth="2" />
      <path d="M13 14L27 14 20 28Z" fill="currentColor" fillOpacity="0.2" />
      <path d="M15.5 16.5L24.5 16.5 20 24Z" fill="currentColor" fillOpacity="0.15" />
      <path d="M18 19L22 19 20 22Z" fill="currentColor" fillOpacity="0.25" />
    </svg>
  ),
  SKODA: (props) => (
    <svg viewBox="0 0 40 40" fill="none" {...props}>
      <circle cx="20" cy="19" r="15" stroke="currentColor" strokeWidth="2" />
      <path d="M15 22L20 10l5 12H15z" fill="currentColor" fillOpacity="0.2" />
      <path d="M20 10v18" stroke="currentColor" strokeWidth="2" strokeOpacity="0.3" />
      <circle cx="20" cy="11" r="2" fill="currentColor" fillOpacity="0.5" />
    </svg>
  ),
  DACIA: (props) => (
    <svg viewBox="0 0 40 40" fill="none" {...props}>
      <rect x="5" y="10" width="30" height="20" rx="5" stroke="currentColor" strokeWidth="2" fill="currentColor" fillOpacity="0.04" />
      <path d="M16 14l-4 12M28 14l-4 12" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <path d="M16 20h8" stroke="currentColor" strokeWidth="1" strokeOpacity="0.3" />
    </svg>
  ),
  HYUNDAI: (props) => (
    <svg viewBox="0 0 40 40" fill="none" {...props}>
      <ellipse cx="20" cy="20" rx="17" ry="12" stroke="currentColor" strokeWidth="2" fill="currentColor" fillOpacity="0.04" />
      <path d="M11 16l5 10L20 13l4 13 5-10" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  HONDA: (props) => (
    <svg viewBox="0 0 40 40" fill="none" {...props}>
      <ellipse cx="20" cy="20" rx="16" ry="12" stroke="currentColor" strokeWidth="2" fill="currentColor" fillOpacity="0.04" />
      <rect x="12" y="14" width="6" height="12" rx="1.5" fill="currentColor" fillOpacity="0.25" />
      <rect x="22" y="14" width="6" height="12" rx="1.5" fill="currentColor" fillOpacity="0.25" />
      <rect x="17" y="19" width="6" height="2" fill="currentColor" fillOpacity="0.25" />
    </svg>
  ),
  TOYOTA: (props) => (
    <svg viewBox="0 0 40 40" fill="none" {...props}>
      <ellipse cx="14" cy="18" rx="7" ry="9" stroke="currentColor" strokeWidth="1.2" strokeOpacity="0.4" />
      <ellipse cx="26" cy="18" rx="7" ry="9" stroke="currentColor" strokeWidth="1.2" strokeOpacity="0.4" />
      <ellipse cx="20" cy="20" rx="8" ry="5" stroke="currentColor" strokeWidth="1" strokeOpacity="0.35" fill="currentColor" fillOpacity="0.04" />
      <path d="M13 11q7-2 14 0" stroke="currentColor" strokeWidth="0.8" strokeOpacity="0.25" />
    </svg>
  ),
  MAZDA: (props) => (
    <svg viewBox="0 0 40 40" fill="none" {...props}>
      <ellipse cx="20" cy="20" rx="17" ry="11" stroke="currentColor" strokeWidth="2" fill="currentColor" fillOpacity="0.04" />
      <path d="M6 20q6-9 14 0" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M34 20q-6-9-14 0" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.5" strokeLinecap="round" />
      <circle cx="20" cy="20" r="2" fill="currentColor" fillOpacity="0.3" />
    </svg>
  ),
  NISSAN: (props) => (
    <svg viewBox="0 0 40 40" fill="none" {...props}>
      <circle cx="20" cy="20" r="16" stroke="currentColor" strokeWidth="2" fill="currentColor" fillOpacity="0.04" />
      <rect x="7" y="17" width="26" height="6" rx="1" fill="currentColor" fillOpacity="0.25" />
    </svg>
  ),
  VOLVO: (props) => (
    <svg viewBox="0 0 40 40" fill="none" {...props}>
      <circle cx="20" cy="20" r="16" stroke="currentColor" strokeWidth="2" />
      <path d="M12 8L20 20 28 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 32L20 20 28 32" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  MITSUBISHI: (props) => (
    <svg viewBox="0 0 40 40" fill="none" {...props}>
      <path d="M20 4L32 23H8Z" stroke="currentColor" strokeWidth="1.5" fill="currentColor" fillOpacity="0.06" />
      <path d="M20 13L28 26H12Z" fill="currentColor" fillOpacity="0.2" />
      <path d="M20 22L25 30H15Z" fill="currentColor" fillOpacity="0.35" />
    </svg>
  ),
  LAND_ROVER: (props) => (
    <svg viewBox="0 0 40 40" fill="none" {...props}>
      <rect x="5" y="11" width="30" height="18" rx="9" stroke="currentColor" strokeWidth="2" fill="currentColor" fillOpacity="0.04" />
      <rect x="8" y="14" width="10" height="12" rx="2" fill="currentColor" fillOpacity="0.2" />
      <rect x="22" y="14" width="10" height="12" rx="2" fill="currentColor" fillOpacity="0.2" />
      <rect x="18" y="14" width="4" height="12" fill="currentColor" fillOpacity="0.08" />
    </svg>
  ),
  PORSCHE: (props) => (
    <svg viewBox="0 0 40 40" fill="none" {...props}>
      <rect x="7" y="4" width="26" height="33" rx="5" stroke="currentColor" strokeWidth="2" />
      <rect x="11" y="8" width="18" height="22" rx="2" fill="currentColor" fillOpacity="0.08" />
      <path d="M14 14c0-2 3-3 6-3s6 1 6 3-3 3-6 3-6-1-6-3z" fill="currentColor" fillOpacity="0.25" />
      <path d="M16 19h8v1h-8z" fill="currentColor" fillOpacity="0.2" />
      <circle cx="20" cy="24" r="2.5" fill="currentColor" fillOpacity="0.12" />
    </svg>
  ),
  JEEP: (props) => (
    <svg viewBox="0 0 40 40" fill="none" {...props}>
      <rect x="5" y="4" width="30" height="32" rx="4" stroke="currentColor" strokeWidth="2" />
      <rect x="9" y="8" width="22" height="16" rx="1" fill="currentColor" fillOpacity="0.06" />
      <path d="M11 10h18M11 13h18M11 16h18M11 19h18" stroke="currentColor" strokeWidth="0.5" strokeOpacity="0.15" />
      <path d="M13 10v6M16 10v6M19 10v6M22 10v6M25 10v6M28 10v6" stroke="currentColor" strokeWidth="1" strokeOpacity="0.4" />
      <circle cx="15" cy="28" r="2.5" stroke="currentColor" strokeWidth="1" />
      <circle cx="25" cy="28" r="2.5" stroke="currentColor" strokeWidth="1" />
    </svg>
  ),
  CHEVROLET: (props) => (
    <svg viewBox="0 0 40 40" fill="none" {...props}>
      <path d="M20 3L24 15L37 15 27 23 31 37 20 28 9 37 13 23 3 15 16 15Z" stroke="currentColor" strokeWidth="1.5" fill="currentColor" fillOpacity="0.08" strokeLinejoin="round" />
      <path d="M20 6L23 16L34 16 26 23 29 34 20 27 11 34 14 23 6 16 17 16Z" fill="currentColor" fillOpacity="0.18" />
    </svg>
  ),
  MAN: (props) => (
    <svg viewBox="0 0 40 40" fill="none" {...props}>
      <rect x="4" y="9" width="32" height="22" rx="4" stroke="currentColor" strokeWidth="2" />
      <rect x="4" y="14" width="32" height="4" fill="currentColor" fillOpacity="0.15" />
      <path d="M11 21l3 5-1-5h-2zm6 0l3 5-1-5h-2zm6 0l3 5-1-5h-2z" fill="currentColor" fillOpacity="0.2" />
    </svg>
  ),
  SCANIA: (props) => (
    <svg viewBox="0 0 40 40" fill="none" {...props}>
      <circle cx="20" cy="20" r="16" stroke="currentColor" strokeWidth="2" />
      <path d="M13 27c0-7 14-7 14 0" stroke="currentColor" strokeWidth="1" fill="currentColor" fillOpacity="0.08" />
      <circle cx="20" cy="17" r="3" fill="currentColor" fillOpacity="0.2" />
      <path d="M16 23h8v2H16z" fill="currentColor" fillOpacity="0.15" />
      <path d="M18 14c1-2 4-2 5 0" stroke="currentColor" strokeWidth="0.8" strokeOpacity="0.3" />
    </svg>
  ),
  IVECO: (props) => (
    <svg viewBox="0 0 40 40" fill="none" {...props}>
      <rect x="4" y="8" width="32" height="24" rx="4" stroke="currentColor" strokeWidth="2" />
      <rect x="8" y="12" width="11" height="16" rx="1" fill="currentColor" fillOpacity="0.18" />
      <rect x="21" y="12" width="11" height="16" rx="1" fill="currentColor" fillOpacity="0.18" />
    </svg>
  ),
  TOFAS: (props) => (
    <svg viewBox="0 0 40 40" fill="none" {...props}>
      <circle cx="20" cy="20" r="16" stroke="currentColor" strokeWidth="2" />
      <path d="M13 13h14l-5 7h5l-7 10V20h-5l-2-7z" fill="currentColor" fillOpacity="0.2" />
    </svg>
  ),
  LADA: (props) => (
    <svg viewBox="0 0 40 40" fill="none" {...props}>
      <rect x="5" y="8" width="30" height="24" rx="6" stroke="currentColor" strokeWidth="2" fill="currentColor" fillOpacity="0.04" />
      <path d="M12 14h16v4H12z" fill="currentColor" fillOpacity="0.2" />
      <path d="M12 22h16v2H12z" fill="currentColor" fillOpacity="0.15" />
      <circle cx="20" cy="18" r="2.5" fill="currentColor" fillOpacity="0.3" />
    </svg>
  ),
  ALFA_ROMEO: (props) => (
    <svg viewBox="0 0 40 40" fill="none" {...props}>
      <rect x="5" y="5" width="30" height="30" rx="7" stroke="currentColor" strokeWidth="2" fill="currentColor" fillOpacity="0.04" />
      <rect x="11" y="10" width="7" height="20" rx="1" fill="currentColor" fillOpacity="0.2" />
      <rect x="22" y="10" width="7" height="20" rx="1" fill="currentColor" fillOpacity="0.1" />
      <path d="M18 13l2-3 2 3z" fill="currentColor" fillOpacity="0.3" />
      <path d="M18 27l2 3 2-3z" fill="currentColor" fillOpacity="0.3" />
    </svg>
  ),
  LANCIA: (props) => (
    <svg viewBox="0 0 40 40" fill="none" {...props}>
      <rect x="7" y="5" width="26" height="30" rx="6" stroke="currentColor" strokeWidth="2" fill="currentColor" fillOpacity="0.04" />
      <path d="M13 10v20M27 10v20" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.3" />
      <rect x="17" y="14" width="6" height="12" rx="1" fill="currentColor" fillOpacity="0.25" />
    </svg>
  ),
  UNIVERSAL: (props) => (
    <svg viewBox="0 0 40 40" fill="none" {...props}>
      <circle cx="20" cy="20" r="15" stroke="currentColor" strokeWidth="1.5" opacity="0.3" />
      <circle cx="20" cy="20" r="8" stroke="currentColor" strokeWidth="1" opacity="0.2" />
      <circle cx="20" cy="20" r="3" fill="currentColor" fillOpacity="0.15" />
    </svg>
  ),
  KIA: (props) => (
    <svg viewBox="0 0 40 40" fill="none" {...props}>
      <ellipse cx="20" cy="20" rx="17" ry="12" stroke="currentColor" strokeWidth="2" fill="currentColor" fillOpacity="0.04" />
      <path d="M10 15l4 10 6-10 6 10 4-10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  CHRYSLER: (props) => (
    <svg viewBox="0 0 40 40" fill="none" {...props}>
      <path d="M6 15q14-8 28 0" stroke="currentColor" strokeWidth="2" fill="none" />
      <path d="M6 25q14-8 28 0" stroke="currentColor" strokeWidth="2" fill="none" />
      <polygon points="20,13 26,29 14,29" fill="currentColor" fillOpacity="0.12" />
      <polygon points="20,17 24,27 16,27" fill="currentColor" fillOpacity="0.2" />
    </svg>
  ),
}

export const brandLogos = logos

export function BrandLogo({ brand, className = "w-12 h-12" }: { brand: string; className?: string }) {
  const key = brand.toUpperCase().replace(/[\s/-]/g, "_")
  const Logo = logos[key] || fallback
  return <Logo className={className} />
}
