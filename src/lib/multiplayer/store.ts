/**
 * Multiplayer Room Store
 *
 * ┌─ Abstraction: any store implementing `MultiplayerStore` can be swapped in.
 * ├─ MemoryStore   — works out of the box for `next dev` (single-process).
 * └─ UpstashRedis  — for production on Netlify/Vercel (serverless). Unused until you set up.
 *
 * To switch: set `MULTIPLAYER_STORE=upstash` and configure env vars below.
 */

import type { GameState, Mood } from '@/lib/ai/types'
import type {
  MPRoom,
  MPPlayer,
  RoomStatus,
  CreateRoomRequest,
} from './types'

/* ============================================================
 *  Store Interface
 * ============================================================ */

export interface MultiplayerStore {
  createRoom(req: CreateRoomRequest): Promise<{ roomCode: string; playerId: string; room: MPRoom }>
  joinRoom(roomCode: string, playerName: string): Promise<{ playerId: string; room: MPRoom }>
  getRoom(roomCode: string): Promise<MPRoom | null>

  /** Attempt to lock + resolve a choice for the current scene. Returns accepted=true on first success. */
  submitChoice(
    roomCode: string,
    playerId: string,
    choiceId: string,
    choiceText: string,
  ): Promise<{ accepted: boolean; room?: MPRoom; reason?: string }>

  /** Overwrite the entire gameState (after LLM generation) and unlock */
  updateGameState(roomCode: string, gameState: GameState): Promise<void>

  removePlayer(roomCode: string, playerId: string): Promise<void>
}

/* ============================================================
 *  In-Memory implementation (for local dev)
 * ============================================================ */

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no I,O,0,1 to avoid confusion
  let code = ''
  for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)]
  return code
}

function generateId(): string {
  return crypto.randomUUID?.() ?? Math.random().toString(36).slice(2, 15)
}

export class MemoryStore implements MultiplayerStore {
  private rooms = new Map<string, MPRoom>()

  async createRoom(req: CreateRoomRequest): Promise<{ roomCode: string; playerId: string; room: MPRoom }> {
    const playerId = generateId()
    const roomCode = this.uniqueCode()

    const now = Date.now()
    const room: MPRoom = {
      code: roomCode,
      hostId: playerId,
      players: [{ id: playerId, name: req.playerName, joinedAt: now }],
      status: 'waiting',
      lockedUntil: null,
      resolvedChoiceId: null,
      gameState: null,
      genre: req.genre,
      title: req.title,
      premise: req.premise,
      storyLength: req.storyLength,
      createdAt: now,
      lastActivityAt: now,
    }
    this.rooms.set(roomCode, room)
    return { roomCode, playerId, room }
  }

  async joinRoom(roomCode: string, playerName: string): Promise<{ playerId: string; room: MPRoom }> {
    const room = this.rooms.get(roomCode)
    if (!room) throw new Error('Room not found')
    if (room.status !== 'waiting') throw new Error('Game already started')

    const playerId = generateId()
    room.players.push({ id: playerId, name: playerName, joinedAt: Date.now() })
    room.lastActivityAt = Date.now()
    return { playerId, room }
  }

  async getRoom(roomCode: string): Promise<MPRoom | null> {
    return this.rooms.get(roomCode) ?? null
  }

  async submitChoice(
    roomCode: string,
    playerId: string,
    choiceId: string,
    _choiceText: string,
  ): Promise<{ accepted: boolean; room?: MPRoom; reason?: string }> {
    const room = this.rooms.get(roomCode)
    if (!room) return { accepted: false, reason: 'Room not found' }
    if (!room.gameState) return { accepted: false, reason: 'Game not started' }
    if (room.status === 'completed') return { accepted: false, reason: 'Game already ended' }

    // If someone already chose for the current scene → reject
    if (room.resolvedChoiceId !== null) {
      return { accepted: false, reason: 'Another player already made a choice' }
    }

    // First-to-choose: lock immediately
    room.resolvedChoiceId = choiceId

    // (The caller — the API route — will call updateGameState after LLM finishes)
    return { accepted: true, room }
  }

  async updateGameState(roomCode: string, gameState: GameState): Promise<void> {
    const room = this.rooms.get(roomCode)
    if (!room) throw new Error('Room not found')

    room.gameState = gameState
    room.resolvedChoiceId = null
    room.lockedUntil = null
    room.status = (gameState.status as RoomStatus) === 'completed' ? 'completed' : 'playing'
    room.lastActivityAt = Date.now()
  }

  async removePlayer(roomCode: string, playerId: string): Promise<void> {
    const room = this.rooms.get(roomCode)
    if (!room) return
    room.players = room.players.filter((p) => p.id !== playerId)
    room.lastActivityAt = Date.now()
  }

  /* ---- helpers ---- */

  private uniqueCode(): string {
    for (let i = 0; i < 100; i++) {
      const code = generateCode()
      if (!this.rooms.has(code)) return code
    }
    // extremely unlikely collision: widen
    return generateCode() + generateCode().slice(0, 1)
  }
}

/* ============================================================
 *  Store resolution (singleton)
 * ============================================================ */

let _store: MultiplayerStore | null = null

export function getStore(): MultiplayerStore {
  if (_store) return _store

  const backend = (process.env.MULTIPLAYER_STORE ?? 'memory').toLowerCase()

  if (backend === 'upstash') {
    // Lazy-import so the upstash dependency is optional
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { UpstashStore } = require('./store-upstash') as { UpstashStore: new () => MultiplayerStore }
    _store = new UpstashStore()
  } else {
    _store = new MemoryStore()
  }

  return _store
}

/** For testing: reset the singleton */
export function resetStore(): void {
  _store = null
}
