import { NextResponse } from 'next/server'
import { getPendingOrderStore } from '@/lib/wechat-pay/store'

/** Public endpoint — returns number of pending-review orders (for lobby bar). */
export async function GET() {
  const count = await getPendingOrderStore().countPending()
  return NextResponse.json({ count })
}
