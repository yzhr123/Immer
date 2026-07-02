import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

const DIFFICULTY_LABELS: Record<string, string> = {
  beginner: '入门',
  intermediate: '进阶',
  advanced: '高级',
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { title, subject, difficulty, objectives, llmConfig, language } = body

    if (!llmConfig?.apiUrl || !llmConfig?.model || !llmConfig?.apiKey) {
      return NextResponse.json({ error: 'LLM 配置不完整' }, { status: 400 })
    }

    const lang = language === 'en' ? 'English' : '中文'

    const systemPrompt = `你是一位课程设计专家。根据用户提供的课程信息，生成一段吸引人的课程描述，并推断学科分类。

## 要求
- 用${lang}撰写，2-4句话
- 突出课程的实用价值和沉浸式体验
- 用场景化的语言让读者感受到"我在这个课程中会经历什么"
- 不要罗列知识点，而是描述学习体验
- 语言简洁有力，有画面感

## 输出 JSON 格式
{
  "description": "课程描述文本",
  "subject": "推断的学科分类，2-4个字，如：编程 / 设计 / 金融 / 管理",
  "storyName": "故事名称，2-6个字，给这个课程/故事起一个简洁有吸引力的名字，如：税务之旅 / K线探秘",
  "objectives": ["学习目标1", "学习目标2", "学习目标3"]
}`

    const userPrompt = `课程名称：${title}
学科分类：${subject || '未指定'}
难度：${DIFFICULTY_LABELS[difficulty] || difficulty}
学习目标：${objectives?.length > 0 ? objectives.join('；') : '未设定'}

请生成课程描述、学科分类、图标和学习目标。`

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
    return NextResponse.json({
      description: (parsed.description || raw).trim(),
      subject: parsed.subject || '',
      storyName: parsed.storyName || '',
      objectives: Array.isArray(parsed.objectives) ? parsed.objectives : [],
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[learn/generate-description] error:', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
