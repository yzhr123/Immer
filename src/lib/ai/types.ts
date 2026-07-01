export type Mood = 'dark' | 'mysterious' | 'tense' | 'peaceful' | 'epic' | 'sad' | 'joyful' | 'scary' | 'calm'

export type ClueType = 'letter' | 'photo' | 'note' | 'diary' | 'document' | 'recording' | 'object'

export interface Clue {
  id: string
  type: ClueType
  title: string
  summary: string
  content: string
  sceneId: string
}

export interface Scene {
  id: string
  narrative: string
  imageUrl: string
  imagePrompt: string
  clues: Clue[]
}

export interface Choice {
  id: string
  text: string
}

export interface StoryResponse {
  scene: Scene
  choices: Choice[]
  mood: Mood
  isEnding: boolean
  endingText: string | null
  endingTitle: string
  keywords: string[]
  clues: Clue[]
  companion_thought: string
  companion_role: string
}

export interface LLMConfig {
  apiUrl: string
  model: string
  apiKey: string
  imageModelId?: string
}

export interface ContextEntry {
  narrative: string
  chosenText: string
  imagePrompt?: string
  mood?: Mood
}

export interface BranchRequest {
  genre: string
  premise: string
  context: ContextEntry[]
  choice: { id: string; text: string }
  llmConfig: LLMConfig
}

export interface BranchState {
  choiceId: string
  choiceText: string
  scene: Scene | null
  choices: Choice[]
  mood: Mood
  isEnding: boolean
  endingText: string | null
  endingTitle: string
  keywords: string[]
  clues: Clue[]
  companionThought: string
  companionRole: string
  status: 'generating' | 'ready' | 'error'
  error?: string
}

export interface HistoryEntry {
  sceneId: string
  choiceId: string
  choiceText: string
  mood: Mood
}

export interface GameState {
  sessionId: string
  genre: string
  title: string
  premise: string
  storyLength: StoryLength
  currentScene: Scene | null
  currentChoices: Choice[]
  currentMood: Mood
  history: HistoryEntry[]
  completedScenes: Scene[]
  clues: Clue[]
  companionThought: string
  companionRole: string
  endingTitle: string
  status: 'playing' | 'generating' | 'completed'
  // Beta 版附加字段
  isBeta?: boolean
  characterIdentity?: string
  characterBackground?: string
  storyPhase?: 'beginning' | 'development' | 'climax' | 'ending'
  endingText: string | null
  startedAt: number
  lastPlayedAt: number
}

export interface SavedGameMeta {
  sessionId: string
  title: string
  genre: string
  preview: string
  chapterCount: number
  lastPlayedAt: number
}

export interface LLMSettings {
  apiUrl: string
  model: string
  apiKey: string
  imageModelId?: string
}

export type Genre =
  | 'fantasy'
  | 'sci-fi'
  | 'mystery'
  | 'historical'
  | 'horror'
  | 'martial-arts'

export type ImageMode = 'full' | 'lazy' | 'none'

export type StoryLength = 'short' | 'medium' | 'long'

export const GENRE_NAMES: Record<Genre, string> = {
  fantasy: '奇幻',
  'sci-fi': '科幻',
  mystery: '悬疑',
  historical: '历史',
  horror: '恐怖',
  'martial-arts': '武侠',
}

export const GENRE_TITLES: Record<string, string> = {
  fantasy: '奇幻之旅',
  'sci-fi': '星际迷航',
  mystery: '迷雾追踪',
  historical: '历史回响',
  horror: '暗影低语',
  'martial-arts': '江湖风云',
}

export const CLUE_TYPE_NAMES: Record<ClueType, string> = {
  letter: '信函',
  photo: '照片',
  note: '便条',
  diary: '日记',
  document: '文件',
  recording: '录音',
  object: '物品',
}

export const LENGTH_LABELS: Record<StoryLength, string> = {
  short: '短篇',
  medium: '中篇',
  long: '长篇',
}
