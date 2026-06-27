import { NextRequest, NextResponse } from 'next/server'
import { generateImage } from '@/lib/ai/client'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const imagePrompt = body.imagePrompt as string
    const imageModelId = body.imageModelId as string | undefined

    if (!imagePrompt) {
      return NextResponse.json(
        { error: 'imagePrompt is required' },
        { status: 400 },
      )
    }

    const imageUrl = await generateImage(imagePrompt, imageModelId)
    return NextResponse.json({ imageUrl })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('Image generate error:', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
