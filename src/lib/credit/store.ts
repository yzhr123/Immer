/**
 * Credit / Wallet Store — Types & Pricing (shared: client + server)
 *
 * Server-only implementation (MemoryCreditStore + persistence) is in store-server.ts.
 */

export const CREDIT_PRICES = {
  full: 10,
  lazy: 5,
  none: 0,
} as const

export type ImageTier = keyof typeof CREDIT_PRICES

export function getImagePrice(tier: ImageTier): number {
  return CREDIT_PRICES[tier]
}

/** Story length → price multiplier */
export const LENGTH_MULTIPLIERS: Record<string, number> = {
  short: 1,
  medium: 2,
  long: 3,
}

/** Calculate the actual session price = base price × length multiplier */
export function getSessionPrice(tier: ImageTier, length: string): number {
  return CREDIT_PRICES[tier] * (LENGTH_MULTIPLIERS[length] || 1)
}

export interface CreditStore {
  getBalance(userId: string): Promise<number>

  addCredits(userId: string, amount: number, orderId: string): Promise<number>

  deductCredits(
    userId: string,
    amount: number,
    reason: string,
  ): Promise<{ success: boolean; balance: number; reason?: string }>

  getTransactions(userId: string, limit?: number): Promise<CreditTransaction[]>
}

export interface CreditTransaction {
  id: string
  userId: string
  type: 'recharge' | 'deduct'
  amount: number
  balanceAfter: number
  orderId: string
  reason: string
  createdAt: number
}
