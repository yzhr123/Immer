import { NextRequest, NextResponse } from 'next/server'
import { getCreditStore } from '@/lib/credit/store-server'
import { verifyCode, isCodeUsed, markCodeUsed } from '@/lib/redeem/store'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const userId = body.userId as string | undefined
    const code = body.code as string | undefined

    if (!userId) {
      return NextResponse.json({ error: 'Missing userId' }, { status: 400 })
    }
    if (!code?.trim()) {
      return NextResponse.json({ error: '请输入充值码' }, { status: 400 })
    }

    // Verify code signature
    const result = verifyCode(code)
    if (!result.valid) {
      return NextResponse.json({ error: result.reason || '无效的充值码' }, { status: 400 })
    }

    // Check for reuse
    if (isCodeUsed(result.code)) {
      return NextResponse.json({ error: '该充值码已被使用' }, { status: 400 })
    }

    // Add credits
    const creditStore = getCreditStore()
    const balance = await creditStore.addCredits(userId, result.amount, `redeem:${result.code}`)

    // Mark as used
    markCodeUsed(result.code)

    return NextResponse.json({ balance })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('Redeem error:', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
