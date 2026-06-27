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
  ImageMode,
  Clue,
  StoryLength,
} from './ai/types'

const LLM_SETTINGS_KEY = 'immer_llm_settings'
const SAVED_GAMES_KEY = 'immer_saved_games'
const BGM_KEY = 'immer_bgm_enabled'
const IMAGE_MODE_KEY = 'immer_image_mode'
const COMPANION_KEY = 'immer_companion_enabled'
const LANGUAGE_KEY = 'immer_language'

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
  imageMode: ImageMode
  setImageMode: (v: ImageMode) => void
  companionEnabled: boolean
  setCompanionEnabled: (v: boolean) => void
  language: 'en' | 'zh'
  setLanguage: (v: 'en' | 'zh') => void
  game: GameState | null
  savedGames: SavedGameMeta[]

  initGame: (params: {
    sessionId: string
    genre: string
    title: string
    premise: string
    storyLength: StoryLength
  }) => void

  setCurrentScene: (
    scene: Scene,
    choices: Choice[],
    mood: Mood,
    isEnding: boolean,
    endingText: string | null,
    endingTitle?: string,
  ) => void

  advanceToScene: (params: {
    scene: Scene
    choices: Choice[]
    mood: Mood
    historyEntry: { sceneId: string; choiceId: string; choiceText: string; mood: Mood }
    isEnding: boolean
    endingText: string | null
    endingTitle?: string
  }) => void

  updateSceneImage: (imageUrl: string) => void
  addClues: (newClues: Clue[]) => void
  setCompanionState: (thought: string, role: string) => void
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
  imageMode: loadJson<ImageMode>(IMAGE_MODE_KEY, 'none'),
  companionEnabled: loadJson<boolean>(COMPANION_KEY, true),
  language: loadJson<'en' | 'zh'>(LANGUAGE_KEY, 'zh'),
  savedGames: [],

  setBgmEnabled: (v) => {
    saveJson(BGM_KEY, v)
    set({ bgmEnabled: v })
  },

  setImageMode: (v) => {
    saveJson(IMAGE_MODE_KEY, v)
    set({ imageMode: v })
  },

  setCompanionEnabled: (v) => {
    saveJson(COMPANION_KEY, v)
    set({ companionEnabled: v })
  },

  setLanguage: (v) => {
    saveJson(LANGUAGE_KEY, v)
    set({ language: v })
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
      storyLength: params.storyLength || 'medium',
      currentScene: null,
      currentChoices: [],
      currentMood: 'calm' as Mood,
      history: [],
      completedScenes: [],
      clues: [],
      companionThought: '',
      companionRole: '',
      endingTitle: '',
      status: 'generating' as const,
      endingText: null,
      startedAt: now,
      lastPlayedAt: now,
    }
    set({ game })
  },

  setCurrentScene: (scene, choices, mood, isEnding, endingText, endingTitle) => {
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
        endingTitle: endingTitle || game.endingTitle,
        lastPlayedAt: Date.now(),
      },
    })
  },

  advanceToScene: (params) => {
    const { game } = get()
    if (!game || !game.currentScene) return

    const update: Partial<GameState> = {
      currentScene: params.scene,
      currentChoices: params.choices,
      currentMood: params.mood,
      completedScenes: [...game.completedScenes, game.currentScene],
      history: [...game.history, params.historyEntry],
      status: params.isEnding ? 'completed' as const : 'playing' as const,
      endingText: params.endingText,
      lastPlayedAt: Date.now(),
    }
    if (params.isEnding && params.endingTitle) {
      update.endingTitle = params.endingTitle
    }

    set({ game: { ...game, ...update } })
  },

  updateSceneImage: (imageUrl) => {
    const { game } = get()
    if (!game || !game.currentScene) return
    set({
      game: {
        ...game,
        currentScene: { ...game.currentScene, imageUrl },
      },
    })
  },

  addClues: (newClues) => {
    const { game } = get()
    if (!game || newClues.length === 0) return
    const existingIds = new Set(game.clues.map(c => c.id))
    const trulyNew = newClues.filter(c => !existingIds.has(c.id))
    if (trulyNew.length === 0) return
    set({
      game: {
        ...game,
        clues: [...trulyNew, ...game.clues],
      },
    })
  },

  setCompanionState: (thought, role) => {
    const { game } = get()
    if (!game) return
    set({
      game: {
        ...game,
        companionThought: thought,
        companionRole: role,
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
