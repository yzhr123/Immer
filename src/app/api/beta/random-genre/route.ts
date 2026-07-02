import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

export async function POST(request: NextRequest) {
  try {
    const { llmConfig } = await request.json()

    if (!llmConfig?.apiUrl || !llmConfig?.model || !llmConfig?.apiKey) {
      return NextResponse.json({ error: 'LLM 配置不完整' }, { status: 400 })
    }

    const client = new OpenAI({
      baseURL: llmConfig.apiUrl.replace(/\/+$/, ''),
      apiKey: llmConfig.apiKey,
    })

    const response = await client.chat.completions.create({
      model: llmConfig.model,
      messages: [
        { role: 'system', content: '你是故事题材生成器。只说题材名，不解释不提问。' },
        { role: 'user', content: '说一个故事题材，2-4个字。不要这六个：奇幻、科幻、悬疑、历史、恐怖、武侠。例如：都市、校园、宫廷、权谋、家庭、职场、青春、伦理' },
      ],
      temperature: 0.7,
    })

    const raw = response.choices[0]?.message?.content || ''
    console.log('[random-genre] raw response:', JSON.stringify(raw))
    console.log('[random-genre] finish_reason:', response.choices[0]?.finish_reason)

    const cleaned = raw.trim()
    if (!cleaned) {
      console.log('[random-genre] empty response')
      return NextResponse.json({ error: '生成失败' }, { status: 500 })
    }

    return NextResponse.json({ genre: cleaned })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[random-genre] error:', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
