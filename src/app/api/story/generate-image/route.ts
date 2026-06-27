import { NextRequest, NextResponse } from 'next/server'
import { generateImage } from '@/lib/ai/client'
import { getImagePrice } from '@/lib/credit/store'
import { getCreditStore } from '@/lib/credit/store-server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const imagePrompt = body.imagePrompt as string
    const imageModelId = body.imageModelId as string | undefined
    const userId = body.userId as string | undefined

    if (!imagePrompt) {
      return NextResponse.json(
        { error: 'imagePrompt is required' },
        { status: 400 },
      )
    }

    // Deduct credits (lazy mode = ¥5)
    if (userId) {
      const creditStore = getCreditStore()
      const deduct = await creditStore.deductCredits(userId, getImagePrice('lazy'), '图片生成-Lazy模式')
      if (!deduct.success) {
        return NextResponse.json({ error: deduct.reason }, { status: 402 })
      }
    }

    const imageUrl = await generateImage(imagePrompt, imageModelId)
    return NextResponse.json({ imageUrl })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('Image generate error:', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
