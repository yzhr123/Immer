'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import type {
  MPRoom,
  CreateRoomRequest,
  CreateRoomResponse,
  JoinRoomRequest,
  JoinRoomResponse,
  SubmitChoiceRequest,
  SubmitChoiceResponse,
  PollStateResponse,
} from './types'
import type { LLMConfig } from '@/lib/ai/types'

/* ============================================================
 *  Storage keys
 * ============================================================ */

const PLAYER_ID_KEY = 'immer_mp_playerId'
const PLAYER_NAME_KEY = 'immer_mp_playerName'

function getStoredPlayerId(): string | null {
  if (typeof window === 'undefined') return null
  return sessionStorage.getItem(PLAYER_ID_KEY)
}

function setStoredPlayerId(id: string) {
  sessionStorage.setItem(PLAYER_ID_KEY, id)
}

function getStoredPlayerName(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(PLAYER_NAME_KEY)
}

function setStoredPlayerName(name: string) {
  localStorage.setItem(PLAYER_NAME_KEY, name)
}

/* ============================================================
 *  Raw API calls
 * ============================================================ */

async function apiPost<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json()
  if (!res.ok) throw new Error((data as any).error || `Request failed (${res.status})`)
  return data as T
}

async function apiGet<T>(url: string): Promise<T> {
  const res = await fetch(url)
  const data = await res.json()
  if (!res.ok) throw new Error((data as any).error || `Request failed (${res.status})`)
  return data as T
}

/* ============================================================
 *  Public API functions
 * ============================================================ */

export async function apiCreateRoom(req: CreateRoomRequest): Promise<CreateRoomResponse> {
  return apiPost<CreateRoomResponse>('/api/multiplayer/create', req)
}

export async function apiJoinRoom(req: JoinRoomRequest): Promise<JoinRoomResponse> {
  return apiPost<JoinRoomResponse>('/api/multiplayer/join', req)
}

export async function apiSubmitChoice(
  req: SubmitChoiceRequest & { llmConfig: LLMConfig },
): Promise<SubmitChoiceResponse> {
  return apiPost<SubmitChoiceResponse>('/api/multiplayer/choice', req)
}

export async function apiStartGame(roomCode: string, playerId: string, llmConfig: LLMConfig): Promise<{ room: MPRoom }> {
  return apiPost('/api/multiplayer/start', { roomCode, playerId, llmConfig })
}

export async function apiPollState(roomCode: string): Promise<PollStateResponse> {
  return apiGet<PollStateResponse>(`/api/multiplayer/state?roomCode=${encodeURIComponent(roomCode)}`)
}

/* ============================================================
 *  React Hook
 * ============================================================ */

export interface UseMultiplayerOptions {
  /** The room code to join. Pass null/undefined when not in a room. */
  roomCode: string | null | undefined
  /** Whether to auto-poll */
  poll?: boolean
  /** Poll interval in ms (default 3000) */
  pollInterval?: number
}

export interface UseMultiplayerReturn {
  /** Current room data (null while loading / not in a room) */
  room: MPRoom | null
  /** This player's ID (persists in sessionStorage) */
  playerId: string | null
  /** This player's name (persists in localStorage) */
  playerName: string | null
  /** Whether this player is the host */
  isHost: boolean
  /** Whether the lobby is waiting for players */
  isWaiting: boolean
  /** Whether the game is in progress */
  isPlaying: boolean
  /** Whether the game ended */
  isCompleted: boolean
  /** The shared game state (null before game starts) */
  gameState: MPRoom['gameState']

  /** Create a new room */
  createRoom: (req: CreateRoomRequest) => Promise<{ roomCode: string }>
  /** Join an existing room */
  joinRoom: (name: string) => Promise<void>
  /** Submit a choice (first-to-choose) */
  submitChoice: (choiceId: string) => Promise<SubmitChoiceResponse>
  /** Start the game (host only) — generates the first scene */
  startGame: () => Promise<void>
  /** Leave the current room */
  leaveRoom: () => void
  /** Set player name (persisted) */
  setPlayerName: (name: string) => void
  /** Manually trigger a poll */
  refresh: () => Promise<void>

  /** Loading state for the current action */
  loading: boolean
  /** Error message */
  error: string | null
  /** Clear error */
  clearError: () => void
}

export function useMultiplayer(options?: UseMultiplayerOptions): UseMultiplayerReturn {
  const { roomCode = null, poll = true, pollInterval = 3000 } = options ?? {} as UseMultiplayerOptions

  const router = useRouter()
  const [room, setRoom] = useState<MPRoom | null>(null)
  const [playerId, setPlayerId] = useState<string | null>(getStoredPlayerId)
  const [playerName, setPlayerNameState] = useState<string | null>(getStoredPlayerName)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const lastFetchRef = useRef<number>(0)

  const setPlayerName = useCallback((name: string) => {
    setStoredPlayerName(name)
    setPlayerNameState(name)
  }, [])

  const clearError = useCallback(() => setError(null), [])

  // Derived state
  const isHost = playerId !== null && room !== null && room.hostId === playerId
  const isWaiting = room !== null && room.status === 'waiting'
  const isPlaying = room !== null && room.status === 'playing'
  const isCompleted = room !== null && room.status === 'completed'
  const gameState = room?.gameState ?? null

  /* ---- Polling ---- */

  const refresh = useCallback(async () => {
    if (!roomCode) return
    try {
      const data = await apiPollState(roomCode)
      setRoom(data.room)
      lastFetchRef.current = data.ts
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Poll failed'
      // Don't show transient poll errors to user, but log them
      console.error('[MP poll]', msg)
    }
  }, [roomCode])

  // Start/stop polling based on roomCode and poll flag
  useEffect(() => {
    if (!roomCode || !poll) {
      if (pollingRef.current) {
        clearInterval(pollingRef.current)
        pollingRef.current = null
      }
      return
    }

    // Initial fetch
    refresh()

    // Periodic polling
    pollingRef.current = setInterval(refresh, pollInterval)
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current)
        pollingRef.current = null
      }
    }
  }, [roomCode, poll, pollInterval, refresh])

  /* ---- Actions ---- */

  const createRoom = useCallback(async (req: CreateRoomRequest): Promise<{ roomCode: string }> => {
    setLoading(true)
    setError(null)
    try {
      // Generate a host playerId if we don't have one
      const playerName = req.playerName || 'Host'
      setStoredPlayerName(playerName)
      setPlayerNameState(playerName)

      const result = await apiCreateRoom(req)
      setStoredPlayerId(result.playerId)
      setPlayerId(result.playerId)
      setRoom(result.room)
      return { roomCode: result.roomCode }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '创建房间失败'
      setError(msg)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  const joinRoomAction = useCallback(async (name: string) => {
    if (!roomCode) return
    setLoading(true)
    setError(null)
    try {
      const result = await apiJoinRoom({ roomCode, playerName: name })
      setStoredPlayerId(result.playerId)
      setPlayerId(result.playerId)
      setStoredPlayerName(name)
      setPlayerNameState(name)
      setRoom(result.room)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '加入房间失败'
      setError(msg)
      throw err
    } finally {
      setLoading(false)
    }
  }, [roomCode])

  const startGame = useCallback(async () => {
    if (!roomCode || !playerId) return
    setLoading(true)
    setError(null)
    try {
      const llmConfig = loadLLMSettings()
      const result = await apiStartGame(roomCode, playerId, llmConfig)
      setRoom(result.room)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '开始游戏失败'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }, [roomCode, playerId])

  const submitChoice = useCallback(async (choiceId: string): Promise<SubmitChoiceResponse> => {
    if (!roomCode || !playerId || !room?.gameState) {
      return { accepted: false, reason: 'Not in a game' }
    }

    setLoading(true)
    setError(null)
    try {
      // Get LLM config from localStorage (same as single-player)
      const llmSettings = loadLLMSettings()

      const result = await apiSubmitChoice({
        roomCode,
        playerId,
        choiceId,
        llmConfig: llmSettings,
      })

      if (result.accepted && result.room) {
        setRoom(result.room)
      }

      return result
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '提交选项失败'
      setError(msg)
      return { accepted: false, reason: msg }
    } finally {
      setLoading(false)
    }
  }, [roomCode, playerId, room?.gameState])

  const leaveRoom = useCallback(() => {
    setRoom(null)
    // Don't clear playerId so they can rejoin
    if (pollingRef.current) {
      clearInterval(pollingRef.current)
      pollingRef.current = null
    }
    router.push('/multiplayer')
  }, [router])

  return {
    room,
    playerId,
    playerName,
    isHost,
    isWaiting,
    isPlaying,
    isCompleted,
    gameState,
    createRoom,
    joinRoom: joinRoomAction,
    submitChoice,
    startGame,
    leaveRoom,
    setPlayerName,
    refresh,
    loading,
    error,
    clearError,
  }
}

/* ---- helpers ---- */

function loadLLMSettings(): LLMConfig {
  if (typeof window === 'undefined') return { apiUrl: '', model: '', apiKey: '' }
  try {
    const raw = localStorage.getItem('immer_llm_settings')
    if (!raw) return { apiUrl: '', model: '', apiKey: '' }
    return JSON.parse(raw)
  } catch {
    return { apiUrl: '', model: '', apiKey: '' }
  }
}
