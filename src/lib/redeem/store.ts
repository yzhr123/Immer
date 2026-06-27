/**
 * Redeem Code Store
 *
 * Codes are signed with HMAC-SHA256 using REDEEM_SECRET.
 * Used codes are tracked in .data/used-codes.json to prevent reuse.
 *
 * Code format:  IM{amount}{nonce6}{sig4}
 *   amount — integer, the ¥ value
 *   nonce  — 6 hex chars (from 3 random bytes)
 *   sig    — first 4 hex chars of HMAC-SHA256(secret, `${amount}-${nonce}`)
 *
 * Generate a code:  node scripts/gen-code.mjs <amount>
 */

import { createHmac } from 'crypto'

/* ============================================================
 *  Verification
 * ============================================================ */

function getSecret(): string {
  const secret = process.env.REDEEM_SECRET
  if (!secret) throw new Error('REDEEM_SECRET not configured')
  return secret
}

export interface VerifyResult {
  valid: boolean
  amount: number
  code: string
  reason?: string
}

const CODE_RE = /^IM(\d+)([A-F0-9]{6})([A-F0-9]{4})$/

export function verifyCode(code: string): VerifyResult {
  const clean = code.trim().toUpperCase()
  const match = clean.match(CODE_RE)
  if (!match) {
    return { valid: false, amount: 0, code: clean, reason: 'Invalid code format' }
  }

  const amount = parseInt(match[1], 10)
  const nonce = match[2]
  const sig = match[3]

  if (amount <= 0) {
    return { valid: false, amount: 0, code: clean, reason: 'Invalid amount' }
  }

  const secret = getSecret()
  const expectedSig = createHmac('sha256', secret)
    .update(`${amount}-${nonce}`)
    .digest('hex')
    .substring(0, 4)
    .toUpperCase()

  if (sig !== expectedSig) {
    return { valid: false, amount: 0, code: clean, reason: 'Invalid code signature' }
  }

  return { valid: true, amount, code: clean }
}

/* ============================================================
 *  Used-code tracking (file backed)
 * ============================================================ */

const DATA_DIR = '.data'
const DATA_FILE = 'used-codes.json'

function getFilePath(): string {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const path = require('path')
  return path.join(process.cwd(), DATA_DIR, DATA_FILE)
}

function loadUsedCodes(): Set<string> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require('fs')
    const fp = getFilePath()
    if (!fs.existsSync(fp)) return new Set()
    const arr = JSON.parse(fs.readFileSync(fp, 'utf-8'))
    return new Set<string>(arr)
  } catch {
    return new Set()
  }
}

function saveUsedCodes(codes: Set<string>): void {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require('fs')
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const path = require('path')
    const dir = path.join(process.cwd(), DATA_DIR)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(getFilePath(), JSON.stringify([...codes], null, 2))
  } catch (e) {
    console.error('Failed to persist used-codes:', e)
  }
}

let usedCodes: Set<string> | null = null

function getUsedCodes(): Set<string> {
  if (!usedCodes) usedCodes = loadUsedCodes()
  return usedCodes
}

export function isCodeUsed(code: string): boolean {
  return getUsedCodes().has(code.toUpperCase())
}

export function markCodeUsed(code: string): void {
  const codes = getUsedCodes()
  codes.add(code.toUpperCase())
  saveUsedCodes(codes)
}
