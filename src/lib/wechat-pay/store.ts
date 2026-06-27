/**
 * Pending Order Store
 *
 * Tracks orders that have been submitted to WeChat Pay but not yet paid.
 * Maps outTradeNo → { userId, amount (credit ¥), description, status, codeUrl, createdAt }.
 *
 * ┌─ In-memory for development; swap for Redis/DB later.
 * └─ Orders expire after 2 hours (same as WeChat Pay code_url TTL).
 */

/* ============================================================
 *  Types
 * ============================================================ */

export type PendingOrderStatus = 'pending' | 'paid' | 'expired' | 'pending_review'

export interface PendingOrder {
  /** Merchant order number (out_trade_no). */
  outTradeNo: string
  /** Internal user id. */
  userId: string
  /** Credit amount (¥). e.g. 10, 30, 50. */
  amount: number
  /** Human-readable description. */
  description: string
  /** WeChat Pay code_url (for QR code), empty for manual orders. */
  codeUrl: string
  /** Order status. */
  status: PendingOrderStatus
  /** Timestamp when order was created. */
  createdAt: number
  /** Timestamp when order was paid (null until paid). */
  paidAt: number | null
}

/* ============================================================
 *  Interface
 * ============================================================ */

export interface PendingOrderStore {
  create(order: PendingOrder): Promise<void>
  findByOutTradeNo(outTradeNo: string): Promise<PendingOrder | null>
  markPaid(outTradeNo: string): Promise<PendingOrder | null>
  listByUser(userId: string): Promise<PendingOrder[]>
  /** Returns all orders in pending_review status. */
  listPending(): Promise<PendingOrder[]>
  /** Returns count of orders currently in pending_review status. */
  countPending(): Promise<number>
  /** Create a manual payment order (no WeChat Pay). */
  addManualOrder(outTradeNo: string, userId: string, amount: number): Promise<PendingOrder>
}

/* ============================================================
 *  In-Memory implementation
 * ============================================================ */

export class MemoryPendingOrderStore implements PendingOrderStore {
  private orders = new Map<string, PendingOrder>()

  async create(order: PendingOrder): Promise<void> {
    this.orders.set(order.outTradeNo, order)
  }

  async findByOutTradeNo(outTradeNo: string): Promise<PendingOrder | null> {
    return this.orders.get(outTradeNo) ?? null
  }

  async markPaid(outTradeNo: string): Promise<PendingOrder | null> {
    const order = this.orders.get(outTradeNo)
    if (!order) return null
    order.status = 'paid'
    order.paidAt = Date.now()
    return order
  }

  async listByUser(userId: string): Promise<PendingOrder[]> {
    const result: PendingOrder[] = []
    for (const order of this.orders.values()) {
      if (order.userId === userId) {
        result.push(order)
      }
    }
    return result.sort((a, b) => b.createdAt - a.createdAt)
  }

  async listPending(): Promise<PendingOrder[]> {
    const result: PendingOrder[] = []
    for (const order of this.orders.values()) {
      if (order.status === 'pending_review') {
        result.push(order)
      }
    }
    return result.sort((a, b) => b.createdAt - a.createdAt)
  }

  async countPending(): Promise<number> {
    let count = 0
    for (const order of this.orders.values()) {
      if (order.status === 'pending_review') count++
    }
    return count
  }

  async addManualOrder(
    outTradeNo: string,
    userId: string,
    amount: number,
  ): Promise<PendingOrder> {
    const order: PendingOrder = {
      outTradeNo,
      userId,
      amount,
      description: `人工充值 ¥${amount}`,
      codeUrl: '',
      status: 'pending_review',
      createdAt: Date.now(),
      paidAt: null,
    }
    this.orders.set(outTradeNo, order)
    return order
  }
}

/* ============================================================
 *  Singleton Resolver
 * ============================================================ */

let instance: PendingOrderStore | null = null

export function getPendingOrderStore(): PendingOrderStore {
  if (!instance) {
    instance = new MemoryPendingOrderStore()
  }
  return instance
}
