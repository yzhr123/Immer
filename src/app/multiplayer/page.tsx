'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import GenreSelector from '@/components/GenreSelector'
import { useStore } from '@/lib/store'
import { GENRE_TITLES, StoryLength, LENGTH_LABELS } from '@/lib/ai/types'

type Tab = 'create' | 'join'

/* ============================================================
 *  Simple player name input used in both tabs
 * ============================================================ */

function PlayerNameInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Your name"
      maxLength={12}
      className="w-full text-center text-sm text-zinc-600 placeholder-zinc-300 bg-transparent border-b border-zinc-200 pb-2 focus:outline-none focus:border-zinc-600 transition-colors"
    />
  )
}

/* ============================================================
 *  Main Page
 * ============================================================ */

export default function MultiplayerLobby() {
  const router = useRouter()
  const { llmSettings } = useStore()
  const [tab, setTab] = useState<Tab>('create')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // create tab
  const [playerName, setPlayerName] = useState(() => {
    if (typeof window === 'undefined') return ''
    return localStorage.getItem('immer_mp_playerName') || ''
  })
  const [genre, setGenre] = useState<string | null>(null)
  const [premise, setPremise] = useState('')
  const [storyLength, setStoryLength] = useState<StoryLength>('medium')

  // join tab
  const [joinName, setJoinName] = useState(() => {
    if (typeof window === 'undefined') return ''
    return localStorage.getItem('immer_mp_playerName') || ''
  })
  const [roomCode, setRoomCode] = useState('')

  // persist name
  useEffect(() => {
    if (playerName) localStorage.setItem('immer_mp_playerName', playerName)
  }, [playerName])

  useEffect(() => {
    if (joinName) localStorage.setItem('immer_mp_playerName', joinName)
  }, [joinName])

  async function handleCreate() {
    if (!genre) return
    if (!playerName.trim()) {
      setError('请输入你的名字')
      return
    }
    if (!llmSettings.apiUrl || !llmSettings.apiKey) {
      setError('请先在 Settings 中配置 LLM API')
      return
    }

    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/multiplayer/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerName: playerName.trim(),
          genre,
          title: GENRE_TITLES[genre] || genre,
          premise,
          storyLength,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '创建失败')

      sessionStorage.setItem('immer_mp_playerId', data.playerId)
      router.push(`/multiplayer/room/${data.roomCode}`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '创建房间失败')
    } finally {
      setLoading(false)
    }
  }

  async function handleJoin() {
    const code = roomCode.trim().toUpperCase()
    if (!code) {
      setError('请输入房间号')
      return
    }
    if (!joinName.trim()) {
      setError('请输入你的名字')
      return
    }

    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/multiplayer/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomCode: code,
          playerName: joinName.trim(),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '加入失败')

      sessionStorage.setItem('immer_mp_playerId', data.playerId)
      router.push(`/multiplayer/room/${code}`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '加入房间失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col flex-1 items-center px-6 py-12">
      <div className="w-full max-w-lg flex flex-col items-center gap-10">

        {/* Back */}
        <div className="w-full">
          <button
            onClick={() => router.push('/lobby')}
            className="text-xs text-zinc-400 hover:text-zinc-800 transition-colors tracking-wider"
          >
            &lt; BACK
          </button>
        </div>

        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-light tracking-[0.15em] text-zinc-800">
            MULTIPLAYER
          </h1>
          <p className="text-xs text-zinc-400 tracking-wider">
            Share a story together
          </p>
        </div>

        {/* Tab toggle */}
        <div className="flex gap-6 text-sm tracking-wider">
          <button
            onClick={() => setTab('create')}
            className={`pb-1 transition-colors ${
              tab === 'create'
                ? 'text-zinc-800 border-b border-zinc-800'
                : 'text-zinc-400 hover:text-zinc-600'
            }`}
          >
            CREATE ROOM
          </button>
          <button
            onClick={() => setTab('join')}
            className={`pb-1 transition-colors ${
              tab === 'join'
                ? 'text-zinc-800 border-b border-zinc-800'
                : 'text-zinc-400 hover:text-zinc-600'
            }`}
          >
            JOIN ROOM
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="w-full text-xs text-red-400 text-center py-2 border border-red-100 rounded-sm">
            {error}
          </div>
        )}

        {/* ────────── Create Tab ────────── */}
        {tab === 'create' && (
          <div className="w-full flex flex-col gap-6">

            {/* Player Name */}
            <div className="w-full space-y-2">
              <p className="text-center text-xs text-zinc-400 tracking-widest">YOUR NAME</p>
              <PlayerNameInput value={playerName} onChange={setPlayerName} />
            </div>

            {/* Genre */}
            <div className="w-full space-y-3">
              <p className="text-center text-xs text-zinc-400 tracking-widest">GENRE</p>
              <GenreSelector selected={genre} onSelect={setGenre} />
            </div>

            {/* Story Length */}
            <div className="w-full space-y-3">
              <p className="text-center text-xs text-zinc-400 tracking-widest">STORY LENGTH</p>
              <div className="flex justify-center gap-3">
                {(['short', 'medium', 'long'] as StoryLength[]).map((len) => (
                  <button
                    key={len}
                    onClick={() => setStoryLength(len)}
                    className={`px-5 py-2 text-xs tracking-wider transition-all duration-200 rounded-sm ${
                      storyLength === len
                        ? 'bg-zinc-800 text-white'
                        : 'text-zinc-500 border border-zinc-200 hover:border-zinc-400'
                    }`}
                  >
                    {LENGTH_LABELS[len]}
                  </button>
                ))}
              </div>
            </div>

            {/* Premise */}
            <div className="w-full space-y-2">
              <p className="text-center text-xs text-zinc-400 tracking-widest">PREMISE (OPTIONAL)</p>
              <input
                type="text"
                value={premise}
                onChange={(e) => setPremise(e.target.value)}
                placeholder="A lone detective in a city that never sleeps..."
                className="w-full text-center text-sm text-zinc-600 placeholder-zinc-300 bg-transparent border-b border-zinc-200 pb-2 focus:outline-none focus:border-zinc-600 transition-colors"
              />
            </div>

            {/* Create Button */}
            <button
              onClick={handleCreate}
              disabled={!genre || loading}
              className="w-full py-3.5 text-sm tracking-widest border border-zinc-300
                text-zinc-600 hover:text-zinc-900 hover:border-zinc-800
                disabled:opacity-30 disabled:cursor-not-allowed
                transition-all duration-200 rounded-none"
            >
              {loading ? 'CREATING...' : genre ? 'CREATE ROOM' : 'SELECT A GENRE'}
            </button>
          </div>
        )}

        {/* ────────── Join Tab ────────── */}
        {tab === 'join' && (
          <div className="w-full flex flex-col gap-6">

            {/* Room Code */}
            <div className="w-full space-y-2">
              <p className="text-center text-xs text-zinc-400 tracking-widest">ROOM CODE</p>
              <input
                type="text"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase().slice(0, 6))}
                placeholder="e.g. XK4D"
                maxLength={6}
                className="w-full text-center text-lg tracking-[0.3em] text-zinc-700 placeholder-zinc-300 bg-transparent border-b border-zinc-200 pb-2 focus:outline-none focus:border-zinc-600 transition-colors"
                autoComplete="off"
              />
            </div>

            {/* Player Name */}
            <div className="w-full space-y-2">
              <p className="text-center text-xs text-zinc-400 tracking-widest">YOUR NAME</p>
              <PlayerNameInput value={joinName} onChange={setJoinName} />
            </div>

            {/* Join Button */}
            <button
              onClick={handleJoin}
              disabled={!roomCode.trim() || !joinName.trim() || loading}
              className="w-full py-3.5 text-sm tracking-widest border border-zinc-300
                text-zinc-600 hover:text-zinc-900 hover:border-zinc-800
                disabled:opacity-30 disabled:cursor-not-allowed
                transition-all duration-200 rounded-none"
            >
              {loading ? 'JOINING...' : 'JOIN ROOM'}
            </button>
          </div>
        )}

      </div>
    </div>
  )
}
