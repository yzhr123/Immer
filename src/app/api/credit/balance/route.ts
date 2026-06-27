import { NextRequest, NextResponse } from 'next/server'
import { getCreditStore } from '@/lib/credit/store-server'

export async function GET(request: NextRequest) {
  try {
    const userId = request.nextUrl.searchParams.get('userId')
    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 })
    }

    const store = getCreditStore()
    const balance = await store.getBalance(userId)
    const transactions = await store.getTransactions(userId, 5)

    return NextResponse.json({ balance, transactions })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
