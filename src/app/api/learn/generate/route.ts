import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { COURSES } from '@/learn/courses'
import type { LearnSceneResponse } from '@/learn/types'

const PHASE_LABELS: Record<string, string> = {
  concept: '概念导入阶段',
  scenario: '场景沉浸阶段',
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { courseId, nodeIndex, context, choices, phase, llmConfig, language, courseData } = body

    if (!llmConfig?.apiUrl || !llmConfig?.model || !llmConfig?.apiKey) {
      return NextResponse.json({ error: 'LLM 配置不完整' }, { status: 400 })
    }

    const builtin = COURSES.find((c) => c.id === courseId)
    const course = builtin || courseData
    if (!course) {
      return NextResponse.json({ error: '课程不存在' }, { status: 400 })
    }

    const narrativeLang = language === 'en' ? 'English' : '中文'

    const systemPrompt = `你是一位沉浸式互动教学大师。你正在设计「${course.title}」课程的教学内容。

## 课程信息
- 课程：${course.title}
- 学科：${course.subject}
- 学习目标：${course.objectives.join('、')}

## 当前阶段
${phase === 'concept' ? `
这是**概念导入阶段**。
- 通过场景化叙事引入新的知识点
- 只呈现信息，暂不涉及决策
- 语言要有画面感，让学员感受到"这是一个真实场景"
- 末尾给出一个明确的决策场景
` : `
这是**场景沉浸阶段**。
- 学员身处一个真实的业务场景中
- 每个决策节点都要有明确的知识点考核
- 无论学员选择什么，都要给出客观、专业的反馈
- 用真实的法规/数据/案例支撑反馈内容
`}

## 场景要求
- 必须是真实的、贴近实际的场景
- 场景要连贯——上一个场景的决策会影响当前场景的走向
- 涉及数字、日期、法规时，必须使用真实的数据
- 语言使用${narrativeLang}

## 选择生成规则
生成 2-3 个选项，每个选项必须包含：
- "id": "a" | "b" | "c"
- "text": 选项文字
- "isCorrect": true | false | null （标准答案标记，null 表示无对错）
- "explanation": 无论对错，都给出专业的解释，包含法规/理论依据

重要：不要所有选项都是正确的或都是错误的，确保有明确的对错区分。

## 知识点
每次生成 1-2 个本场景涉及的知识点。
格式：{ "id": "kp_xxx", "name": "知识点名称，如'增值税发票种类'" }

## 导师提示
- companionTip: 用导师口吻给一句提示或总结，1-2 句，${narrativeLang}

## 输出必须是严格的 JSON 格式：
{
  "narrative": "场景叙事正文，2-4 段${narrativeLang}",
  "choices": [
    { "id": "a", "text": "选项一", "isCorrect": true, "explanation": "专业解释..." },
    { "id": "b", "text": "选项二", "isCorrect": false, "explanation": "为什么不对..." }
  ],
  "knowledgePoints": [
    { "id": "kp_1", "name": "知识点名称" }
  ],
  "companionTip": "导师提示语",
  "isEnd": false,
  "summary": null,
  "score": null
}

## 教学原则
- 反馈要有教育意义——即使学员选对了，也补充为什么对
- 场景要推动故事发展——不要为了教学而打断叙事节奏
- 知识点要自然融入场景，不要生硬插入
- 如果场景连续，要考虑上一个选择对当前场景的影响
- 结尾阶段（isEnd: true）时，返回 summary 和 score（0-100），总结本次学习成果`

    const contextBlock = context.length > 0
      ? `\n\n=== 已有学习进度 ===\n${context.map((c: any, i: number) =>
          `[第${i + 1}步]\n${c.narrative}${c.chosenText ? `\n您的选择：${c.chosenText}` : ''}${c.feedback ? `\n反馈：${c.feedback}` : ''}`
        ).join('\n\n')}`
      : ''

    const userPrompt = `课程：${course.title}
当前进度：第 ${nodeIndex} 步 / 共 ${course.totalNodes} 步
${contextBlock}

${choices && choices.length > 0
  ? `学员刚刚做出了选择：${choices[choices.length - 1].text}\n请基于这个选择，生成接续的场景内容。`
  : '这是课程的开头，请生成引子场景，建立最初的场景设定。'
}

请生成当前步骤的教学场景。`

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
    console.log('[learn/generate] raw:', raw.slice(0, 200))

    const data: LearnSceneResponse = JSON.parse(raw)
    return NextResponse.json(data)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[learn/generate] error:', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
