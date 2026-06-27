/**
 * Pending Order Query
 *
 * GET /api/wechat-pay/order?outTradeNo=xxx
 *
 * Returns the current status of a pending order.
 * Used by the frontend to poll after showing the QR code.
 *
 * Response: { outTradeNo, status, amount, createdAt }
 *   status: "pending" | "paid" | "expired"
 */

import { NextRequest, NextResponse } from 'next/server'
import { getPendingOrderStore } from '@/lib/wechat-pay/store'

export async function GET(request: NextRequest) {
  try {
    const outTradeNo = request.nextUrl.searchParams.get('outTradeNo')
    if (!outTradeNo) {
      return NextResponse.json(
        { error: 'outTradeNo is required' },
        { status: 400 },
      )
    }

    const order = await getPendingOrderStore().findByOutTradeNo(outTradeNo)
    if (!order) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 },
      )
    }

    // Auto-expire orders older than 2 hours
    const TWO_HOURS = 2 * 60 * 60 * 1000
    const effectiveStatus =
      order.status === 'pending' && Date.now() - order.createdAt > TWO_HOURS
        ? 'expired'
        : order.status

    return NextResponse.json({
      outTradeNo: order.outTradeNo,
      status: effectiveStatus,
      amount: order.amount,
      createdAt: order.createdAt,
      paidAt: order.paidAt,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
