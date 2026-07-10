import crypto from "crypto"

export interface PaytrConfig {
  merchantId: string
  merchantKey: string
  merchantSalt: string
  testMode: boolean
}

export function getPaytrConfig(): PaytrConfig | null {
  const merchantId = process.env.PAYTR_MERCHANT_ID
  const merchantKey = process.env.PAYTR_MERCHANT_KEY
  const merchantSalt = process.env.PAYTR_MERCHANT_SALT

  if (!merchantId || !merchantKey || !merchantSalt) return null

  return {
    merchantId,
    merchantKey,
    merchantSalt,
    testMode: process.env.PAYTR_TEST_MODE === "1",
  }
}

/** merchant_oid must be alphanumeric — derive from order id. */
export function orderIdToOid(orderId: string): string {
  return orderId.replace(/[^a-zA-Z0-9]/g, "")
}

export function buildTokenHash(params: {
  config: PaytrConfig
  userIp: string
  merchantOid: string
  email: string
  paymentAmount: number
  userBasket: string
  noInstallment: string
  maxInstallment: string
  currency: string
}): string {
  const { config } = params
  const hashStr =
    config.merchantId +
    params.userIp +
    params.merchantOid +
    params.email +
    params.paymentAmount +
    params.userBasket +
    params.noInstallment +
    params.maxInstallment +
    params.currency +
    (config.testMode ? "1" : "0")

  return crypto
    .createHmac("sha256", config.merchantKey)
    .update(hashStr + config.merchantSalt)
    .digest("base64")
}

/** Verify the hash PayTR sends to the callback URL. */
export function verifyCallbackHash(params: {
  config: PaytrConfig
  merchantOid: string
  status: string
  totalAmount: string
  hash: string
}): boolean {
  const { config } = params
  const expected = crypto
    .createHmac("sha256", config.merchantKey)
    .update(params.merchantOid + config.merchantSalt + params.status + params.totalAmount)
    .digest("base64")

  return expected === params.hash
}
