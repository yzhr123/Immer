/**
 * WeChat Pay v3 Crypto Utilities
 *
 * Ported from the reference Java SDK (WXPayUtility.java).
 * Uses Node.js built-in `crypto` — zero additional dependencies.
 *
 * Core capabilities:
 *   buildAuthorization   — sign outgoing API requests (SHA256withRSA)
 *   validateResponse     — verify incoming response signatures
 *   validateNotification — verify payment callback signatures
 *   decryptNotification  — AEAD_AES_256_GCM decrypt of callback resource
 *   generateOutTradeNo   — unique merchant order number
 */

import { type IncomingHttpHeaders } from 'http'
import {
  createSign,
  createVerify,
  createDecipheriv,
  createPrivateKey,
  createPublicKey,
  randomBytes,
} from 'crypto'

/* ============================================================
 *  Key loading helpers
 * ============================================================ */

let _privateKey: ReturnType<typeof createPrivateKey> | null = null
let _publicKey: ReturnType<typeof createPublicKey> | null = null

function getPrivateKey(pem: string): ReturnType<typeof createPrivateKey> {
  if (!_privateKey) _privateKey = createPrivateKey(pem)
  return _privateKey
}

function getPublicKey(pem: string): ReturnType<typeof createPublicKey> {
  if (!_publicKey) _publicKey = createPublicKey(pem)
  return _publicKey
}

/** Reset cached keys (testing only). */
export function resetKeyCache(): void {
  _privateKey = null
  _publicKey = null
}

/* ============================================================
 *  Nonce
 * ============================================================ */

/** Generate a random alphanumeric string of the given length. */
export function createNonce(length: number): string {
  const chars =
    '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'
  const bytes = randomBytes(length)
  let result = ''
  for (let i = 0; i < length; i++) {
    result += chars[bytes[i] % chars.length]
  }
  return result
}

/* ============================================================
 *  Authorization header builder
 * ============================================================ */

/**
 * Build the `Authorization` header value for WeChat Pay v3 API requests.
 *
 * Schema: `WECHATPAY2-SHA256-RSA2048 mchid="...",nonce_str="...",...`
 *
 * @see https://pay.weixin.qq.com/doc/v3/merchant/4013072390
 */
export function buildAuthorization(
  mchid: string,
  certificateSerialNo: string,
  privateKeyPem: string,
  method: string,
  uri: string,
  body: string,
): string {
  const nonce = createNonce(32)
  const timestamp = Math.floor(Date.now() / 1000)

  // Canonical message to sign
  const message = `${method}\n${uri}\n${timestamp}\n${nonce}\n${body || ''}\n`

  const signer = createSign('RSA-SHA256')
  signer.update(message)
  signer.end()
  const signature = signer.sign(getPrivateKey(privateKeyPem), 'base64')

  return (
    `WECHATPAY2-SHA256-RSA2048 ` +
    `mchid="${mchid}",` +
    `nonce_str="${nonce}",` +
    `signature="${signature}",` +
    `timestamp="${timestamp}",` +
    `serial_no="${certificateSerialNo}"`
  )
}

/* ============================================================
 *  Response / Notification verification
 * ============================================================ */

/** Headers we care about from WeChat Pay responses / callbacks. */
interface WechatpayHeaders {
  'wechatpay-timestamp'?: string
  'wechatpay-nonce'?: string
  'wechatpay-signature'?: string
  'wechatpay-serial'?: string
  'request-id'?: string
}

/**
 * Validate a WeChat Pay API response signature.
 * Throws if verification fails or timestamp is stale (>5 min).
 */
export function validateResponse(
  wechatpayPublicKeyId: string,
  wechatpayPublicKeyPem: string,
  headers: WechatpayHeaders,
  body: string,
): void {
  validateSignature(wechatpayPublicKeyId, wechatpayPublicKeyPem, headers, body, 'response')
}

/**
 * Validate a WeChat Pay payment notification (callback) signature.
 * Throws if verification fails or timestamp is stale (>5 min).
 */
export function validateNotification(
  wechatpayPublicKeyId: string,
  wechatpayPublicKeyPem: string,
  headers: WechatpayHeaders,
  body: string,
): void {
  validateSignature(
    wechatpayPublicKeyId,
    wechatpayPublicKeyPem,
    headers,
    body,
    'notification',
  )
}

function validateSignature(
  wechatpayPublicKeyId: string,
  wechatpayPublicKeyPem: string,
  headers: WechatpayHeaders,
  body: string,
  context: 'response' | 'notification',
): void {
  const timestamp = headers['wechatpay-timestamp']
  const nonce = headers['wechatpay-nonce']
  const signature = headers['wechatpay-signature']
  const serial = headers['wechatpay-serial']
  const requestId = headers['request-id'] ?? ''

  // 1. Check required headers
  if (!timestamp || !nonce || !signature || !serial) {
    throw new Error(
      `[wechat-pay] ${context === 'response' ? 'Response' : 'Notification'} ` +
        `missing required signature headers. Request-ID: ${requestId}`,
    )
  }

  // 2. Timestamp freshness (±5 minutes)
  const ts = parseInt(timestamp, 10)
  if (isNaN(ts) || Math.abs(Date.now() / 1000 - ts) > 300) {
    throw new Error(
      `[wechat-pay] ${context === 'response' ? 'Response' : 'Notification'} ` +
        `timestamp expired or invalid. timestamp=${timestamp}, Request-ID: ${requestId}`,
    )
  }

  // 3. Serial matches our local public key
  if (serial !== wechatpayPublicKeyId) {
    throw new Error(
      `[wechat-pay] ${context === 'response' ? 'Response' : 'Notification'} ` +
        `Wechatpay-Serial mismatch. Local: ${wechatpayPublicKeyId}, Remote: ${serial}`,
    )
  }

  // 4. Verify signature
  const message = `${timestamp}\n${nonce}\n${body || ''}\n`
  const verifier = createVerify('RSA-SHA256')
  verifier.update(message)
  verifier.end()
  const isValid = verifier.verify(
    getPublicKey(wechatpayPublicKeyPem),
    signature,
    'base64',
  )

  if (!isValid) {
    throw new Error(
      `[wechat-pay] ${context === 'response' ? 'Response' : 'Notification'} ` +
        `signature verification failed. Request-ID: ${requestId}`,
    )
  }
}

/**
 * Shorthand: convert IncomingHttpHeaders (from Node http server / Next.js)
 * to the WechatpayHeaders shape we need.
 */
export function pickWechatpayHeaders(
  src: IncomingHttpHeaders | Headers | Record<string, string>,
): WechatpayHeaders {
  const get = (key: string): string | undefined => {
    if (typeof (src as Headers).get === 'function') {
      return (src as Headers).get(key) ?? undefined
    }
    const lower = key.toLowerCase()
    return (src as Record<string, string>)[lower] ?? (src as Record<string, string>)[key] ?? undefined
  }
  return {
    'wechatpay-timestamp': get('Wechatpay-Timestamp'),
    'wechatpay-nonce': get('Wechatpay-Nonce'),
    'wechatpay-signature': get('Wechatpay-Signature'),
    'wechatpay-serial': get('Wechatpay-Serial'),
    'request-id': get('Request-ID'),
  }
}

/* ============================================================
 *  AEAD_AES_256_GCM decryption
 * ============================================================ */

/**
 * Decrypt WeChat Pay notification resource ciphertext using AEAD_AES_256_GCM.
 *
 * In WeChat Pay's GCM mode, the auth tag (16 bytes) is **appended** to the
 * ciphertext. Node.js crypto requires us to split it off explicitly.
 *
 * @param apiV3Key - APIv3 key string (32 characters / bytes).
 * @param associatedData - AAD from resource (UTF-8).
 * @param nonce - Nonce from resource (UTF-8).
 * @param ciphertext - Base64-encoded ciphertext (includes appended auth tag).
 * @returns Decrypted plaintext (JSON string of the transaction detail).
 */
export function aesAeadDecrypt(
  apiV3Key: string,
  associatedData: string,
  nonce: string,
  ciphertext: string,
): string {
  const key = Buffer.from(apiV3Key, 'utf-8')
  const nonceBuf = Buffer.from(nonce, 'utf-8')
  const aadBuf = Buffer.from(associatedData, 'utf-8')
  const encrypted = Buffer.from(ciphertext, 'base64')

  // AEAD_AES_256_GCM tag is the last 16 bytes
  const tagLength = 16
  if (encrypted.length < tagLength) {
    throw new Error(
      '[wechat-pay] ciphertext too short (must include 16-byte auth tag)',
    )
  }

  const authTag = encrypted.subarray(encrypted.length - tagLength)
  const data = encrypted.subarray(0, encrypted.length - tagLength)

  const decipher = createDecipheriv('aes-256-gcm', key, nonceBuf)
  decipher.setAAD(aadBuf)
  decipher.setAuthTag(authTag)

  const decrypted = decipher.update(data)
  decipher.final() // verify auth tag

  return decrypted.toString('utf-8')
}

/* ============================================================
 *  Notification parsing (validate + decrypt combined)
 * ============================================================ */

/** Raw notification from WeChat Pay (before decryption). */
export interface WechatpayNotification {
  id: string
  create_time: string
  event_type: string
  resource_type: string
  summary: string
  resource: {
    algorithm: string
    ciphertext: string
    associated_data: string
    nonce: string
    original_type: string
  }
}

/** Decrypted transaction detail (after decrypting resource.ciphertext). */
export interface DecryptedTransaction {
  /** 微信支付订单号 */
  transaction_id: string
  /** 商户订单号 */
  out_trade_no: string
  /** 订单金额 (分) */
  amount: {
    total: number
    currency: string
    payer_total: number
    payer_currency: string
  }
  /** 支付完成时间 */
  success_time: string
  /** 附加数据 (attach) — we put userId in here */
  attach: string
  /** 商户号 */
  mchid: string
  /** AppID */
  appid: string
  /** 交易状态 SUCCESS */
  trade_state: string
  /** 交易类型 NATIVE */
  trade_type: string
  /** 银行类型 */
  bank_type: string
}

/**
 * Parse, validate, and decrypt a WeChat Pay payment notification.
 *
 * Steps:
 * 1. Validate notification signature (using WeChat Pay public key).
 * 2. Parse JSON body into WechatpayNotification.
 * 3. Decrypt resource.ciphertext using AEAD_AES_256_GCM.
 * 4. Parse decrypted JSON into DecryptedTransaction.
 *
 * @returns The decrypted transaction detail.
 */
export function parseNotification(
  apiV3Key: string,
  wechatpayPublicKeyId: string,
  wechatpayPublicKeyPem: string,
  headers: WechatpayHeaders,
  body: string,
): DecryptedTransaction {
  // 1. Validate signature
  validateNotification(wechatpayPublicKeyId, wechatpayPublicKeyPem, headers, body)

  // 2. Parse
  let notification: WechatpayNotification
  try {
    notification = JSON.parse(body)
  } catch {
    throw new Error('[wechat-pay] Failed to parse notification JSON')
  }

  if (!notification.resource) {
    throw new Error('[wechat-pay] Notification missing resource field')
  }
  if (notification.resource.algorithm !== 'AEAD_AES_256_GCM') {
    throw new Error(
      `[wechat-pay] Unsupported algorithm: ${notification.resource.algorithm}`,
    )
  }

  // 3. Decrypt
  const plaintext = aesAeadDecrypt(
    apiV3Key,
    notification.resource.associated_data,
    notification.resource.nonce,
    notification.resource.ciphertext,
  )

  // 4. Parse transaction detail
  try {
    return JSON.parse(plaintext) as DecryptedTransaction
  } catch {
    throw new Error('[wechat-pay] Failed to parse decrypted transaction JSON')
  }
}

/* ============================================================
 *  Order number generator
 * ============================================================ */

let _orderSeq = 0

/**
 * Generate a unique merchant order number (out_trade_no).
 *
 * Format: `IMMER_YYYYMMDD_HHMMSS_XXXX` where XXXX is a random suffix.
 * Max length: 32 chars (WeChat Pay limit).
 */
export function generateOutTradeNo(): string {
  const now = new Date()
  const date = now
    .toISOString()
    .slice(0, 19)
    .replace(/[T:-]/g, '')
  const seq = (_orderSeq++ % 10000).toString().padStart(4, '0')
  const rand = randomBytes(2).toString('hex')
  return `IMMER${date}${seq}${rand}`
}
