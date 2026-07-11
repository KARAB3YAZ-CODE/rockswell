import { jsPDF } from "jspdf"
import autoTable from "jspdf-autotable"
import type { Invoice } from "./types"

function money(n: number) {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    minimumFractionDigits: 2,
  }).format(n)
}

function dateStr(d: Date | string) {
  const x = d instanceof Date ? d : new Date(d)
  return x.toLocaleDateString("tr-TR")
}

/** Generates a downloadable invoice PDF in the browser. */
export function downloadInvoicePdf(
  inv: Invoice & { companyName?: string },
  opts?: { filename?: string }
) {
  const doc = new jsPDF({ unit: "mm", format: "a4" })
  const margin = 16

  doc.setFontSize(18)
  doc.setFont("helvetica", "bold")
  doc.text("ROCKSWELL", margin, 22)

  doc.setFontSize(10)
  doc.setFont("helvetica", "normal")
  doc.setTextColor(100)
  doc.text("B2B Otomotiv Yedek Parca", margin, 28)

  doc.setTextColor(0)
  doc.setFontSize(14)
  doc.setFont("helvetica", "bold")
  doc.text("FATURA", 210 - margin, 22, { align: "right" })

  doc.setFontSize(10)
  doc.setFont("helvetica", "normal")
  doc.text(inv.invoiceNumber, 210 - margin, 28, { align: "right" })
  doc.text(`Tarih: ${dateStr(inv.createdAt)}`, 210 - margin, 34, { align: "right" })
  doc.text(`Vade: ${dateStr(inv.dueDate)}`, 210 - margin, 40, { align: "right" })

  doc.setFont("helvetica", "bold")
  doc.text("Musteri", margin, 50)
  doc.setFont("helvetica", "normal")
  doc.text(inv.companyName || "Bayi", margin, 56)
  doc.text(`Durum: ${inv.status}`, margin, 62)

  autoTable(doc, {
    startY: 72,
    head: [["Aciklama", "Adet", "Birim", "Toplam"]],
    body: inv.items.map((item) => [
      item.description,
      String(item.quantity),
      money(item.unitPrice),
      money(item.total),
    ]),
    styles: { fontSize: 9, cellPadding: 2 },
    headStyles: { fillColor: [30, 30, 30], textColor: 255 },
    columnStyles: {
      1: { halign: "right" },
      2: { halign: "right" },
      3: { halign: "right" },
    },
    margin: { left: margin, right: margin },
  })

  const finalY =
    (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 120
  let y = finalY + 10

  const rows: [string, string][] = [
    ["Ara toplam", money(inv.subtotal)],
    ...(inv.discountTotal > 0 ? [["Indirim", `-${money(inv.discountTotal)}`] as [string, string]] : []),
    ["KDV", money(inv.taxTotal)],
    ["Genel toplam", money(inv.grandTotal)],
  ]

  for (const [label, value] of rows) {
    const isTotal = label === "Genel toplam"
    doc.setFont("helvetica", isTotal ? "bold" : "normal")
    doc.setFontSize(isTotal ? 11 : 9)
    doc.text(label, 210 - margin - 55, y)
    doc.text(value, 210 - margin, y, { align: "right" })
    y += 6
  }

  y += 8
  doc.setFontSize(8)
  doc.setFont("helvetica", "normal")
  doc.setTextColor(120)
  doc.text(
    "Bu belge elektronik ortamda uretilmistir. Resmi e-fatura yerine gecmez.",
    margin,
    Math.min(y, 280)
  )

  const name = opts?.filename ?? `${inv.invoiceNumber}.pdf`
  doc.save(name)
}
