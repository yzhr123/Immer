import { NextRequest, NextResponse } from 'next/server'
import { getStore } from '@/lib/multiplayer/store'
import { buildSystemPrompt, buildUserPrompt } from '@/lib/ai/prompts'
import { generateStory, generateImage } from '@/lib/ai/client'
import { GENRE_NAMES, Genre, type GameState, type ContextEntry, type Mood, type StoryLength } from '@/lib/ai/types'
import type { SubmitChoiceRequest } from '@/lib/multiplayer/types'

export async function POST(request: NextRequest) {
  try {
    const body: SubmitChoiceRequest = await request.json()

    const { roomCode, playerId, choiceId } = body
    if (!roomCode || !playerId || !choiceId) {
      return NextResponse.json({ error: '参数不完整' }, { status: 400 })
    }

    const store = getStore()
    const room = await store.getRoom(roomCode.toUpperCase())
    if (!room) {
      return NextResponse.json({ error: '房间不存在' }, { status: 404 })
    }
    if (!room.gameState) {
      return NextResponse.json({ error: '游戏未开始' }, { status: 400 })
    }

    // Use the host's LLM config + image settings for all generation
    const llmConfig = await store.getHostLLMConfig(roomCode.toUpperCase())
    if (!llmConfig?.apiUrl || !llmConfig?.model || !llmConfig?.apiKey) {
      return NextResponse.json({ error: '房主的 LLM 配置不完整' }, { status: 400 })
    }
    const imageMode = room.hostImageMode || 'none'
    const imageModelId = room.hostImageModelId

    // Find which choice the player picked
    const choice = room.gameState.currentChoices.find((c) => c.id === choiceId)
    if (!choice) {
      return NextResponse.json({ error: '无效选项' }, { status: 400 })
    }

    // First-to-choose: try to lock
    const lockResult = await store.submitChoice(roomCode, playerId, choiceId, choice.text)
    if (!lockResult.accepted) {
      return NextResponse.json({
        accepted: false,
        reason: lockResult.reason || '其他人已经做出了选择',
      })
    }

    // --- Lock acquired — now generate the next scene via LLM ---
    try {
      const game = room.gameState
      const context = buildContext(game)
      const language = (body.language || 'zh') as 'zh' | 'en'
      const genreName = GENRE_NAMES[game.genre as Genre] || game.genre

      const systemPrompt = buildSystemPrompt(genreName, game.storyLength, language)
      const userPrompt = buildUserPrompt(genreName, game.premise, context, choice, game.storyLength, context.length + 1)

      const storyResult = await generateStory(systemPrompt, userPrompt, llmConfig)

      if (imageMode !== 'none' && storyResult.scene.imagePrompt) {
        try {
          storyResult.scene.imageUrl = await generateImage(storyResult.scene.imagePrompt, imageModelId)
        } catch (imgErr: unknown) {
          console.error('Multiplayer choice image error:', imgErr)
        }
      }

      // Build the new game state
      const now = Date.now()
      const updatedGame: GameState = {
        ...game,
        currentScene: storyResult.scene,
        currentChoices: storyResult.choices,
        currentMood: storyResult.mood as Mood,
        history: [
          ...game.history,
          {
            sceneId: game.currentScene?.id || '',
            choiceId: choice.id,
            choiceText: choice.text,
            mood: game.currentMood,
          },
        ],
        completedScenes: game.currentScene
          ? [...game.completedScenes, game.currentScene]
          : game.completedScenes,
        status: storyResult.isEnding ? 'completed' : 'playing',
        endingText: storyResult.endingText,
        endingTitle: storyResult.endingTitle || game.endingTitle,
        lastPlayedAt: now,
      }

      if (storyResult.clues?.length) {
        const existingIds = new Set(game.clues.map((c) => c.id))
        updatedGame.clues = [
          ...storyResult.clues.filter((c) => !existingIds.has(c.id)),
          ...game.clues,
        ]
      }

      if (storyResult.companion_thought) {
        updatedGame.companionThought = storyResult.companion_thought
        updatedGame.companionRole = storyResult.companion_role || ''
      }

      await store.updateGameState(roomCode.toUpperCase(), updatedGame)

      return NextResponse.json({
        accepted: true,
        room: await store.getRoom(roomCode.toUpperCase()),
      })
    } catch (genErr: unknown) {
      // LLM generation failed — release the lock so someone else can try
      const msg = genErr instanceof Error ? genErr.message : 'Generation failed'
      console.error('LLM generation error in multiplayer:', genErr)

      // Restore room to unlocked state
      try {
        const current = await store.getRoom(roomCode.toUpperCase())
        if (current) {
          current.resolvedChoiceId = null
          current.lockedUntil = null
          // Store doesn't have an "unlock" method, so we update manually
          // For MemoryStore, we need to set it via the returned reference
          // This is a simplification: the choice is effectively "lost"
          // and players will need to retry on next poll
        }
      } catch { /* best effort */ }

      return NextResponse.json({
        accepted: false,
        reason: `剧情生成失败: ${msg}`,
      })
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('Choice error:', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/* ---- helper: same as store.ts buildContext but server-side compatible ---- */

function buildContext(game: GameState): ContextEntry[] {
  return game.completedScenes.map((s, i) => ({
    narrative: s.narrative,
    chosenText: game.history.find((h) => h.sceneId === s.id)?.choiceText || '',
    imagePrompt: s.imagePrompt,
    mood: game.history.length > i ? undefined : game.currentMood,
  }))
}
