import OpenAI from 'openai'
import { StoryResponse, LLMConfig, Mood } from './types'

function parseStoryResponse(raw: string): StoryResponse {
  const cleaned = raw
    .replace(/```(?:json)?\s*/g, '')
    .replace(/\s*```/g, '')
    .trim()

  const parsed = JSON.parse(cleaned)

  const validMoods: Mood[] = ['dark', 'mysterious', 'tense', 'peaceful', 'epic', 'sad', 'joyful', 'scary', 'calm']
  const mood = validMoods.includes(parsed.mood) ? parsed.mood as Mood : 'calm'

  return {
    scene: {
      id: crypto.randomUUID?.() || Math.random().toString(36).slice(2),
      narrative: parsed.narrative,
      imageUrl: '',
      imagePrompt: parsed.image_prompt,
    },
    choices: parsed.choices || [],
    mood,
    isEnding: parsed.is_ending || false,
    endingText: parsed.ending_text || null,
  }
}

export async function generateStory(
  systemPrompt: string,
  userPrompt: string,
  config: LLMConfig,
): Promise<StoryResponse> {
  const client = new OpenAI({
    baseURL: config.apiUrl.replace(/\/+$/, ''),
    apiKey: config.apiKey,
  })

  const response = await client.chat.completions.create({
    model: config.model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.9,
    response_format: { type: 'json_object' } as any,
  })

  const content = response.choices[0]?.message?.content
  if (!content) {
    throw new Error('LLM returned empty response')
  }

  return parseStoryResponse(content)
}

export async function generateImage(prompt: string, modelId?: string): Promise<string> {
  const baseUrl = (process.env.SEEDREAM_BASE_URL || '').replace(/\/+$/, '')
  const apiKey = process.env.SEEDREAM_API_KEY || ''

  if (!apiKey) {
    throw new Error('SEEDREAM_API_KEY not configured')
  }

  const url = `${baseUrl}/images/generations`

  const body: Record<string, unknown> = {
    model: modelId || process.env.SEEDREAM_MODEL || 'doubao-seedream-4-0-250828',
    prompt: prompt,
    size: '2K',
    response_format: 'url',
    sequential_image_generation: 'disabled',
    stream: false,
    watermark: false,
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Image API ${res.status}: ${text.slice(0, 300)}`)
  }

  const data = await res.json()
  const imageUrl = data.data?.[0]?.url

  if (!imageUrl) {
    throw new Error('Image generation returned no URL in response')
  }

  return imageUrl
}
