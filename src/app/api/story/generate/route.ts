import { NextRequest, NextResponse } from 'next/server'
import { buildSystemPrompt, buildUserPrompt } from '@/lib/ai/prompts'
import { generateStory, generateImage } from '@/lib/ai/client'
import { GENRE_NAMES, Genre, ContextEntry, ImageMode } from '@/lib/ai/types'
import { getSessionPrice } from '@/lib/credit/store'
import { getCreditStore } from '@/lib/credit/store-server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const genre = body.genre as string
    const premise = body.premise as string || ''
    const context = (body.context || []) as ContextEntry[]
    const choice = body.choice as { id: string; text: string } | undefined
    const llmConfig = body.llmConfig
    const imageModelId = body.imageModelId as string | undefined
    const generateImageParam = body.generateImage !== false
    const storyLength = body.storyLength as string | undefined
    const userId = body.userId as string | undefined
    const imageMode = body.imageMode as ImageMode | undefined

    if (!llmConfig?.apiUrl || !llmConfig?.model || !llmConfig?.apiKey) {
      return NextResponse.json(
        { error: 'LLM 配置不完整' },
        { status: 400 },
      )
    }

    const isFirstScene = context.length === 0 && !choice
    if (userId && isFirstScene && (imageMode === 'full' || imageMode === 'lazy')) {
      const creditStore = getCreditStore()
      const price = getSessionPrice(imageMode, storyLength || 'medium')
      const deduct = await creditStore.deductCredits(
        userId,
        price,
        imageMode === 'full' ? '完整模式体验' : '精简模式体验',
      )
      if (!deduct.success) {
        return NextResponse.json({ error: deduct.reason || '余额不足' }, { status: 402 })
      }
    }

    const language = (body.language || 'zh') as 'zh' | 'en'
    const genreName = GENRE_NAMES[genre as Genre] || genre
    const systemPrompt = buildSystemPrompt(genreName, storyLength, language)
    const sceneCount = context.length + (choice ? 1 : 0)
    const userPrompt = buildUserPrompt(genreName, premise, context, choice, storyLength, sceneCount)

    const storyResult = await generateStory(systemPrompt, userPrompt, llmConfig)

    let newBalance: number | undefined
    if (userId && isFirstScene && (imageMode === 'full' || imageMode === 'lazy')) {
      const store = getCreditStore()
      newBalance = await store.getBalance(userId)
    }

    let imageUrl = ''
    let imageError = ''
    if (generateImageParam && storyResult.scene.imagePrompt && !imageError) {
      try {
        imageUrl = await generateImage(storyResult.scene.imagePrompt, imageModelId)
      } catch (imgErr: unknown) {
        imageError = imgErr instanceof Error ? imgErr.message : 'Image generation failed'
        console.error('Image generation error:', imageError)
      }
    }
    storyResult.scene.imageUrl = imageUrl

    return NextResponse.json({ ...storyResult, imageError, newBalance })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('Generate error:', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
