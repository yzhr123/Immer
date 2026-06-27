'use client'

import { create } from 'zustand'
import {
  LLMSettings,
  GameState,
  SavedGameMeta,
  Scene,
  Choice,
  ContextEntry,
  Mood,
} from './ai/types'

const LLM_SETTINGS_KEY = 'immer_llm_settings'
const SAVED_GAMES_KEY = 'immer_saved_games'
const BGM_KEY = 'immer_bgm_enabled'

function loadJson<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

function saveJson(key: string, value: unknown) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch { }
}

export function buildContext(game: GameState): ContextEntry[] {
  return game.completedScenes.map((s, i) => ({
    narrative: s.narrative,
    chosenText: game.history.find((h) => h.sceneId === s.id)?.choiceText || '',
    imagePrompt: s.imagePrompt,
    mood: game.history.length > i ? undefined : game.currentMood,
  }))
}

interface AppStore {
  llmSettings: LLMSettings
  setLLMSettings: (settings: LLMSettings) => void
  bgmEnabled: boolean
  setBgmEnabled: (v: boolean) => void
  game: GameState | null
  savedGames: SavedGameMeta[]

  initGame: (params: {
    sessionId: string
    genre: string
    title: string
    premise: string
  }) => void

  setCurrentScene: (
    scene: Scene,
    choices: Choice[],
    mood: Mood,
    isEnding: boolean,
    endingText: string | null,
  ) => void

  advanceToScene: (params: {
    scene: Scene
    choices: Choice[]
    mood: Mood
    historyEntry: { sceneId: string; choiceId: string; choiceText: string }
    isEnding: boolean
    endingText: string | null
  }) => void

  saveCurrentGame: () => void
  loadGame: (sessionId: string) => GameState | null
  deleteGame: (sessionId: string) => void
  refreshSavedGames: () => void
  clearGame: () => void
}

export const useStore = create<AppStore>((set, get) => ({
  llmSettings: loadJson<LLMSettings>(LLM_SETTINGS_KEY, {
    apiUrl: '',
    model: '',
    apiKey: '',
  }),
  game: null,
  bgmEnabled: loadJson<boolean>(BGM_KEY, true),
  savedGames: [],

  setBgmEnabled: (v) => {
    saveJson(BGM_KEY, v)
    set({ bgmEnabled: v })
  },

  setLLMSettings: (settings) => {
    saveJson(LLM_SETTINGS_KEY, settings)
    set({ llmSettings: settings })
  },

  initGame: (params) => {
    const now = Date.now()
    const game: GameState = {
      sessionId: params.sessionId,
      genre: params.genre,
      title: params.title,
      premise: params.premise,
      currentScene: null,
      currentChoices: [],
      currentMood: 'calm' as Mood,
      history: [],
      completedScenes: [],
      status: 'generating' as const,
      endingText: null,
      startedAt: now,
      lastPlayedAt: now,
    }
    set({ game })
  },

  setCurrentScene: (scene, choices, mood, isEnding, endingText) => {
    const { game } = get()
    if (!game) return
    set({
      game: {
        ...game,
        currentScene: scene,
        currentChoices: choices,
        currentMood: mood,
        status: isEnding ? 'completed' as const : 'playing' as const,
        endingText,
        lastPlayedAt: Date.now(),
      },
    })
  },

  advanceToScene: (params) => {
    const { game } = get()
    if (!game || !game.currentScene) return

    set({
      game: {
        ...game,
        currentScene: params.scene,
        currentChoices: params.choices,
        currentMood: params.mood,
        completedScenes: [...game.completedScenes, game.currentScene],
        history: [...game.history, params.historyEntry],
        status: params.isEnding ? 'completed' as const : 'playing' as const,
        endingText: params.endingText,
        lastPlayedAt: Date.now(),
      },
    })
  },

  saveCurrentGame: () => {
    const { game } = get()
    if (!game || !game.currentScene) return

    const savedGames = loadJson<SavedGameMeta[]>(SAVED_GAMES_KEY, [])
    const existing = savedGames.findIndex((g) => g.sessionId === game.sessionId)

    const meta: SavedGameMeta = {
      sessionId: game.sessionId,
      title: game.title,
      genre: game.genre,
      preview: game.currentScene.narrative.slice(0, 40) + '...',
      chapterCount: game.completedScenes.length + 1,
      lastPlayedAt: Date.now(),
    }

    const updated = existing >= 0
      ? savedGames.map((g, i) => (i === existing ? meta : g))
      : [meta, ...savedGames]

    saveJson(SAVED_GAMES_KEY, updated)
    saveJson(`immer_game_${game.sessionId}`, { ...game, lastPlayedAt: Date.now() })
    set({ savedGames: updated })
  },

  loadGame: (sessionId) => {
    return loadJson<GameState | null>(`immer_game_${sessionId}`, null)
  },

  deleteGame: (sessionId) => {
    const savedGames = loadJson<SavedGameMeta[]>(SAVED_GAMES_KEY, [])
    const updated = savedGames.filter((g) => g.sessionId !== sessionId)
    saveJson(SAVED_GAMES_KEY, updated)
    localStorage.removeItem(`immer_game_${sessionId}`)
    set({ savedGames: updated })
  },

  refreshSavedGames: () => {
    const savedGames = loadJson<SavedGameMeta[]>(SAVED_GAMES_KEY, [])
    set({ savedGames })
  },

  clearGame: () => {
    set({ game: null })
  },
}))
