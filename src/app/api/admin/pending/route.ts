import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminSecret } from '@/lib/admin/auth'
import { getPendingOrderStore } from '@/lib/wechat-pay/store'

export async function GET(request: NextRequest) {
  const secret = request.headers.get('x-admin-secret') || ''
  if (!verifyAdminSecret(secret)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const store = getPendingOrderStore()
  const pending = await store.listPending()
  const count = await store.countPending()

  return NextResponse.json({
    count,
    orders: pending.map((o) => ({
      outTradeNo: o.outTradeNo,
      userId: o.userId,
      amount: o.amount,
      description: o.description,
      createdAt: o.createdAt,
    })),
  })
}
