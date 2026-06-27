import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminSecret } from '@/lib/admin/auth'
import { getPendingOrderStore } from '@/lib/wechat-pay/store'
import { getCreditStore } from '@/lib/credit/store-server'

export async function POST(request: NextRequest) {
  const secret = request.headers.get('x-admin-secret') || ''
  if (!verifyAdminSecret(secret)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body: { outTradeNo: string } = await request.json()
    const { outTradeNo } = body

    if (!outTradeNo) {
      return NextResponse.json({ error: 'outTradeNo is required' }, { status: 400 })
    }

    const orderStore = getPendingOrderStore()
    const order = await orderStore.findByOutTradeNo(outTradeNo)

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    if (order.status !== 'pending_review') {
      return NextResponse.json(
        { error: `Order is not pending review (status: ${order.status})` },
        { status: 409 },
      )
    }

    const creditStore = getCreditStore()
    const newBalance = await creditStore.addCredits(
      order.userId,
      order.amount,
      order.outTradeNo,
    )

    await orderStore.markPaid(outTradeNo)

    return NextResponse.json({
      success: true,
      userId: order.userId,
      amount: order.amount,
      balance: newBalance,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
