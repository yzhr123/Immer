import { NextRequest, NextResponse } from 'next/server'
import { getCreditStore } from '@/lib/credit/store-server'

export async function POST(request: NextRequest) {
  try {
    const body: { userId: string; amount: number; reason: string } = await request.json()
    const { userId, amount, reason } = body

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 })
    }
    if (!amount || amount <= 0 || !Number.isInteger(amount)) {
      return NextResponse.json({ error: 'amount must be a positive integer' }, { status: 400 })
    }

    const store = getCreditStore()
    const result = await store.deductCredits(userId, amount, reason || '图片生成')

    if (!result.success) {
      return NextResponse.json({ error: result.reason }, { status: 402 })
    }

    return NextResponse.json({
      success: true,
      balance: result.balance,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
