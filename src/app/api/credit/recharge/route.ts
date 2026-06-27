import { NextRequest, NextResponse } from 'next/server'
import { getCreditStore } from '@/lib/credit/store-server'
import { getPendingOrderStore } from '@/lib/wechat-pay/store'

export async function POST(request: NextRequest) {
  try {
    const body: { userId: string; amount: number; outTradeNo?: string } = await request.json()
    const { userId, amount, outTradeNo } = body

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 })
    }
    if (!amount || amount <= 0 || !Number.isInteger(amount)) {
      return NextResponse.json({ error: 'amount must be a positive integer' }, { status: 400 })
    }

    // If outTradeNo is provided, this is a manual payment → store as pending_review
    if (outTradeNo) {
      const order = await getPendingOrderStore().addManualOrder(outTradeNo, userId, amount)
      return NextResponse.json({
        success: true,
        status: 'pending_review',
        outTradeNo: order.outTradeNo,
        message: `订单已提交，等待商家确认 ¥${amount}`,
      })
    }

    // Otherwise, direct recharge (dev/testing fallback)
    const orderId = `recharge_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    const store = getCreditStore()
    const balance = await store.addCredits(userId, amount, orderId)

    return NextResponse.json({
      success: true,
      balance,
      orderId,
      message: `充值成功，共 ¥${amount}`,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
