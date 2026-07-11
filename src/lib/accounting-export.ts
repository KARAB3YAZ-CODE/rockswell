import type { Invoice } from "./types"

/** Muhasebe / Logo-Paraşüt uyumlu basit CSV (TR noktalı virgül). */
export function invoicesToAccountingCsv(
  invoices: (Invoice & { companyName?: string })[]
): string {
  const header = [
    "FaturaNo",
    "Firma",
    "Tarih",
    "Vade",
    "Durum",
    "AraToplam",
    "KDV",
    "Indirim",
    "GenelToplam",
    "ParaBirimi",
    "SiparisId",
  ].join(";")

  const lines = invoices.map((inv) =>
    [
      inv.invoiceNumber,
      `"${(inv.companyName ?? "").replace(/"/g, '""')}"`,
      inv.createdAt.toISOString().slice(0, 10),
      inv.dueDate.toISOString().slice(0, 10),
      inv.status,
      inv.subtotal.toFixed(2),
      inv.taxTotal.toFixed(2),
      inv.discountTotal.toFixed(2),
      inv.grandTotal.toFixed(2),
      inv.currency || "TRY",
      inv.orderId,
    ].join(";")
  )

  return [header, ...lines].join("\n")
}

export function creditLedgerToCsv(
  entries: { date: string; kind: string; label: string; amount: number; status: string }[]
): string {
  const header = ["Tarih", "Tur", "Aciklama", "Tutar", "Durum"].join(";")
  const lines = entries.map((e) =>
    [
      e.date.slice(0, 10),
      e.kind,
      `"${e.label.replace(/"/g, '""')}"`,
      e.amount.toFixed(2),
      e.status,
    ].join(";")
  )
  return [header, ...lines].join("\n")
}

export function downloadTextFile(filename: string, content: string, mime = "text/csv;charset=utf-8") {
  const blob = new Blob(["\uFEFF" + content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
