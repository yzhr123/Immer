import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { buildBetaProloguePrompt, buildBetaSystemPrompt, buildBetaUserPrompt } from '@/lib/ai/experimental/prompts'
import { generateStory } from '@/lib/ai/client'
import type { PrologueResponse, BetaSceneResponse } from '@/lib/ai/experimental/types'

/**
 * Beta 版生成 API
 *
 * body.phase === 'prologue' → 生成序章 + 角色
 * body.phase === 'scene'    → 生成后续场景（增强版）
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { phase, genre, premise, llmConfig } = body

    if (!llmConfig?.apiUrl || !llmConfig?.model || !llmConfig?.apiKey) {
      return NextResponse.json({ error: 'LLM 配置不完整' }, { status: 400 })
    }

    if (phase === 'prologue') {
      return handlePrologue(genre, premise, llmConfig)
    }

    if (phase === 'scene') {
      return handleScene(body)
    }

    return NextResponse.json({ error: '未知 phase' }, { status: 400 })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('Beta generate error:', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

async function handlePrologue(
  genre: string,
  premise: string,
  llmConfig: { apiUrl: string; model: string; apiKey: string },
) {
  const systemPrompt = buildBetaProloguePrompt(genre, premise)
  const userPrompt = `故事类型：${genre}\n故事初始设定：${premise}\n\n请生成开场引子（只描述起始场景，不要展开剧情）和可选的扮演角色。`

  // Call LLM directly — DO NOT use generateStory() because its parseStoryResponse
  // expects StoryResponse format (narrative/choices/mood) but the prologue prompt
  // outputs a different JSON schema (prologue/characterIdentity/characterOptions).
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
    temperature: 0.9,
    response_format: { type: 'json_object' } as any,
  })
  const content = response.choices[0]?.message?.content
  if (!content) {
    throw new Error('LLM returned empty response for prologue')
  }

  const cleaned = content.replace(/```(?:json)?\s*/g, '').replace(/\s*```/g, '').trim()
  let parsed: any
  try {
    parsed = JSON.parse(cleaned)
  } catch {
    return NextResponse.json({
      prologue: `故事开始于一个${genre}的世界。${premise}`,
      characterIdentity: deriveRole(genre, premise),
      characterBackground: `一个身处${genre}世界的角色`,
      characterOptions: [
        { id: 'char_1', identity: deriveRole(genre, premise), background: `一个身处${genre}世界的角色` },
      ],
    } satisfies PrologueResponse)
  }

  const options = parsed.characterOptions
  const singleChar = options?.length === 1 ? options[0] : null
  const identity = singleChar?.identity || parsed.characterIdentity || deriveRole(genre, premise)
  const background = singleChar?.background || parsed.characterBackground || `一个身处${genre}世界的角色`

  return NextResponse.json({
    prologue: parsed.prologue || `故事开始于一个${genre}的世界。${premise}`,
    characterIdentity: identity,
    characterBackground: background,
    characterOptions: options && options.length > 1 ? options : undefined,
  } satisfies PrologueResponse)
}

/** Derive a character role from genre and premise, instead of falling back to generic "主角" */
function deriveRole(genre: string, premise: string): string {
  // Extract a key noun/identity from the premise if available
  const match = premise.match(/(?:扮演|成为|饰演|作为)(?:一位|一个|一名)?\s*[，,]\s*([^，。]+)/)
  if (match) return match[1].trim()

  const genreRoles: Record<string, string> = {
    '玄幻': '修行者',
    '仙侠': '修士',
    '武侠': '侠客',
    '科幻': '探索者',
    '悬疑': '调查员',
    '推理': '侦探',
    '恐怖': '幸存者',
    '爱情': '旅人',
    '都市': '普通人',
    '历史': '见证者',
    '奇幻': '冒险者',
    '末日': '幸存者',
    '穿越': '穿越者',
    '系统': '宿主',
  }
  for (const [key, role] of Object.entries(genreRoles)) {
    if (genre.includes(key)) return role
  }
  return '旅人'
}

async function handleScene(body: any) {
  const {
    genre,
    premise,
    llmConfig,
    characterIdentity,
    characterBackground,
    storyPhase,
    sceneIndex,
    context,
    choice,
  } = body

  const systemPrompt = buildBetaSystemPrompt(
    genre,
    characterIdentity || '主角',
    characterBackground || '',
    storyPhase || 'beginning',
    sceneIndex || 1,
  )

  const userPrompt = buildBetaUserPrompt(
    genre,
    premise,
    characterIdentity || '主角',
    context || [],
    choice || undefined,
    storyPhase,
  )

  const raw = await generateStory(systemPrompt, userPrompt, llmConfig)
  const narrative = raw.scene?.narrative || ''
  const jsonMatch = narrative.match(/\{[\s\S]*\}/)
  let parsed: any = {}

  if (jsonMatch) {
    try {
      parsed = JSON.parse(jsonMatch[0])
    } catch { /* use raw fallback */ }
  }

  const choices = parsed.choices || raw.choices || [
    { id: 'a', text: '继续', type: 'choice' as const, allowCustom: false },
  ]

  return NextResponse.json({
    narrative: parsed.narrative || narrative,
    choices: choices.map((c: any) => ({
      id: c.id || 'a',
      text: c.text || '继续',
      type: c.type || 'choice',
      allowCustom: !!c.allowCustom,
    })),
    mood: parsed.mood || raw.mood || 'calm',
    isEnding: !!(parsed.is_ending || raw.isEnding),
    endingText: parsed.ending_text || raw.endingText || null,
    endingTitle: parsed.ending_title || raw.endingTitle || '',
    storyPhase: parsed.storyPhase || storyPhase || 'beginning',
    clues: parsed.clues || raw.clues || [],
    companionThought: parsed.companion_thought || raw.companion_thought || '',
    companionRole: parsed.companion_role || raw.companion_role || '',
  } satisfies BetaSceneResponse)
}
