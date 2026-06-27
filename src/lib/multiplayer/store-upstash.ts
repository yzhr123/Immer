/**
 * Upstash Redis store — for production on Netlify/Vercel.
 *
 * Usage:
 *   1. Create a free Redis db at https://console.upstash.com
 *   2. Copy UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN into env
 *   3. Set MULTIPLAYER_STORE=upstash
 *
 * Install:
 *   npm install @upstash/redis
 */

import type { GameState } from '@/lib/ai/types'
import type { MPRoom, MPPlayer, RoomStatus, CreateRoomRequest } from './types'
import type { MultiplayerStore } from './store'

let RedisCtor: typeof import('@upstash/redis').Redis | null = null

function getRedis() {
  if (!RedisCtor) {
    // Dynamic require so the app doesn't break when @upstash/redis isn't installed
    try {
      RedisCtor = require('@upstash/redis').Redis
    } catch {
      throw new Error(
        'Upstash store requires @upstash/redis. Install: npm install @upstash/redis',
      )
    }
  }
  return new (RedisCtor!)({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  })
}

/* ---- helpers ---- */

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)]
  return code
}

function generateId(): string {
  return crypto.randomUUID?.() ?? Math.random().toString(36).slice(2, 15)
}

const ROOM_PREFIX = 'room:'
const LOCK_PREFIX = 'lock:'
const ROOM_TTL = 86_400 // 24h — auto-cleanup

export class UpstashStore implements MultiplayerStore {
  async createRoom(req: CreateRoomRequest): Promise<{ roomCode: string; playerId: string; room: MPRoom }> {
    const redis = getRedis()
    const playerId = generateId()
    let roomCode = generateCode()

    // Retry on collision
    for (let i = 0; i < 50; i++) {
      const exists = await redis.exists(`${ROOM_PREFIX}${roomCode}`)
      if (!exists) break
      roomCode = generateCode()
    }

    const now = Date.now()
    const room: MPRoom = {
      code: roomCode,
      hostId: playerId,
      players: [{ id: playerId, name: req.playerName, joinedAt: now }],
      status: 'waiting',
      lockedUntil: null,
      resolvedChoiceId: null,
      gameState: null,
      createdAt: now,
      lastActivityAt: now,
    }

    await redis.set(`${ROOM_PREFIX}${roomCode}`, JSON.stringify(room), { ex: ROOM_TTL })
    return { roomCode, playerId, room }
  }

  async joinRoom(roomCode: string, playerName: string): Promise<{ playerId: string; room: MPRoom }> {
    const redis = getRedis()
    const raw = await redis.get<string>(`${ROOM_PREFIX}${roomCode}`)
    if (!raw) throw new Error('Room not found')

    const room: MPRoom = JSON.parse(raw)
    if (room.status !== 'waiting') throw new Error('Game already started')

    const playerId = generateId()
    room.players.push({ id: playerId, name: playerName, joinedAt: Date.now() })
    room.lastActivityAt = Date.now()

    await redis.set(`${ROOM_PREFIX}${roomCode}`, JSON.stringify(room), { ex: ROOM_TTL })
    return { playerId, room }
  }

  async getRoom(roomCode: string): Promise<MPRoom | null> {
    const redis = getRedis()
    const raw = await redis.get<string>(`${ROOM_PREFIX}${roomCode}`)
    return raw ? JSON.parse(raw) : null
  }

  async submitChoice(
    roomCode: string,
    playerId: string,
    choiceId: string,
    _choiceText: string,
  ): Promise<{ accepted: boolean; room?: MPRoom; reason?: string }> {
    const redis = getRedis()

    // Atomic lock: SETNX with 60s expiry (should be enough for LLM)
    const lockKey = `${LOCK_PREFIX}${roomCode}`
    const locked = await redis.setnx(lockKey, playerId)
    if (locked === 0) {
      return { accepted: false, reason: 'Another player already made a choice' }
    }
    await redis.expire(lockKey, 60)

    try {
      const raw = await redis.get<string>(`${ROOM_PREFIX}${roomCode}`)
      if (!raw) return { accepted: false, reason: 'Room not found' }

      const room: MPRoom = JSON.parse(raw)
      if (!room.gameState) return { accepted: false, reason: 'Game not started' }
      if (room.status === 'completed') return { accepted: false, reason: 'Game already ended' }

      room.resolvedChoiceId = choiceId
      room.lastActivityAt = Date.now()
      await redis.set(`${ROOM_PREFIX}${roomCode}`, JSON.stringify(room), { ex: ROOM_TTL })

      return { accepted: true, room }
    } catch (e) {
      // Release lock on failure
      await redis.del(lockKey)
      throw e
    }
  }

  async updateGameState(roomCode: string, gameState: GameState): Promise<void> {
    const redis = getRedis()
    const raw = await redis.get<string>(`${ROOM_PREFIX}${roomCode}`)
    if (!raw) throw new Error('Room not found')

    const room: MPRoom = JSON.parse(raw)
    room.gameState = gameState
    room.resolvedChoiceId = null
    room.lockedUntil = null
    room.status = (gameState.status as RoomStatus) === 'completed' ? 'completed' : 'playing'
    room.lastActivityAt = Date.now()

    await redis.set(`${ROOM_PREFIX}${roomCode}`, JSON.stringify(room), { ex: ROOM_TTL })

    // Release lock
    await redis.del(`${LOCK_PREFIX}${roomCode}`)
  }

  async removePlayer(roomCode: string, playerId: string): Promise<void> {
    const redis = getRedis()
    const raw = await redis.get<string>(`${ROOM_PREFIX}${roomCode}`)
    if (!raw) return

    const room: MPRoom = JSON.parse(raw)
    room.players = room.players.filter((p) => p.id !== playerId)
    room.lastActivityAt = Date.now()
    await redis.set(`${ROOM_PREFIX}${roomCode}`, JSON.stringify(room), { ex: ROOM_TTL })
  }
}
