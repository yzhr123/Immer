'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useMultiplayer } from '@/lib/multiplayer/client'
import { getTheme } from '@/lib/theme'
import type { Mood } from '@/lib/ai/types'
import SceneImage from '@/components/SceneImage'
import NarrativeText from '@/components/NarrativeText'
import ChoiceButton from '@/components/ChoiceButton'
import BGMPlayer from '@/components/BGMPlayer'
import ClueSidebar from '@/components/ClueSidebar'
import CompanionBubble from '@/components/CompanionBubble'
import { getUserId, useCredits } from '@/lib/credit/client'

const PLAYER_ID_KEY = 'immer_mp_playerId'

function loadPref<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch { return fallback }
}

export default function MultiplayerRoomPage() {
  const router = useRouter()
  const params = useParams()
  const roomCode = (params?.code as string)?.toUpperCase()

  const {
    room, playerId, isHost, isWaiting, isPlaying, isCompleted,
    gameState, joinRoom, startGame, submitChoice, leaveRoom,
    loading, error, clearError,
  } = useMultiplayer({ roomCode })

  const [bgmEnabled, setBgmEnabled] = useState(() => loadPref('immer_bgm_enabled', true))
  const [companionEnabled, setCompanionEnabled] = useState(() => loadPref('immer_companion_enabled', true))

  const [hasJoined, setHasJoined] = useState(false)
  const [joinName, setJoinName] = useState(() => {
    if (typeof window === 'undefined') return ''
    return localStorage.getItem('immer_mp_playerName') || ''
  })
  const [joinError, setJoinError] = useState('')
  const joinCheckedRef = useRef(false)

  const [typingDone, setTypingDone] = useState(false)
  const [waitingForLLM, setWaitingForLLM] = useState(false)
  const [choiceFeedback, setChoiceFeedback] = useState<string | null>(null)
  const [imageLoading, setImageLoading] = useState(false)
  const [imageError, setImageError] = useState('')
  const [endingPhase, setEndingPhase] = useState<'none' | 'fade' | 'typing' | 'end'>('none')
  const [revealedText, setRevealedText] = useState('')
  const [typingComplete, setTypingComplete] = useState(false)
  const revealRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const sceneIdRef = useRef<string | null>(null)
  const lazyGenRef = useRef(false)

  const [viewingHistoryIndex, setViewingHistoryIndex] = useState<number | null>(null)
  const [showHistoryList, setShowHistoryList] = useState(false)
  const { balance } = useCredits()

  const isHistoryView = viewingHistoryIndex !== null

  const currentMood: Mood = gameState?.currentMood || 'calm'
  const theme = getTheme(currentMood)
  const currentScene = gameState?.currentScene
  const choices = gameState?.currentChoices || []
  const players = room?.players || []
  const clues = gameState?.clues || []
  const companionThought = gameState?.companionThought || ''
  const companionRole = gameState?.companionRole || ''
  const otherPlayersChose = room?.resolvedChoiceId !== null && !waitingForLLM
  const imageMode = room?.hostImageMode || 'none'

  useEffect(() => {
    if (joinCheckedRef.current || !room) return
    joinCheckedRef.current = true
    const stored = sessionStorage.getItem(PLAYER_ID_KEY)
    if (stored && room.players.some((p) => p.id === stored)) {
      setHasJoined(true)
    }
  }, [room])

  useEffect(() => {
    if (!currentScene) return
    if (sceneIdRef.current === currentScene.id) return
    sceneIdRef.current = currentScene.id
    setTypingDone(false)
    setWaitingForLLM(false)
    setChoiceFeedback(null)
    setEndingPhase('none')
    setImageError('')
    lazyGenRef.current = false
  }, [currentScene?.id])

  useEffect(() => {
    if (!currentScene || lazyGenRef.current || imageMode !== 'lazy' || currentScene.imageUrl || !currentScene.imagePrompt) return
    lazyGenRef.current = true
    setImageLoading(true)
    ;(async () => {
      try {
        const prefs = loadPref<{ imageModelId?: string }>('immer_llm_settings', {})
        const res = await fetch('/api/story/generate-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imagePrompt: currentScene.imagePrompt, imageModelId: prefs.imageModelId || '', userId: getUserId() }),
        })
        if (!res.ok) throw new Error(((await res.json().catch(() => ({}))).error) || 'Image generation failed')
      } catch (err: unknown) {
        setImageError(err instanceof Error ? err.message : 'Image failed')
      } finally {
        setImageLoading(false)
      }
    })()
  }, [currentScene?.id, room?.hostImageMode])

  useEffect(() => {
    if (!isCompleted || !typingDone || isHistoryView || endingPhase !== 'none') return
    const t = setTimeout(() => setEndingPhase('fade'), 800)
    return () => clearTimeout(t)
  }, [isCompleted, typingDone, isHistoryView])

  useEffect(() => {
    if (endingPhase !== 'fade') return
    const t = setTimeout(() => setEndingPhase(gameState?.endingText ? 'typing' : 'end'), 1500)
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
    return () => { if (revealRef.current) clearInterval(revealRef.current) }
  }, [endingPhase, gameState?.endingText])

  useEffect(() => {
    if (!error && !choiceFeedback && !imageError) return
    const t = setTimeout(() => { clearError(); setChoiceFeedback(null); setImageError('') }, 5000)
    return () => clearTimeout(t)
  }, [error, choiceFeedback, imageError, clearError])

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (!gameState || gameState.history.length === 0) return
      if (e.key === 'ArrowLeft') {
        setViewingHistoryIndex((prev) => prev === null ? gameState.history.length - 1 : Math.max(0, prev - 1))
      } else if (e.key === 'ArrowRight') {
        setViewingHistoryIndex((prev) => prev === null ? 0 : Math.min(gameState.history.length - 1, prev + 1))
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [gameState])

  const handleJoin = useCallback(async () => {
    if (!joinName.trim()) { setJoinError('请输入你的名字'); return }
    setJoinError('')
    try {
      await joinRoom(joinName.trim())
      setHasJoined(true)
    } catch (err: unknown) {
      setJoinError(err instanceof Error ? err.message : '加入失败')
    }
  }, [joinName, joinRoom])

  const handleRestart = useCallback(async () => {
    await leaveRoom()
  }, [leaveRoom])

  const handleChoice = useCallback(async (choiceId: string) => {
    if (waitingForLLM) return
    setWaitingForLLM(true)
    setChoiceFeedback(null)
    const result = await submitChoice(choiceId)
    setChoiceFeedback(result.accepted ? 'Your choice was accepted!' : (result.reason || 'Someone else chose first'))
    setWaitingForLLM(false)
  }, [submitChoice, waitingForLLM])

  const handleTypingComplete = useCallback(() => {
    setTypingDone(true)
  }, [])

  function getDisplayScene() {
    if (viewingHistoryIndex === null || !gameState) {
      return { scene: gameState?.currentScene ?? null, choice: null, historyMood: null }
    }
    const scene = gameState.completedScenes[viewingHistoryIndex]
    const choice = gameState.history[viewingHistoryIndex]
    return { scene: scene ?? null, choice: choice ?? null, historyMood: (choice?.mood as Mood) ?? null }
  }

  const display = getDisplayScene()
  const displayScene = display.scene

  if (!hasJoined || (!room && !roomCode)) {
    return (
      <div className="flex flex-col flex-1 items-center justify-center px-6">
        <div className="w-full max-w-md flex flex-col items-center gap-8">
          <div className="text-center space-y-2">
            <p className="text-xs text-zinc-400 tracking-widest">JOIN ROOM</p>
            <p className="text-3xl tracking-[0.3em] text-zinc-700 font-mono">{roomCode}</p>
          </div>
          <input type="text" value={joinName} onChange={(e) => setJoinName(e.target.value)} placeholder="Your name" maxLength={12}
            className="w-full text-center text-sm text-zinc-600 placeholder-zinc-300 bg-transparent border-b border-zinc-200 pb-2 focus:outline-none focus:border-zinc-600 transition-colors" autoFocus />
          {joinError && <p className="text-xs text-red-400">{joinError}</p>}
          <button onClick={handleJoin} disabled={!joinName.trim() || loading}
            className="w-full py-3 text-sm tracking-widest border border-zinc-300 text-zinc-600 hover:text-zinc-900 hover:border-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200">
            {loading ? 'JOINING...' : 'ENTER ROOM'}
          </button>
          <button onClick={() => router.push('/multiplayer')} className="text-xs text-zinc-400 hover:text-zinc-600 tracking-wider transition-colors">BACK</button>
        </div>
      </div>
    )
  }

  if (isWaiting) {
    return (
      <div className="flex flex-col flex-1 items-center justify-center px-6">
        <div className="w-full max-w-md flex flex-col items-center gap-10">
          <div className="text-center space-y-2">
            <p className="text-xs text-zinc-400 tracking-widest">ROOM CODE</p>
            <p className="text-4xl tracking-[0.4em] text-zinc-700 font-mono">{roomCode}</p>
          </div>
          <div className="text-center space-y-1">
            <p className="text-xs text-zinc-400 tracking-wider">Share this code with friends</p>
            <p className="text-xs text-zinc-300">They can join at <span className="text-zinc-500">/multiplayer</span></p>
          </div>
          <div className="w-full space-y-3">
            <p className="text-center text-xs text-zinc-400 tracking-widest">PLAYERS ({players.length})</p>
            <div className="flex flex-col gap-2">
              {players.map((p) => (
                <div key={p.id} className="flex items-center justify-between px-4 py-3 border border-zinc-200 rounded-sm">
                  <span className="text-sm text-zinc-700 tracking-wide">{p.name}</span>
                  <span className="text-xs text-zinc-400">{p.id === room?.hostId ? 'HOST' : '#' + (players.indexOf(p) + 1)}</span>
                </div>
              ))}
            </div>
            {players.length === 1 && <p className="text-center text-xs text-zinc-400">Waiting for players...</p>}
          </div>
          {error && <p className="text-xs text-red-400">{error}</p>}
          {isHost ? (
            <button onClick={startGame} disabled={loading || players.length < 1}
              className="w-full py-3.5 text-sm tracking-widest border border-zinc-300 text-zinc-600 hover:text-zinc-900 hover:border-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200">
              {loading ? 'GENERATING...' : players.length < 2 ? 'WAITING FOR PLAYERS...' : 'START GAME'}
            </button>
          ) : (
            <p className="text-xs text-zinc-400 tracking-wider">Waiting for host to start the game...</p>
          )}
          <button onClick={leaveRoom} className="text-xs text-zinc-400 hover:text-zinc-600 tracking-wider transition-colors">LEAVE ROOM</button>
        </div>
      </div>
    )
  }

  return (
    <>
      {currentScene && <BGMPlayer mood={isHistoryView && display.historyMood ? display.historyMood : currentMood} enabled={bgmEnabled} />}

      <div className={"flex flex-col flex-1 items-center px-6 py-8 transition-all duration-700 min-h-screen" + (isHistoryView ? ' pb-20' : '')}
        style={{ backgroundColor: theme.bg, color: theme.text }}>
        <div className="w-full max-w-2xl flex flex-col gap-8">

          <div className="flex items-center justify-between text-xs tracking-wider transition-colors duration-500" style={{ color: theme.textMuted }}>
            <button onClick={handleRestart} className="transition-colors duration-300" style={{ color: theme.textMuted }}
              onMouseEnter={(e) => e.currentTarget.style.color = theme.text}
              onMouseLeave={(e) => e.currentTarget.style.color = theme.textMuted}>LEAVE</button>

            {isHistoryView ? (
              <div className="flex items-center gap-3">
                <button onClick={() => setViewingHistoryIndex((p) => p !== null ? Math.max(0, p - 1) : 0)}
                  disabled={viewingHistoryIndex === 0} className="transition-colors duration-300 disabled:opacity-20" style={{ color: theme.textMuted }}>&lt;</button>
                <button onClick={() => setShowHistoryList(true)} className="hover:underline transition-colors duration-300" style={{ color: theme.textSecondary }}>
                  HISTORY {viewingHistoryIndex! + 1}/{gameState!.history.length}</button>
                <button onClick={() => setViewingHistoryIndex((p) => p !== null ? Math.min(gameState!.history.length - 1, p + 1) : gameState!.history.length - 1)}
                  disabled={viewingHistoryIndex === gameState!.history.length - 1} className="transition-colors duration-300 disabled:opacity-20" style={{ color: theme.textMuted }}>&gt;</button>
              </div>
            ) : (
              <span>CHAPTER {gameState ? gameState.completedScenes.length + 1 : '...'}</span>
            )}

            <div className="flex items-center gap-3">
              <span className="text-xs tracking-wider transition-colors duration-500" style={{ color: theme.textMuted }}>{currentMood}.mp3</span>
              <button onClick={() => setBgmEnabled(!bgmEnabled)} className="transition-colors duration-300 tracking-wider"
                style={{ color: bgmEnabled ? theme.textSecondary : theme.textMuted }}>BGM:{bgmEnabled ? 'ON' : 'OFF'}</button>
              <button onClick={() => setCompanionEnabled(!companionEnabled)} className="transition-colors duration-300 tracking-wider"
                style={{ color: companionEnabled ? theme.textSecondary : theme.textMuted }}>AI:{companionEnabled ? 'ON' : 'OFF'}</button>
              <span className="text-xs tracking-wider" style={{ color: theme.textMuted }}>¥{balance}</span>
            </div>

            {isHistoryView ? (
              <button onClick={() => setViewingHistoryIndex(null)} className="transition-colors duration-300" style={{ color: theme.textMuted }}>CURRENT</button>
            ) : (
              <button onClick={() => { if (gameState?.history.length) setViewingHistoryIndex(gameState.history.length - 1) }}
                className="transition-colors duration-300"
                style={{ color: gameState?.history.length ? theme.textMuted : 'transparent', pointerEvents: gameState?.history.length ? 'auto' : 'none' }}>
                {gameState?.history.length ? 'HISTORY (' + gameState.history.length + ')' : '\u00A0'}</button>
            )}
          </div>

          {showHistoryList && (
            <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center pt-20" onClick={() => setShowHistoryList(false)}>
              <div className="w-full max-w-lg max-h-[60vh] overflow-y-auto rounded-sm shadow-xl"
                style={{ backgroundColor: theme.bgCard, border: '1px solid ' + theme.border }} onClick={(e) => e.stopPropagation()}>
                <div className="px-5 py-4 text-xs tracking-widest" style={{ color: theme.textMuted }}>HISTORY</div>
                {gameState?.history.map((entry, i) => {
                  const ps = gameState.completedScenes[i]
                  return (
                    <button key={entry.sceneId} onClick={() => { setViewingHistoryIndex(i); setShowHistoryList(false) }}
                      className="w-full text-left px-5 py-3.5 transition-colors duration-200 border-t"
                      style={{ borderColor: theme.border, backgroundColor: viewingHistoryIndex === i ? theme.border : 'transparent' }}>
                      <div className="text-xs tracking-widest mb-1" style={{ color: theme.textMuted }}>CHAPTER {i + 1}</div>
                      <div className="text-sm leading-relaxed line-clamp-2" style={{ color: theme.text }}>{ps?.narrative.slice(0, 80)}{ps?.narrative && ps.narrative.length > 80 ? '...' : ''}</div>
                      <div className="text-xs mt-1" style={{ color: theme.accent }}>&rarr; {entry.choiceText}</div>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {(error || choiceFeedback || (imageError && imageMode !== 'none')) && (
            <div className="text-xs text-center py-2 px-4 border rounded-sm"
              style={{ color: imageError ? '#d97706' : (choiceFeedback?.includes('accepted') || choiceFeedback?.includes('Your') ? theme.textSecondary : '#ef4444'),
                borderColor: error || (choiceFeedback && !choiceFeedback.includes('accepted')) ? '#fecaca' : imageError ? '#fde68a' : theme.border }}>
              {error || choiceFeedback || imageError}
            </div>
          )}

          {!currentScene && !isHistoryView && (
            <div className="flex flex-col items-center justify-center py-24 gap-4">
              <div className="text-xs tracking-widest animate-pulse" style={{ color: theme.textMuted }}>{waitingForLLM ? 'GENERATING YOUR STORY...' : 'LOADING...'}</div>
            </div>
          )}

          {displayScene && (
            <>
              {imageMode !== 'none' && <SceneImage url={displayScene.imageUrl} alt="Story scene" loading={imageLoading && !displayScene.imageUrl} />}

              <div className="px-1">
                {isHistoryView ? (
                  <div className="text-base leading-relaxed whitespace-pre-wrap transition-colors duration-500" style={{ color: theme.text }}>{displayScene.narrative}</div>
                ) : (
                  <>
                    <NarrativeText text={displayScene.narrative} onComplete={handleTypingComplete} textColor={theme.text} />
                    {!typingDone && <p className="text-xs mt-4 tracking-wider" style={{ color: theme.textMuted }}>CLICK TO SKIP</p>}
                  </>
                )}
              </div>

              {isHistoryView && display.choice && (
                <div className="px-1 mt-2">
                  <div className="text-sm py-3 px-4 rounded-sm tracking-wide" style={{ color: theme.accent, border: '1px solid ' + theme.border }}>
                    &rarr; {display.choice.choiceText}</div>
                </div>
              )}

              {!isHistoryView && typingDone && !waitingForLLM && !otherPlayersChose && isPlaying && choices.length > 0 && (
                <div className="flex flex-col gap-2.5 px-1 mt-2">
                  {choices.map((choice, i) => (
                    <div key={choice.id} className="animate-fade-in-up" style={{ animationDelay: (i * 150) + 'ms', opacity: 0 }}>
                      <ChoiceButton text={choice.text} index={i} onClick={() => handleChoice(choice.id)} disabled={false}
                        themeBorder={theme.border} themeText={theme.text} themeTextSecondary={theme.textSecondary} themeHoverBorder={theme.choiceBorderHover} />
                    </div>
                  ))}
                </div>
              )}

              {waitingForLLM && (
                <div className="flex items-center justify-center py-8">
                  <div className="text-xs tracking-widest animate-pulse" style={{ color: theme.textMuted }}>GENERATING NEXT SCENE...</div>
                </div>
              )}

              {otherPlayersChose && !waitingForLLM && !isHistoryView && (
                <div className="flex items-center justify-center py-8">
                  <div className="text-xs tracking-widest animate-pulse" style={{ color: theme.textMuted }}>ANOTHER PLAYER IS MAKING A CHOICE...</div>
                </div>
              )}

              {typingDone && isPlaying && choices.length === 0 && !waitingForLLM && !otherPlayersChose && !isHistoryView && (
                <div className="flex items-center justify-center py-8">
                  <div className="text-xs tracking-widest animate-pulse" style={{ color: theme.textMuted }}>WAITING FOR NEXT SCENE...</div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {endingPhase !== 'none' && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black"
          style={{ opacity: endingPhase === 'fade' ? 0 : 1, transition: 'opacity 1.5s ease-in-out' }}>
          {endingPhase === 'typing' && (
            <div className="max-w-2xl px-8 text-center" onClick={typingComplete ? () => setEndingPhase('end') : undefined}>
              <div className="text-base leading-relaxed whitespace-pre-wrap text-white">
                {revealedText}{!typingComplete && <span className="animate-pulse text-white/50">&#9668;</span>}
              </div>
              {typingComplete && <p className="text-xs text-white/40 tracking-wider mt-8 animate-fade-in-up">CLICK ANYWHERE TO CONTINUE</p>}
            </div>
          )}
          {endingPhase === 'end' && (
            <div className="text-center z-10 animate-fade-in-up">
              <h1 className="text-3xl tracking-[0.3em] text-white mb-6 font-light">THE END</h1>
              <p className="text-base tracking-widest mb-12 text-white/70 italic">{'\u300C'}{gameState?.endingTitle || gameState?.title}{'\u300D'}</p>
              <button onClick={handleRestart}
                className="px-8 py-3 text-xs tracking-widest transition-all duration-200 border"
                style={{ borderColor: theme.border, color: theme.textSecondary }}>
                BACK TO LOBBY
              </button>
            </div>
          )}
        </div>
      )}

      {currentScene && clues.length > 0 && (
        <ClueSidebar clues={clues} themeBorder={theme.border} themeBgCard={theme.bgCard}
          themeText={theme.text} themeTextSecondary={theme.textSecondary} themeTextMuted={theme.textMuted} />
      )}

      <CompanionBubble thought={companionThought} role={companionRole} enabled={companionEnabled}
        themeBorder={theme.border} themeBgCard={theme.bgCard} themeText={theme.text}
        themeTextMuted={theme.textMuted} bottomNav={isHistoryView} />

      {isHistoryView && gameState && gameState.history.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-40 flex items-center justify-center gap-8 py-4 px-6 border-t"
          style={{ backgroundColor: theme.bg, borderColor: theme.border }}>
          <button onClick={() => setViewingHistoryIndex((p) => p !== null ? Math.max(0, p - 1) : 0)}
            disabled={viewingHistoryIndex === 0} className="text-sm tracking-wider transition-colors duration-300 disabled:opacity-20" style={{ color: theme.textMuted }}>&lt; PREV</button>
          <button onClick={() => setViewingHistoryIndex(null)} className="text-sm tracking-wider transition-colors duration-300" style={{ color: theme.textSecondary }}>BACK TO CURRENT</button>
          <button onClick={() => setViewingHistoryIndex((p) => p !== null ? Math.min(gameState!.history.length - 1, p + 1) : gameState!.history.length - 1)}
            disabled={viewingHistoryIndex === gameState!.history.length - 1} className="text-sm tracking-wider transition-colors duration-300 disabled:opacity-20" style={{ color: theme.textMuted }}>NEXT &gt;</button>
        </div>
      )}
    </>
  )
}