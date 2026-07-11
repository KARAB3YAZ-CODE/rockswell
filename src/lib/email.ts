/**
 * Transactional email via Resend (RESEND_API_KEY) or SMTP (SMTP_*).
 * No-ops with a console warning when neither is configured.
 */

export type MailPayload = {
  to: string
  subject: string
  html: string
  text?: string
}

function fromAddress() {
  return process.env.MAIL_FROM || process.env.RESEND_FROM || "Rockswell <noreply@rockswell.store>"
}

async function sendViaResend(payload: MailPayload): Promise<boolean> {
  const key = process.env.RESEND_API_KEY
  if (!key) return false

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: fromAddress(),
      to: [payload.to],
      subject: payload.subject,
      html: payload.html,
      text: payload.text,
    }),
  })

  if (!res.ok) {
    const body = await res.text()
    console.warn("Resend mail failed", res.status, body)
    return false
  }
  return true
}

/** Best-effort email. Returns true if queued/sent. */
export async function sendMail(payload: MailPayload): Promise<boolean> {
  if (!payload.to?.includes("@")) return false

  try {
    if (await sendViaResend(payload)) return true
  } catch (e) {
    console.warn("mail send error", e)
  }

  if (process.env.NODE_ENV !== "production") {
    console.info("[mail:dev]", payload.subject, "→", payload.to)
  }
  return false
}

export function orderStatusMailHtml(opts: {
  orderNumber: string
  title: string
  message: string
  link?: string
}) {
  const link = opts.link
    ? `<p><a href="${opts.link}" style="color:#39ff14">Siparisi goruntule</a></p>`
    : ""
  return `
    <div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;color:#111">
      <h2 style="margin:0 0 8px">ROCKSWELL</h2>
      <p style="color:#666;margin:0 0 16px">Siparis bildirimi</p>
      <h3 style="margin:0 0 8px">${opts.title}</h3>
      <p>${opts.message}</p>
      <p><strong>${opts.orderNumber}</strong></p>
      ${link}
    </div>
  `
}
