import { NextRequest, NextResponse } from 'next/server'
import { buildSystemPrompt, buildUserPrompt } from '@/lib/ai/prompts'
import { generateStory, generateImage } from '@/lib/ai/client'
import { GENRE_NAMES, Genre, ContextEntry } from '@/lib/ai/types'

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

    if (!llmConfig?.apiUrl || !llmConfig?.model || !llmConfig?.apiKey) {
      return NextResponse.json(
        { error: 'LLM 配置不完整' },
        { status: 400 },
      )
    }

    const genreName = GENRE_NAMES[genre as Genre] || genre
    const systemPrompt = buildSystemPrompt(genreName)
    const userPrompt = buildUserPrompt(genreName, premise, context, choice)

    const storyResult = await generateStory(systemPrompt, userPrompt, llmConfig)

    let imageUrl = ''
    let imageError = ''
    if (generateImageParam && storyResult.scene.imagePrompt) {
      try {
        imageUrl = await generateImage(storyResult.scene.imagePrompt, imageModelId)
      } catch (imgErr: unknown) {
        imageError = imgErr instanceof Error ? imgErr.message : 'Image generation failed'
        console.error('Image generation error:', imageError)
      }
    }
    storyResult.scene.imageUrl = imageUrl

    return NextResponse.json({ ...storyResult, imageError })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('Generate error:', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
