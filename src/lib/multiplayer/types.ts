import type { GameState, Mood, StoryLength, Genre, ImageMode } from '@/lib/ai/types'

export interface MPPlayer {
  id: string
  name: string
  joinedAt: number
}

export type RoomStatus = 'waiting' | 'playing' | 'completed'

export interface MPRoom {
  code: string
  hostId: string
  players: MPPlayer[]
  status: RoomStatus
  lockedUntil: number | null
  resolvedChoiceId: string | null
  gameState: GameState | null
  genre: string
  title: string
  premise: string
  storyLength: StoryLength
  /** Host's image mode — used for all players in the room */
  hostImageMode?: ImageMode
  /** Host's image model ID */
  hostImageModelId?: string
  createdAt: number
  lastActivityAt: number
}

export interface CreateRoomRequest {
  playerName: string
  genre: string
  title: string
  premise: string
  storyLength: StoryLength
}

export interface CreateRoomResponse {
  roomCode: string
  playerId: string
  room: MPRoom
}

export interface JoinRoomRequest {
  roomCode: string
  playerName: string
}

export interface JoinRoomResponse {
  playerId: string
  room: MPRoom
}

export interface SubmitChoiceRequest {
  roomCode: string
  playerId: string
  choiceId: string
}

export interface SubmitChoiceResponse {
  accepted: boolean
  /** Only when accepted=true — the updated room after LLM resolves */
  room?: MPRoom
  /** When accepted=false — why it was rejected */
  reason?: string
}

export interface PollStateResponse {
  room: MPRoom
  /** server timestamp for staleness check */
  ts: number
}
