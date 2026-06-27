import { NextRequest, NextResponse } from 'next/server'
import { getStore } from '@/lib/multiplayer/store'
import { buildSystemPrompt, buildUserPrompt } from '@/lib/ai/prompts'
import { generateStory } from '@/lib/ai/client'
import { GENRE_NAMES, Genre, type LLMConfig, type GameState, type StoryLength, type Mood } from '@/lib/ai/types'

export async function POST(request: NextRequest) {
  try {
    const body: {
      roomCode: string
      playerId: string
      llmConfig: LLMConfig
    } = await request.json()

    const { roomCode, playerId, llmConfig } = body

    if (!roomCode || !playerId) {
      return NextResponse.json({ error: '参数不完整' }, { status: 400 })
    }
    if (!llmConfig?.apiUrl || !llmConfig?.model || !llmConfig?.apiKey) {
      return NextResponse.json({ error: 'LLM 配置不完整' }, { status: 400 })
    }

    const store = getStore()
    const room = await store.getRoom(roomCode.toUpperCase())
    if (!room) {
      return NextResponse.json({ error: '房间不存在' }, { status: 404 })
    }
    if (room.hostId !== playerId) {
      return NextResponse.json({ error: '只有房主可以开始游戏' }, { status: 403 })
    }
    if (room.status !== 'waiting') {
      return NextResponse.json({ error: '游戏已经开始或已结束' }, { status: 400 })
    }
    if (room.players.length < 1) {
      return NextResponse.json({ error: '至少需要一名玩家' }, { status: 400 })
    }

    // Generate the first scene
    const genre = room.gameState?.genre || 'mystery'
    const premise = room.gameState?.premise || ''
    const storyLength = room.gameState?.storyLength || 'medium'
    const genreName = GENRE_NAMES[genre as Genre] || genre

    const systemPrompt = buildSystemPrompt(genreName, storyLength)
    const userPrompt = buildUserPrompt(genreName, premise, [])

    const storyResult = await generateStory(systemPrompt, userPrompt, llmConfig)

    const now = Date.now()
    const gameState: GameState = {
      sessionId: roomCode,
      genre,
      title: room.gameState?.title || genre,
      premise,
      storyLength: storyLength as StoryLength,
      currentScene: storyResult.scene,
      currentChoices: storyResult.choices,
      currentMood: storyResult.mood as Mood,
      history: [],
      completedScenes: [],
      clues: storyResult.clues || [],
      companionThought: storyResult.companion_thought || '',
      companionRole: storyResult.companion_role || '',
      endingTitle: '',
      status: 'playing',
      endingText: null,
      startedAt: now,
      lastPlayedAt: now,
    }

    await store.updateGameState(roomCode.toUpperCase(), gameState)

    const updatedRoom = await store.getRoom(roomCode.toUpperCase())
    return NextResponse.json({ room: updatedRoom })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('Start game error:', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
