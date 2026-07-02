import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

export async function POST(request: NextRequest) {
  try {
    const { genre, llmConfig, language = 'zh' } = await request.json()

    if (!llmConfig?.apiUrl || !llmConfig?.model || !llmConfig?.apiKey) {
      return NextResponse.json({ error: 'LLM 配置不完整' }, { status: 400 })
    }
    if (!genre) {
      return NextResponse.json({ error: '未选择题材' }, { status: 400 })
    }

    const prompt = language === 'en'
      ? `Genre: ${genre}\nGenerate a short story premise (30-80 Chinese characters) fitting this genre. Output the premise only, no extra text.`
      : `题材：${genre}\n根据这个题材生成一个简短的故事前提描述（30-80个字），只输出前提内容。`

    const client = new OpenAI({
      baseURL: llmConfig.apiUrl.replace(/\/+$/, ''),
      apiKey: llmConfig.apiKey,
    })

    const response = await client.chat.completions.create({
      model: llmConfig.model,
      messages: [
        { role: 'system', content: '你只输出故事前提描述，不解释不提问。' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.8,
    })

    const raw = (response.choices[0]?.message?.content || '').trim()
    if (!raw) {
      return NextResponse.json({ error: '生成失败' }, { status: 500 })
    }

    return NextResponse.json({ premise: raw })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[generate-premise] error:', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
