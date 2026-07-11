/** Carrier tracking URL helpers (Turkey common carriers). */

export function trackingUrl(carrier: string, trackingNumber: string): string | null {
  const code = trackingNumber.trim()
  if (!code) return null
  const c = carrier.trim().toLocaleLowerCase("tr")

  if (!c || c.includes("yurtiçi") || c.includes("yurtici") || c.includes("yurtici kargo")) {
    return `https://www.yurticikargo.com/tr/online-servisler/gonderi-sorgula?code=${encodeURIComponent(code)}`
  }
  if (c.includes("aras")) {
    return `https://www.araskargo.com.tr/trtrack/?code=${encodeURIComponent(code)}`
  }
  if (c.includes("mng")) {
    return `https://www.mngkargo.com.tr/gonderitakip?takipNo=${encodeURIComponent(code)}`
  }
  if (c.includes("ptt")) {
    return `https://gonderitakip.ptt.gov.tr/`
  }
  if (c.includes("sürat") || c.includes("surat")) {
    return `https://www.suratkargo.com.tr/KargoTakip/?kargotakipno=${encodeURIComponent(code)}`
  }
  return null
}
