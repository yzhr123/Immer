/**
 * Credit / Wallet Store — Server-only implementation
 *
 * Uses JSON file persistence so credit data survives server restarts.
 * Data is stored in `.data/credit-store.json` (gitignored).
 * On Netlify, uses Netlify Blob store instead.
 */

import { CreditStore, CreditTransaction } from './store'
import { readBlob, writeBlob } from '@/lib/blob-store'

/* ============================================================
 *  File persistence helpers (local dev)
 * ============================================================ */

interface StoreData {
  balances: Record<string, number>
  transactions: CreditTransaction[]
}

const DATA_DIR = '.data'
const DATA_FILE = 'credit-store.json'

function getDataFilePath(): string {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const path = require('path')
  return path.join(process.cwd(), DATA_DIR, DATA_FILE)
}

function loadStoreData(): StoreData | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require('fs')
    const filePath = getDataFilePath()
    if (!fs.existsSync(filePath)) return null
    const raw = fs.readFileSync(filePath, 'utf-8')
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function saveStoreData(data: StoreData): void {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require('fs')
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const path = require('path')
    const dir = path.join(process.cwd(), DATA_DIR)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(getDataFilePath(), JSON.stringify(data, null, 2))
  } catch (e) {
    console.error('Failed to persist credit store:', e)
  }
}

/* ============================================================
 *  Utils
 * ============================================================ */

function generateId(): string {
  return crypto.randomUUID?.() ?? Math.random().toString(36).slice(2, 15)
}

function isNetlify(): boolean {
  return process.env.NETLIFY === 'true'
}

/* ============================================================
 *  MemoryCreditStore — local file persistence
 * ============================================================ */

export class MemoryCreditStore implements CreditStore {
  private balances: Map<string, number>
  private transactions: CreditTransaction[]

  constructor() {
    this.balances = new Map()
    this.transactions = []
    this.loadFromDisk()
  }

  private loadFromDisk(): void {
    const data = loadStoreData()
    if (!data) return
    this.balances = new Map(Object.entries(data.balances))
    this.transactions = data.transactions
  }

  private persist(): void {
    const data: StoreData = {
      balances: Object.fromEntries(this.balances),
      transactions: this.transactions,
    }
    saveStoreData(data)
  }

  async getBalance(userId: string): Promise<number> {
    return this.balances.get(userId) ?? 0
  }

  async addCredits(userId: string, amount: number, orderId: string): Promise<number> {
    const current = this.balances.get(userId) ?? 0
    const newBalance = current + amount
    this.balances.set(userId, newBalance)

    this.transactions.push({
      id: generateId(),
      userId,
      type: 'recharge',
      amount,
      balanceAfter: newBalance,
      orderId,
      reason: '充值',
      createdAt: Date.now(),
    })

    this.persist()
    return newBalance
  }

  async deductCredits(
    userId: string,
    amount: number,
    reason: string,
  ): Promise<{ success: boolean; balance: number; reason?: string }> {
    const current = this.balances.get(userId) ?? 0

    if (current < amount) {
      return {
        success: false,
        balance: current,
        reason: `余额不足：需要 ¥${amount}，当前 ¥${current}`,
      }
    }

    const newBalance = current - amount
    this.balances.set(userId, newBalance)

    this.transactions.push({
      id: generateId(),
      userId,
      type: 'deduct',
      amount: -amount,
      balanceAfter: newBalance,
      orderId: '',
      reason,
      createdAt: Date.now(),
    })

    this.persist()
    return { success: true, balance: newBalance }
  }

  async getTransactions(userId: string, limit = 20): Promise<CreditTransaction[]> {
    return this.transactions
      .filter((t) => t.userId === userId)
      .reverse()
      .slice(0, limit)
  }
}

/* ============================================================
 *  NetlifyBlobCreditStore — Netlify Blob persistence
 * ============================================================ */

const BLOB_KEY = 'credits'

export class NetlifyBlobCreditStore implements CreditStore {
  private data: StoreData | null = null

  private async ensureLoaded(): Promise<void> {
    if (this.data) return
    const loaded = await readBlob<StoreData>(BLOB_KEY)
    this.data = loaded ?? { balances: {}, transactions: [] }
  }

  private async persist(): Promise<void> {
    if (!this.data) return
    await writeBlob(BLOB_KEY, this.data)
  }

  async getBalance(userId: string): Promise<number> {
    await this.ensureLoaded()
    return this.data!.balances[userId] ?? 0
  }

  async addCredits(userId: string, amount: number, orderId: string): Promise<number> {
    await this.ensureLoaded()
    const current = this.data!.balances[userId] ?? 0
    const newBalance = current + amount
    this.data!.balances[userId] = newBalance

    this.data!.transactions.push({
      id: generateId(),
      userId,
      type: 'recharge',
      amount,
      balanceAfter: newBalance,
      orderId,
      reason: '充值',
      createdAt: Date.now(),
    })

    await this.persist()
    return newBalance
  }

  async deductCredits(
    userId: string,
    amount: number,
    reason: string,
  ): Promise<{ success: boolean; balance: number; reason?: string }> {
    await this.ensureLoaded()
    const current = this.data!.balances[userId] ?? 0

    if (current < amount) {
      return {
        success: false,
        balance: current,
        reason: `余额不足：需要 ¥${amount}，当前 ¥${current}`,
      }
    }

    const newBalance = current - amount
    this.data!.balances[userId] = newBalance

    this.data!.transactions.push({
      id: generateId(),
      userId,
      type: 'deduct',
      amount: -amount,
      balanceAfter: newBalance,
      orderId: '',
      reason,
      createdAt: Date.now(),
    })

    await this.persist()
    return { success: true, balance: newBalance }
  }

  async getTransactions(userId: string, limit = 20): Promise<CreditTransaction[]> {
    await this.ensureLoaded()
    return this.data!.transactions
      .filter((t) => t.userId === userId)
      .reverse()
      .slice(0, limit)
  }
}

/* ============================================================
 *  Singleton Resolver
 * ============================================================ */

let instance: CreditStore | null = null

export function getCreditStore(): CreditStore {
  if (!instance) {
    instance = isNetlify()
      ? new NetlifyBlobCreditStore()
      : new MemoryCreditStore()
  }
  return instance
}
