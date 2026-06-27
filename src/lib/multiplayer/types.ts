import type { GameState, Mood, StoryLength, Genre } from '@/lib/ai/types'

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
  /** The current lock — which scene/choice combo is being resolved */
  lockedUntil: number | null
  /** Id of the choice that "won" in the current round */
  resolvedChoiceId: string | null
  /** The shared game state (same shape as single-player) */
  gameState: GameState | null
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
