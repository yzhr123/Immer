import type { Mood, Clue } from '@/lib/ai/types'

/** 角色定义 */
export interface CharacterDef {
  id: string
  identity: string // 角色身份/称号
  background: string // 一句话背景
}

/** 弹性选项 */
export interface BetaChoice {
  id: string
  text: string
  type: 'choice' | 'transition'
  allowCustom?: boolean // 是否允许用户自定义输入
}

/** 序章生成响应 */
export interface PrologueResponse {
  prologue: string
  characterIdentity: string
  characterBackground: string
  characterOptions?: CharacterDef[]
}

/** Beta 版场景响应（后续幕） */
export interface BetaSceneResponse {
  narrative: string
  choices: BetaChoice[]
  mood: Mood
  isEnding: boolean
  endingText: string | null
  endingTitle: string
  storyPhase: 'beginning' | 'development' | 'climax' | 'ending'
  clues: Clue[]
  companionThought: string
  companionRole: string
}

/** Beta 阶段 */
export type BetaPhase =
  | 'generating-prologue'
  | 'choosing-character'
  | 'playing-prologue'
  | 'playing'
  | 'completed'
