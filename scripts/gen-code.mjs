/**
 * Redeem code generator
 *
 * Usage:
 *   node scripts/gen-code.mjs <amount>
 *
 * Examples:
 *   node scripts/gen-code.mjs 10    # generates ¥10 code
 *   node scripts/gen-code.mjs 30    # generates ¥30 code
 *
 * Requires REDEEM_SECRET in .env.local or environment.
 */

import { createHmac, randomBytes } from 'crypto'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Load .env.local manually (avoid dotenv dependency)
function loadEnv() {
  try {
    const envPath = resolve(__dirname, '..', '.env.local')
    const content = readFileSync(envPath, 'utf-8')
    for (const line of content.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eq = trimmed.indexOf('=')
      if (eq === -1) continue
      const key = trimmed.slice(0, eq).trim()
      const val = trimmed.slice(eq + 1).trim()
      if (!process.env[key]) process.env[key] = val
    }
  } catch { /* ignore */ }
}

loadEnv()

const secret = process.env.REDEEM_SECRET
if (!secret) {
  console.error('Error: REDEEM_SECRET not set in .env.local')
  process.exit(1)
}

const amount = parseInt(process.argv[2])
if (!amount || amount <= 0) {
  console.error('Usage: node scripts/gen-code.mjs <amount>')
  process.exit(1)
}

const nonce = randomBytes(3).toString('hex').toUpperCase()
const sig = createHmac('sha256', secret)
  .update(`${amount}-${nonce}`)
  .digest('hex')
  .substring(0, 4)
  .toUpperCase()

const code = `IM${amount}${nonce}${sig}`
console.log(`\n  ${code}\n`)
