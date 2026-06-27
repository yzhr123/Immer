'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useMultiplayer } from '@/lib/multiplayer/client'
import { getTheme } from '@/lib/theme'
import type { Mood } from '@/lib/ai/types'
import SceneImage from '@/components/SceneImage'
import NarrativeText from '@/components/NarrativeText'
import ChoiceButton from '@/components/ChoiceButton'

/* ============================================================
 *  Room Page — Lobby + Game
 * ============================================================ */

export default function MultiplayerRoomPage() {
  const router = useRouter()
  const params = useParams()
  const roomCode = (params?.code as string)?.toUpperCase()

  const {
    room,
    playerId,
    playerName,
    isHost,
    isWaiting,
    isPlaying,
    isCompleted,
    gameState,
    joinRoom,
    startGame,
    submitChoice,
    leaveRoom,
    setPlayerName,
    loading,
    error,
    clearError,
  } = useMultiplayer({ roomCode })

  const [hasJoined, setHasJoined] = useState(false)
  const [joinName, setJoinName] = useState(() => {
    if (typeof window === 'undefined') return ''
    return localStorage.getItem('immer_mp_playerName') || ''
  })
  const [joinError, setJoinError] = useState('')

  // Game state
  const [typingDone, setTypingDone] = useState(false)
  const [waitingForLLM, setWaitingForLLM] = useState(false)
  const [choiceFeedback, setChoiceFeedback] = useState<string | null>(null)
  const [endingPhase, setEndingPhase] = useState<'none' | 'fade' | 'typing' | 'end'>('none')
  const [revealedText, setRevealedText] = useState('')
  const [typingComplete, setTypingComplete] = useState(false)
  const revealRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Check if already joined (playerId in sessionStorage)
  useEffect(() => {
    const stored = sessionStorage.getItem('immer_mp_playerId')
    if (stored && room) {
      const isInRoom = room.players.some((p) => p.id === stored)
      if (isInRoom) {
        setHasJoined(true)
      }
    }
  }, [room])

  // Auto-join when playerId is already in the room (page refresh recovery)
  useEffect(() => {
    if (!room || hasJoined) return
    const stored = sessionStorage.getItem('immer_mp_playerId')
    if (stored && room.players.some((p) => p.id === stored)) {
      setHasJoined(true)
    }
  }, [room, hasJoined])

  // Reset typing when scene changes
  useEffect(() => {
    if (gameState?.currentScene) {
      setTypingDone(false)
      setWaitingForLLM(false)
      setChoiceFeedback(null)
      setEndingPhase('none')
    }
  }, [gameState?.currentScene?.id])

  // Ending sequence
  useEffect(() => {
    if (isCompleted && typingDone && endingPhase === 'none') {
      const t = setTimeout(() => setEndingPhase('fade'), 800)
      return () => clearTimeout(t)
    }
  }, [isCompleted, typingDone, endingPhase])

  useEffect(() => {
    if (endingPhase !== 'fade') return
    const next = gameState?.endingText ? 'typing' : 'end'
    const t = setTimeout(() => setEndingPhase(next as any), 1500)
    return () => clearTimeout(t)
  }, [endingPhase, gameState?.endingText])

  useEffect(() => {
    if (endingPhase !== 'typing' || !gameState?.endingText) return
    let i = 0
    setTypingComplete(false)
    revealRef.current = setInterval(() => {
      i++
      setRevealedText(gameState.endingText!.slice(0, i))
      if (i >= gameState.endingText!.length) {
        clearInterval(revealRef.current!)
        revealRef.current = null
        setTypingComplete(true)
      }
    }, 50)
    return () => {
      if (revealRef.current) clearInterval(revealRef.current)
    }
  }, [endingPhase, gameState?.endingText])

  /* ---- Auto-dismiss errors ---- */
  useEffect(() => {
    if (!error && !choiceFeedback) return
    const t = setTimeout(() => {
      clearError()
      setChoiceFeedback(null)
    }, 4000)
    return () => clearTimeout(t)
  }, [error, choiceFeedback, clearError])

  /* ---- Handlers ---- */

  const handleJoin = useCallback(async () => {
    if (!joinName.trim()) {
      setJoinError('请输入你的名字')
      return
    }
    setJoinError('')
    try {
      await joinRoom(joinName.trim())
      setHasJoined(true)
    } catch (err: unknown) {
      setJoinError(err instanceof Error ? err.message : '加入失败')
    }
  }, [joinName, joinRoom])

  const handleChoice = useCallback(async (choiceId: string) => {
    if (waitingForLLM) return
    setWaitingForLLM(true)
    setChoiceFeedback(null)

    const result = await submitChoice(choiceId)

    if (result.accepted) {
      setChoiceFeedback('Your choice was accepted!')
    } else {
      setChoiceFeedback(result.reason || 'Someone else chose first')
    }
    setWaitingForLLM(false)
  }, [submitChoice, waitingForLLM])

  const handleRestart = useCallback(() => {
    leaveRoom()
  }, [leaveRoom])

  /* ---- Derived ---- */

  const currentMood: Mood = gameState?.currentMood || 'calm'
  const theme = getTheme(currentMood)

  const currentScene = gameState?.currentScene
  const choices = gameState?.currentChoices || []
  const players = room?.players || []
  const otherPlayersChose = room?.resolvedChoiceId !== null && !waitingForLLM

  /* ============================================================
   *  Not in room → join screen
   * ============================================================ */

  if (!hasJoined) {
    return (
      <div className="flex flex-col flex-1 items-center justify-center px-6">
        <div className="w-full max-w-md flex flex-col items-center gap-8">
          <div className="text-center space-y-2">
            <p className="text-xs text-zinc-400 tracking-widest">JOIN ROOM</p>
            <p className="text-3xl tracking-[0.3em] text-zinc-700 font-mono">
              {roomCode}
            </p>
          </div>

          <input
            type="text"
            value={joinName}
            onChange={(e) => setJoinName(e.target.value)}
            placeholder="Your name"
            maxLength={12}
            className="w-full text-center text-sm text-zinc-600 placeholder-zinc-300 bg-transparent border-b border-zinc-200 pb-2 focus:outline-none focus:border-zinc-600 transition-colors"
            autoFocus
          />

          {joinError && (
            <p className="text-xs text-red-400">{joinError}</p>
          )}

          <button
            onClick={handleJoin}
            disabled={!joinName.trim() || loading}
            className="w-full py-3 text-sm tracking-widest border border-zinc-300
              text-zinc-600 hover:text-zinc-900 hover:border-zinc-800
              disabled:opacity-30 disabled:cursor-not-allowed
              transition-all duration-200"
          >
            {loading ? 'JOINING...' : 'ENTER ROOM'}
          </button>

          <button
            onClick={() => router.push('/multiplayer')}
            className="text-xs text-zinc-400 hover:text-zinc-600 tracking-wider transition-colors"
          >
            BACK
          </button>
        </div>
      </div>
    )
  }

  /* ============================================================
   *  Waiting Lobby
   * ============================================================ */

  if (isWaiting) {
    return (
      <div className="flex flex-col flex-1 items-center justify-center px-6">
        <div className="w-full max-w-md flex flex-col items-center gap-10">

          {/* Room code */}
          <div className="text-center space-y-2">
            <p className="text-xs text-zinc-400 tracking-widest">ROOM CODE</p>
            <p className="text-4xl tracking-[0.4em] text-zinc-700 font-mono">
              {roomCode}
            </p>
          </div>

          {/* How to join */}
          <div className="text-center space-y-1">
            <p className="text-xs text-zinc-400 tracking-wider">
              Share this code with friends
            </p>
            <p className="text-xs text-zinc-300">
              They can join at <span className="text-zinc-500">/multiplayer</span>
            </p>
          </div>

          {/* Player list */}
          <div className="w-full space-y-3">
            <p className="text-center text-xs text-zinc-400 tracking-widest">
              PLAYERS ({players.length})
            </p>
            <div className="flex flex-col gap-2">
              {players.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between px-4 py-3 border border-zinc-200 rounded-sm"
                >
                  <span className="text-sm text-zinc-700 tracking-wide">
                    {p.name}
                  </span>
                  <span className="text-xs text-zinc-400">
                    {p.id === room?.hostId ? 'HOST' : `#${players.indexOf(p) + 1}`}
                  </span>
                </div>
              ))}
            </div>
            {players.length === 1 && (
              <p className="text-center text-xs text-zinc-400">
                Waiting for players...
              </p>
            )}
          </div>

          {/* Error */}
          {error && (
            <p className="text-xs text-red-400">{error}</p>
          )}

          {/* Start button (host only) */}
          {isHost ? (
            <button
              onClick={startGame}
              disabled={loading || players.length < 1}
              className="w-full py-3.5 text-sm tracking-widest border border-zinc-300
                text-zinc-600 hover:text-zinc-900 hover:border-zinc-800
                disabled:opacity-30 disabled:cursor-not-allowed
                transition-all duration-200"
            >
              {loading ? 'GENERATING...' : players.length < 2 ? 'WAITING FOR PLAYERS...' : 'START GAME'}
            </button>
          ) : (
            <p className="text-xs text-zinc-400 tracking-wider">
              Waiting for host to start the game...
            </p>
          )}

          {/* Leave */}
          <button
            onClick={() => {
              sessionStorage.removeItem('immer_mp_playerId')
              router.push('/multiplayer')
            }}
            className="text-xs text-zinc-400 hover:text-zinc-600 tracking-wider transition-colors"
          >
            LEAVE ROOM
          </button>
        </div>
      </div>
    )
  }

  /* ============================================================
   *  Game Phase
   * ============================================================ */

  return (
    <div
      className="flex flex-col flex-1 items-center px-6 py-8 transition-all duration-700 min-h-screen"
      style={{ backgroundColor: theme.bg, color: theme.text }}
    >
      <div className="w-full max-w-2xl flex flex-col gap-8">

        {/* Top bar */}
        <div className="flex items-center justify-between text-xs tracking-wider">
          <button
            onClick={handleRestart}
            className="transition-colors duration-300"
            style={{ color: theme.textMuted }}
            onMouseEnter={(e) => e.currentTarget.style.color = theme.text}
            onMouseLeave={(e) => e.currentTarget.style.color = theme.textMuted}
          >
            LEAVE
          </button>

          <div className="flex items-center gap-3">
            <span style={{ color: theme.textMuted }}>
              {players.length} PLAYERS
            </span>
            <span style={{ color: theme.textSecondary }}>
              CH. {gameState?.completedScenes.length! + 1}
            </span>
          </div>

          <div className="flex gap-1">
            {players.map((p) => (
              <span
                key={p.id}
                className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-medium"
                style={{
                  backgroundColor: theme.border,
                  color: theme.textSecondary,
                  outline: p.id === playerId ? `2px solid ${theme.text}` : undefined,
                }}
                title={p.name}
              >
                {p.name.charAt(0).toUpperCase()}
              </span>
            ))}
          </div>
        </div>

        {/* Error / feedback */}
        {(error || choiceFeedback) && (
          <div
            className="text-xs text-center py-2 px-4 border rounded-sm"
            style={{
              color: choiceFeedback?.includes('accepted') || choiceFeedback?.includes('Your')
                ? theme.textSecondary
                : '#ef4444',
              borderColor: error || choiceFeedback?.includes('chose') ? '#fecaca' : theme.border,
            }}
          >
            {error || choiceFeedback}
          </div>
        )}

        {/* Loading */}
        {!currentScene && (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="text-xs tracking-widest animate-pulse" style={{ color: theme.textMuted }}>
              {waitingForLLM ? 'GENERATING YOUR STORY...' : 'LOADING...'}
            </div>
          </div>
        )}

        {/* Scene */}
        {currentScene && (
          <>
            <SceneImage url={currentScene.imageUrl} alt="Story scene" loading={false} />

            <div className="px-1">
              <NarrativeText
                text={currentScene.narrative}
                onComplete={() => setTypingDone(true)}
                textColor={theme.text}
              />
              {!typingDone && (
                <p className="text-xs mt-4 tracking-wider" style={{ color: theme.textMuted }}>
                  CLICK TO SKIP
                </p>
              )}
            </div>

            {/* Choices */}
            {typingDone && !isCompleted && !waitingForLLM && !otherPlayersChose && choices.length > 0 && (
              <div className="flex flex-col gap-2.5 px-1 mt-2">
                {choices.map((choice, i) => (
                  <div
                    key={choice.id}
                    className="animate-fade-in-up"
                    style={{ animationDelay: `${i * 150}ms`, opacity: 0 }}
                  >
                    <ChoiceButton
                      text={choice.text}
                      index={i}
                      onClick={() => handleChoice(choice.id)}
                      disabled={waitingForLLM}
                      themeBorder={theme.border}
                      themeText={theme.text}
                      themeTextSecondary={theme.textSecondary}
                      themeHoverBorder={theme.choiceBorderHover}
                    />
                  </div>
                ))}
              </div>
            )}

            {/* Waiting for LLM */}
            {waitingForLLM && (
              <div className="flex items-center justify-center py-8">
                <div className="text-xs tracking-widest animate-pulse" style={{ color: theme.textMuted }}>
                  GENERATING NEXT SCENE...
                </div>
              </div>
            )}

            {/* Someone else chose */}
            {otherPlayersChose && !waitingForLLM && (
              <div className="flex items-center justify-center py-8">
                <div className="text-xs tracking-widest animate-pulse" style={{ color: theme.textMuted }}>
                  ANOTHER PLAYER IS MAKING A CHOICE...
                </div>
              </div>
            )}

            {/* No choices (shouldn't happen in playing state, but just in case) */}
            {typingDone && !isCompleted && choices.length === 0 && !waitingForLLM && (
              <div className="flex items-center justify-center py-8">
                <div className="text-xs tracking-widest animate-pulse" style={{ color: theme.textMuted }}>
                  WAITING FOR NEXT SCENE...
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Ending overlay */}
      {endingPhase !== 'none' && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black"
          style={{
            opacity: endingPhase === 'fade' ? 0 : 1,
            transition: 'opacity 1.5s ease-in-out',
          }}
        >
          {endingPhase === 'typing' && (
            <div
              className="max-w-2xl px-8 text-center"
              onClick={typingComplete ? () => setEndingPhase('end') : undefined}
            >
              <div className="text-base leading-relaxed whitespace-pre-wrap text-white">
                {revealedText}
                {!typingComplete && <span className="animate-pulse text-white/50">▌</span>}
              </div>
              {typingComplete && (
                <p className="text-xs text-white/40 tracking-wider mt-8 animate-fade-in-up">
                  CLICK ANYWHERE TO CONTINUE
                </p>
              )}
            </div>
          )}

          {endingPhase === 'end' && (
            <div className="text-center z-10 animate-fade-in-up">
              <h1 className="text-3xl tracking-[0.3em] text-white mb-6 font-light">
                THE END
              </h1>
              <p className="text-base tracking-widest mb-12 text-white/70 italic">
                「{gameState?.endingTitle || gameState?.title}」
              </p>
              <button
                onClick={handleRestart}
                className="px-8 py-3 text-xs tracking-widest transition-all duration-200 border"
                style={{
                  borderColor: theme.border,
                  color: theme.textSecondary,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = '#fff'
                  e.currentTarget.style.color = '#fff'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = theme.border
                  e.currentTarget.style.color = theme.textSecondary
                }}
              >
                BACK TO LOBBY
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
