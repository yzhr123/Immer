/**
 * Multiplayer Room Store
 *
 * ┌─ Abstraction: any store implementing `MultiplayerStore` can be swapped in.
 * ├─ MemoryStore   — in-memory + JSON file persistence (.data/multiplayer-store.json)
 * └─ UpstashRedis  — for production on Netlify/Vercel (serverless). Unused until you set up.
 *
 * To switch: set `MULTIPLAYER_STORE=upstash` and configure env vars below.
 */

import type { GameState, Mood, LLMConfig } from '@/lib/ai/types'
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

  submitChoice(
    roomCode: string,
    playerId: string,
    choiceId: string,
    choiceText: string,
  ): Promise<{ accepted: boolean; room?: MPRoom; reason?: string }>

  updateGameState(roomCode: string, gameState: GameState): Promise<void>
  removePlayer(roomCode: string, playerId: string): Promise<void>

  /** Store the host's LLM config server-side (never sent to clients) */
  setHostLLMConfig(roomCode: string, config: LLMConfig): Promise<void>
  /** Retrieve the host's LLM config */
  getHostLLMConfig(roomCode: string): Promise<LLMConfig | null>
}

/* ============================================================
 *  File persistence helpers
 * ============================================================ */

interface StoreSnapshot {
  rooms: Record<string, MPRoom>
  hostLLMConfigs: Record<string, LLMConfig>
}

const DATA_DIR = '.data'
const DATA_FILE = 'multiplayer-store.json'

function getDataFilePath(): string {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const path = require('path')
  return path.join(process.cwd(), DATA_DIR, DATA_FILE)
}

function loadSnapshot(): StoreSnapshot | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require('fs')
    const fp = getDataFilePath()
    if (!fs.existsSync(fp)) return null
    return JSON.parse(fs.readFileSync(fp, 'utf-8'))
  } catch {
    return null
  }
}

function saveSnapshot(data: StoreSnapshot): void {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require('fs')
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const path = require('path')
    const dir = path.join(process.cwd(), DATA_DIR)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(getDataFilePath(), JSON.stringify(data, null, 2))
  } catch (e) {
    console.error('Failed to persist multiplayer store:', e)
  }
}

/* ============================================================
 *  In-Memory implementation with file persistence
 * ============================================================ */

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)]
  return code
}

function generateId(): string {
  return crypto.randomUUID?.() ?? Math.random().toString(36).slice(2, 15)
}

export class MemoryStore implements MultiplayerStore {
  private rooms: Map<string, MPRoom>
  private hostLLMConfigs: Map<string, LLMConfig>

  constructor() {
    this.rooms = new Map()
    this.hostLLMConfigs = new Map()
    this.loadFromDisk()
  }

  private loadFromDisk(): void {
    const snap = loadSnapshot()
    if (!snap) return
    this.rooms = new Map(Object.entries(snap.rooms))
    this.hostLLMConfigs = new Map(Object.entries(snap.hostLLMConfigs || {}))
  }

  private persist(): void {
    const data: StoreSnapshot = {
      rooms: Object.fromEntries(this.rooms),
      hostLLMConfigs: Object.fromEntries(this.hostLLMConfigs),
    }
    saveSnapshot(data)
  }

  async setHostLLMConfig(roomCode: string, config: LLMConfig): Promise<void> {
    this.hostLLMConfigs.set(roomCode.toUpperCase(), config)
    this.persist()
  }

  async getHostLLMConfig(roomCode: string): Promise<LLMConfig | null> {
    return this.hostLLMConfigs.get(roomCode.toUpperCase()) ?? null
  }

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
    this.persist()
    return { roomCode, playerId, room }
  }

  async joinRoom(roomCode: string, playerName: string): Promise<{ playerId: string; room: MPRoom }> {
    const room = this.rooms.get(roomCode.toUpperCase())
    if (!room) throw new Error('Room not found')
    if (room.status !== 'waiting') throw new Error('Game already started')

    const playerId = generateId()
    room.players.push({ id: playerId, name: playerName, joinedAt: Date.now() })
    room.lastActivityAt = Date.now()
    this.persist()
    return { playerId, room }
  }

  async getRoom(roomCode: string): Promise<MPRoom | null> {
    return this.rooms.get(roomCode.toUpperCase()) ?? null
  }

  async submitChoice(
    roomCode: string,
    playerId: string,
    choiceId: string,
    _choiceText: string,
  ): Promise<{ accepted: boolean; room?: MPRoom; reason?: string }> {
    const room = this.rooms.get(roomCode.toUpperCase())
    if (!room) return { accepted: false, reason: 'Room not found' }
    if (!room.gameState) return { accepted: false, reason: 'Game not started' }
    if (room.status === 'completed') return { accepted: false, reason: 'Game already ended' }

    if (room.resolvedChoiceId !== null) {
      return { accepted: false, reason: 'Another player already made a choice' }
    }

    room.resolvedChoiceId = choiceId
    return { accepted: true, room }
  }

  async updateGameState(roomCode: string, gameState: GameState): Promise<void> {
    const room = this.rooms.get(roomCode.toUpperCase())
    if (!room) throw new Error('Room not found')

    room.gameState = gameState
    room.resolvedChoiceId = null
    room.lockedUntil = null
    room.status = (gameState.status as RoomStatus) === 'completed' ? 'completed' : 'playing'
    room.lastActivityAt = Date.now()
    this.persist()
  }

  async removePlayer(roomCode: string, playerId: string): Promise<void> {
    const room = this.rooms.get(roomCode.toUpperCase())
    if (!room) return
    room.players = room.players.filter((p) => p.id !== playerId)
    room.lastActivityAt = Date.now()
    this.persist()
  }

  /* ---- helpers ---- */

  private uniqueCode(): string {
    for (let i = 0; i < 100; i++) {
      const code = generateCode()
      if (!this.rooms.has(code)) return code
    }
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
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { UpstashStore } = require('./store-upstash') as { UpstashStore: new () => MultiplayerStore }
    _store = new UpstashStore()
  } else {
    _store = new MemoryStore()
  }

  return _store
}

export function resetStore(): void {
  _store = null
}
