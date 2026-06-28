import { NextRequest, NextResponse } from 'next/server'
import { getStore } from '@/lib/multiplayer/store'
import { buildSystemPrompt, buildUserPrompt } from '@/lib/ai/prompts'
import { generateStory, generateImage } from '@/lib/ai/client'
import { GENRE_NAMES, Genre, type LLMConfig, type GameState, type StoryLength, type Mood, type ImageMode } from '@/lib/ai/types'
import { getImagePrice } from '@/lib/credit/store'
import { getCreditStore } from '@/lib/credit/store-server'

export async function POST(request: NextRequest) {
  try {
    const body: {
      roomCode: string
      playerId: string
      llmConfig: LLMConfig
      imageMode?: ImageMode
      imageModelId?: string
    } = await request.json()

    const { roomCode, playerId, llmConfig, imageMode = 'full', imageModelId } = body

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

    const genre = room.genre || 'mystery'
    const premise = room.premise || ''
    const storyLength = room.storyLength || 'medium'
    const genreName = GENRE_NAMES[genre as Genre] || genre

    const systemPrompt = buildSystemPrompt(genreName, storyLength)
    const userPrompt = buildUserPrompt(genreName, premise, [])

    const storyResult = await generateStory(systemPrompt, userPrompt, llmConfig)

    let imageError = ''
    if (imageMode !== 'none' && storyResult.scene.imagePrompt) {
      const creditPrice = imageMode === 'full' ? getImagePrice('full') : getImagePrice('lazy')
      const creditStore = getCreditStore()
      const deduct = await creditStore.deductCredits(playerId, creditPrice, `多人开局-图片生成(${imageMode})`)
      if (!deduct.success) {
        imageError = deduct.reason || '余额不足'
      } else {
        try {
          storyResult.scene.imageUrl = await generateImage(storyResult.scene.imagePrompt, imageModelId)
        } catch (imgErr: unknown) {
          imageError = imgErr instanceof Error ? imgErr.message : 'Image generation failed'
          console.error('Multiplayer start image error:', imageError)
        }
      }
    }

    const now = Date.now()
    const gameState: GameState = {
      sessionId: roomCode,
      genre,
      title: room.title || genre,
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

    await store.setHostLLMConfig(roomCode.toUpperCase(), llmConfig)
    const savedRoom = await store.getRoom(roomCode.toUpperCase())
    if (savedRoom) {
      savedRoom.hostImageMode = imageMode
      savedRoom.hostImageModelId = imageModelId
    }

    const updatedRoom = await store.getRoom(roomCode.toUpperCase())
    return NextResponse.json({ room: updatedRoom, imageError: imageError || undefined })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('Start game error:', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
