import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

const DEPTH_PROMPTS: Record<string, string> = {
  overview: '以概览了解为深度，覆盖该专题最核心的基础概念，生成5-8个知识点。每个知识点用一句话概括其核心，无需深入细节。',
  detailed: '以深入学习为深度，覆盖该专题的主要知识领域，生成10-15个知识点。每个知识点包含简要概念说明和需掌握的关键要点。',
  comprehensive: '以全面掌握为深度，系统性地覆盖该专题的各个层面，生成16-25个知识点。每个知识点包含概念说明、关键要点和常见应用场景。',
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { topic, depth, llmConfig, language } = body

    if (!topic?.trim()) {
      return NextResponse.json({ error: '请提供专题名称' }, { status: 400 })
    }

    if (!llmConfig?.apiUrl || !llmConfig?.model || !llmConfig?.apiKey) {
      return NextResponse.json({ error: 'LLM 配置不完整' }, { status: 400 })
    }

    const lang = language === 'en' ? 'English' : '中文'
    const depthInstruction = DEPTH_PROMPTS[depth] || DEPTH_PROMPTS.overview

    const systemPrompt = `你是一位课程体系设计专家。根据用户指定的学习专题和深度需求，生成结构化的知识点列表。

## 要求
- 用${lang}输出
- 知识点名称简洁明确（4-15字）
- 每个知识点附带一句话描述，说明该知识点涵盖的核心内容
- 知识点之间应有递进关系，从基础到深入
- 知识点应覆盖该专题的核心领域，避免偏门冷门内容

## 输出 JSON 格式
{
  "title": "为该系列课程起一个有吸引力的标题（8-20字），要像一个课程系列的正式名称，不要只用一个字或太短。例如：「税务筹划实战指南」、「Python数据分析全流程」、「设计思维方法论」",
  "icon": "一个能代表该专题的单字或短词图标，如：税 / 稽 / K / 经 / 网 / 码 / 算 / 设",
  "knowledgePoints": [
    { "name": "知识点名称", "description": "一句话描述（15-30字）" }
  ]
}

注意：只返回 JSON，不要包含其他内容。严格按照 JSON 格式输出。`

    const userPrompt = `学习专题：${topic}
学习深度：${depth || 'overview'}

${depthInstruction}

请生成知识点列表。`

    const client = new OpenAI({
      baseURL: llmConfig.apiUrl.replace(/\/+$/, ''),
      apiKey: llmConfig.apiKey,
    })

    const response = await client.chat.completions.create({
      model: llmConfig.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
      response_format: { type: 'json_object' },
    })

    const raw = response.choices[0]?.message?.content || ''
    const parsed = JSON.parse(raw)
    const knowledgePoints = Array.isArray(parsed.knowledgePoints) ? parsed.knowledgePoints : []

    // Ensure each KP has an id
    const kps = knowledgePoints.map((kp: any, i: number) => ({
      id: `skp_${Date.now()}_${i}`,
      name: kp.name || '',
      description: kp.description || '',
      completed: false,
    }))

    return NextResponse.json({
      title: parsed.title || topic.trim(),
      icon: parsed.icon || '',
      knowledgePoints: kps,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[learn/generate-series] error:', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
