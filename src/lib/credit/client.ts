'use client'

import { useState, useEffect, useCallback } from 'react'

const USER_ID_KEY = 'immer_user_id'

export function getUserId(): string {
  if (typeof window === 'undefined') return ''
  let id = localStorage.getItem(USER_ID_KEY)
  if (!id) {
    id = crypto.randomUUID?.() ?? Math.random().toString(36).slice(2, 15)
    localStorage.setItem(USER_ID_KEY, id)
  }
  return id
}

export interface BalanceResponse {
  balance: number
  transactions: Array<{
    id: string
    type: 'recharge' | 'deduct'
    amount: number
    balanceAfter: number
    reason: string
    createdAt: number
  }>
}

export async function fetchBalance(userId: string): Promise<BalanceResponse> {
  const res = await fetch(`/api/credit/balance?userId=${encodeURIComponent(userId)}`)
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error((data as any).error || 'Failed to fetch balance')
  }
  return res.json()
}

export async function rechargeCredits(userId: string, amount: number): Promise<{ balance: number }> {
  const res = await fetch('/api/credit/recharge', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, amount }),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error((data as any).error || 'Recharge failed')
  }
  return res.json()
}

export interface CreateWechatPayOrderResponse {
  codeUrl: string
  outTradeNo: string
}

export interface OrderStatusResponse {
  outTradeNo: string
  status: 'pending' | 'paid' | 'expired'
  amount: number
  createdAt: number
  paidAt: number | null
}

/**
 * Create a WeChat Pay Native order for recharge.
 * Returns a code_url (for QR code) and outTradeNo (for polling).
 */
export async function createWechatPayOrder(
  userId: string,
  amount: number,
): Promise<CreateWechatPayOrderResponse> {
  const res = await fetch('/api/wechat-pay/native', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, amount }),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error((data as any).error || 'Failed to create WeChat Pay order')
  }
  return res.json()
}

/**
 * Poll for order payment status.
 * Calls every 2 seconds until paid, expired, or timeout.
 *
 * @returns The final order status.
 */
export async function pollWechatPayOrder(
  outTradeNo: string,
  timeoutMs = 180_000,
): Promise<OrderStatusResponse> {
  const startTime = Date.now()
  const poll = async (): Promise<OrderStatusResponse> => {
    const res = await fetch(`/api/wechat-pay/order?outTradeNo=${encodeURIComponent(outTradeNo)}`)
    if (!res.ok) {
      throw new Error('Failed to query order status')
    }
    const data: OrderStatusResponse = await res.json()

    if (data.status === 'paid' || data.status === 'expired') {
      return data
    }

    if (Date.now() - startTime > timeoutMs) {
      return { ...data, status: 'expired' }
    }

    await new Promise((resolve) => setTimeout(resolve, 2000))
    return poll()
  }

  return poll()
}

function generateOrderId(): string {
  const now = new Date()
  const date = now.toISOString().slice(0, 19).replace(/[T:-]/g, '').slice(4)
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase()
  return `IM${date}${rand}`
}

export { generateOrderId as generateOutTradeNo }

export async function submitManualPayment(
  userId: string,
  amount: number,
  outTradeNo: string,
): Promise<void> {
  const res = await fetch('/api/credit/recharge', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, amount, outTradeNo }),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error((data as any).error || '提交失败')
  }
}

/** Fetch count of orders pending manual review (public). */
export async function fetchPendingCount(): Promise<number> {
  try {
    const res = await fetch('/api/admin/pending-count')
    if (!res.ok) return 0
    const data = await res.json()
    return data.count ?? 0
  } catch {
    return 0
  }
}

export async function redeemCode(userId: string, code: string): Promise<{ balance: number }> {
  const res = await fetch('/api/credit/redeem', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, code }),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error((data as any).error || '充值码无效')
  }
  return res.json()
}

export function useCredits() {
  const userId = getUserId()
  const [balance, setBalance] = useState(0)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    if (!userId) return
    try {
      const data = await fetchBalance(userId)
      setBalance(data.balance)
    } catch {
      // Silently fail — credit system is optional
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    refresh()
  }, [refresh])

  const recharge = useCallback(async (amount: number) => {
    if (!userId) return
    const result = await rechargeCredits(userId, amount)
    setBalance(result.balance)
  }, [userId])

  const setUserBalance = useCallback((newBalance: number) => {
    setBalance(newBalance)
  }, [])

  return { userId, balance, loading, recharge, refresh, setBalance: setUserBalance }
}
