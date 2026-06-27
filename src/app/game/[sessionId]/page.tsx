'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useStore, buildContext } from '@/lib/store'
import { BranchState, ContextEntry, Mood } from '@/lib/ai/types'
import { getTheme } from '@/lib/theme'
import SceneImage from '@/components/SceneImage'
import NarrativeText from '@/components/NarrativeText'
import ChoiceButton from '@/components/ChoiceButton'
import BGMPlayer from '@/components/BGMPlayer'

export default function GamePage() {
  const router = useRouter()
  const params = useParams()
  const {
    game,
    initGame,
    setCurrentScene,
    advanceToScene,
    saveCurrentGame,
    clearGame,
    llmSettings,
    loadGame,
    bgmEnabled,
    setBgmEnabled,
  } = useStore()

  const sessionId = params?.sessionId as string

  const [typingDone, setTypingDone] = useState(false)
  const [waitingFor, setWaitingFor] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [imageError, setImageError] = useState('')
  const [branches, setBranches] = useState<Record<string, BranchState>>({})
  const [viewingHistoryIndex, setViewingHistoryIndex] = useState<number | null>(null)
  const [showHistoryList, setShowHistoryList] = useState(false)

  const firstGenRef = useRef(false)
  const preGenRef = useRef(false)
  const abortRef = useRef<AbortController | null>(null)

  const onTypingDone = useCallback(() => setTypingDone(true), [])

  const currentMood: Mood = game?.currentMood || 'calm'
  const theme = getTheme(currentMood)

  // --- load or init session ---
  useEffect(() => {
    if (!game || game.sessionId !== sessionId) {
      const saved = loadGame(sessionId)
      if (saved) {
        useStore.setState({ game: saved })
        return
      }
      router.push('/')
      return
    }

    if (game.status === 'generating' && !game.currentScene && !firstGenRef.current) {
      firstGenRef.current = true
      generateFirst()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // --- auto-dismiss error ---
  useEffect(() => {
    if (!error) return
    const t = setTimeout(() => setError(''), 5000)
    return () => clearTimeout(t)
  }, [error])

  // --- start pre-generation when a playable scene is mounted ---
  useEffect(() => {
    if (
      game?.currentScene &&
      game.currentChoices.length > 0 &&
      game.status === 'playing'
    ) {
      preGenRef.current = false
      setBranches({})
      setTypingDone(false)
      setWaitingFor(null)

      const timer = setTimeout(() => startPreGen(), 200)
      return () => {
        clearTimeout(timer)
        abortRef.current?.abort()
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game?.currentScene?.id])

  // --- watch for branch readiness when user is waiting ---
  useEffect(() => {
    if (!waitingFor) return
    const branch = branches[waitingFor]
    if (branch?.status === 'ready' && branch.scene) {
      applyBranch(waitingFor)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branches])

  // --- helpers ---

  function startPreGen() {
    if (!game || preGenRef.current) return
    preGenRef.current = true

    abortRef.current?.abort()
    const ac = new AbortController()
    abortRef.current = ac

    const context = buildContext(game)

    const initMap: Record<string, BranchState> = {}
    game.currentChoices.forEach((c) => {
      initMap[c.id] = {
        choiceId: c.id,
        choiceText: c.text,
        scene: null,
        choices: [],
        mood: 'calm' as Mood,
        isEnding: false,
        endingText: null,
        status: 'generating',
      }
    })
    setBranches(initMap)

    game.currentChoices.forEach((choice) => {
      fetchBranch(choice.id, choice.text, context, ac.signal)
    })
  }

  async function fetchBranch(
    choiceId: string,
    choiceText: string,
    context: ContextEntry[],
    signal: AbortSignal,
  ) {
    if (!game) return
    try {
      const res = await fetch('/api/story/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          genre: game.genre,
          premise: game.premise,
          context,
          choice: { id: choiceId, text: choiceText },
          llmConfig: llmSettings,
        }),
        signal,
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error((data as any).error || 'Generation failed')
      }

      const data = await res.json()

      if (data.imageError) {
        setImageError(data.imageError)
      }

      setBranches((prev) => ({
        ...prev,
        [choiceId]: {
          choiceId,
          choiceText,
          scene: data.scene,
          choices: data.choices || [],
          mood: data.mood || 'calm',
          isEnding: data.isEnding || false,
          endingText: data.endingText || null,
          status: 'ready' as const,
        },
      }))
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return
      const msg = err instanceof Error ? err.message : 'Unknown error'
      setBranches((prev) => ({
        ...prev,
        [choiceId]: {
          choiceId,
          choiceText,
          scene: null,
          choices: [],
          mood: 'calm' as Mood,
          isEnding: false,
          endingText: null,
          status: 'error' as const,
          error: msg,
        },
      }))
    }
  }

  async function generateFirst() {
    if (!game) return
    setError('')
    try {
      const res = await fetch('/api/story/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          genre: game.genre,
          premise: game.premise,
          context: [],
          llmConfig: llmSettings,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error((data as any).error || 'Generation failed')
      }
      const data = await res.json()
      setCurrentScene(
        data.scene,
        data.choices,
        data.mood || 'calm',
        data.isEnding,
        data.endingText,
      )
      if (data.imageError) setImageError(data.imageError)
      else setImageError('')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      setError(msg)
    }
  }

  function applyBranch(choiceId: string) {
    const branch = branches[choiceId]
    if (!branch?.scene) return

    advanceToScene({
      scene: branch.scene,
      choices: branch.choices,
      mood: branch.mood,
      historyEntry: {
        sceneId: game?.currentScene?.id || '',
        choiceId,
        choiceText: branch.choiceText,
      },
      isEnding: branch.isEnding,
      endingText: branch.endingText,
    })

    setBranches({})
    setWaitingFor(null)
    setViewingHistoryIndex(null)
    saveCurrentGame()
  }

  function handleChoice(choiceId: string) {
    const branch = branches[choiceId]
    if (!branch) return

    if (branch.status === 'ready' && branch.scene) {
      applyBranch(choiceId)
    } else if (branch.status === 'generating') {
      setWaitingFor(choiceId)
    } else if (branch.status === 'error') {
      setError(branch.error || 'Branch failed')
    }
  }

  function handleRestart() {
    abortRef.current?.abort()
    clearGame()
    router.push('/')
  }

  // --- history helpers ---

  function getDisplayScene() {
    if (viewingHistoryIndex === null || !game) {
      return { scene: game?.currentScene ?? null, choice: null, historyMood: null }
    }
    const scene = game.completedScenes[viewingHistoryIndex]
    const choice = game.history[viewingHistoryIndex]
    return { scene: scene ?? null, choice: choice ?? null, historyMood: null }
  }

  function handleHistorySelect(index: number) {
    setViewingHistoryIndex(index)
    setShowHistoryList(false)
  }

  // --- render ---

  if (!game) return null

  const readyCount = Object.values(branches).filter((b) => b.status === 'ready').length
  const totalBranches = Object.keys(branches).length
  const display = getDisplayScene()
  const isHistoryView = viewingHistoryIndex !== null

  return (
    <>
      {game.currentScene && <BGMPlayer mood={currentMood} enabled={bgmEnabled} />}

      <div
        className="flex flex-col flex-1 items-center px-6 py-8 transition-all duration-700"
        style={{
          backgroundColor: theme.bg,
          color: theme.text,
        }}
      >
        <div className="w-full max-w-2xl flex flex-col gap-8">

          {/* top bar */}
          <div
            className="flex items-center justify-between text-xs tracking-wider transition-colors duration-500"
            style={{ color: theme.textMuted }}
          >
            <button
              onClick={handleRestart}
              className="transition-colors duration-300"
              style={{ color: theme.textMuted }}
              onMouseEnter={(e) => e.currentTarget.style.color = theme.text}
              onMouseLeave={(e) => e.currentTarget.style.color = theme.textMuted}
            >
              BACK
            </button>

            {isHistoryView ? (
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setViewingHistoryIndex((prev) =>
                    prev !== null ? Math.max(0, prev - 1) : 0
                  )}
                  disabled={viewingHistoryIndex === 0}
                  className="transition-colors duration-300 disabled:opacity-20"
                  style={{ color: theme.textMuted }}
                  onMouseEnter={(e) => {
                    if (viewingHistoryIndex !== 0) e.currentTarget.style.color = theme.text
                  }}
                  onMouseLeave={(e) => e.currentTarget.style.color = theme.textMuted}
                >
                  &lt;
                </button>
                <button
                  onClick={() => setShowHistoryList(true)}
                  className="hover:underline transition-colors duration-300"
                  style={{ color: theme.textSecondary }}
                  onMouseEnter={(e) => e.currentTarget.style.color = theme.text}
                  onMouseLeave={(e) => e.currentTarget.style.color = theme.textSecondary}
                >
                  HISTORY {viewingHistoryIndex! + 1}/{game.history.length}
                </button>
                <button
                  onClick={() => setViewingHistoryIndex((prev) =>
                    prev !== null ? Math.min(game.history.length - 1, prev + 1) : game.history.length - 1
                  )}
                  disabled={viewingHistoryIndex === game.history.length - 1}
                  className="transition-colors duration-300 disabled:opacity-20"
                  style={{ color: theme.textMuted }}
                  onMouseEnter={(e) => {
                    if (viewingHistoryIndex !== game.history.length - 1) e.currentTarget.style.color = theme.text
                  }}
                  onMouseLeave={(e) => e.currentTarget.style.color = theme.textMuted}
                >
                  &gt;
                </button>
              </div>
            ) : (
              <span>CHAPTER {game.completedScenes.length + 1}</span>
            )}

            <div className="flex items-center gap-3">
              <span className="text-xs tracking-wider transition-colors duration-500" style={{ color: theme.textMuted }}>
                {currentMood}.mp3
              </span>
              <button
                onClick={() => setBgmEnabled(!bgmEnabled)}
                className="transition-colors duration-300 tracking-wider"
                style={{ color: bgmEnabled ? theme.textSecondary : theme.textMuted }}
                onMouseEnter={(e) => e.currentTarget.style.color = theme.text}
                onMouseLeave={(e) => e.currentTarget.style.color = bgmEnabled ? theme.textSecondary : theme.textMuted}
              >
                BGM:{bgmEnabled ? 'ON' : 'OFF'}
              </button>
            </div>

            {isHistoryView ? (
              <button
                onClick={() => setViewingHistoryIndex(null)}
                className="transition-colors duration-300"
                style={{ color: theme.textMuted }}
                onMouseEnter={(e) => e.currentTarget.style.color = theme.text}
                onMouseLeave={(e) => e.currentTarget.style.color = theme.textMuted}
              >
                CURRENT
              </button>
            ) : (
              <button
                onClick={() => {
                  if (game.history.length > 0) {
                    setViewingHistoryIndex(game.history.length - 1)
                  }
                }}
                className="transition-colors duration-300"
                style={{ color: game.history.length > 0 ? theme.textMuted : 'transparent', pointerEvents: game.history.length > 0 ? 'auto' : 'none' }}
                onMouseEnter={(e) => { if (game.history.length > 0) e.currentTarget.style.color = theme.text }}
                onMouseLeave={(e) => { if (game.history.length > 0) e.currentTarget.style.color = theme.textMuted }}
              >
                {game.history.length > 0 ? `HISTORY (${game.history.length})` : '\u00A0'}
              </button>
            )}
          </div>

          {/* history list overlay */}
          {showHistoryList && (
            <div
              className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center pt-20"
              onClick={() => setShowHistoryList(false)}
            >
              <div
                className="w-full max-w-lg max-h-[60vh] overflow-y-auto rounded-sm shadow-xl"
                style={{
                  backgroundColor: theme.bgCard,
                  border: `1px solid ${theme.border}`,
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="px-5 py-4 text-xs tracking-widest" style={{ color: theme.textMuted }}>
                  HISTORY
                </div>
                {game.history.map((entry, i) => {
                  const pastScene = game.completedScenes[i]
                  const isActive = viewingHistoryIndex === i
                  return (
                    <button
                      key={entry.sceneId}
                      onClick={() => handleHistorySelect(i)}
                      className="w-full text-left px-5 py-3.5 transition-colors duration-200 border-t"
                      style={{
                        borderColor: theme.border,
                        backgroundColor: isActive ? theme.border : 'transparent',
                      }}
                      onMouseEnter={(e) => {
                        if (!isActive) e.currentTarget.style.backgroundColor = theme.border + '60'
                      }}
                      onMouseLeave={(e) => {
                        if (!isActive) e.currentTarget.style.backgroundColor = 'transparent'
                      }}
                    >
                      <div className="text-xs tracking-widest mb-1" style={{ color: theme.textMuted }}>
                        CHAPTER {i + 1}
                      </div>
                      <div className="text-sm leading-relaxed line-clamp-2" style={{ color: theme.text }}>
                        {pastScene?.narrative.slice(0, 80) || ''}
                        {pastScene && pastScene.narrative.length > 80 ? '...' : ''}
                      </div>
                      <div className="text-xs mt-1" style={{ color: theme.accent }}>
                        → {entry.choiceText}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* error */}
          {error && (
            <div className="text-xs text-red-400 text-center py-2 px-4 border border-red-100 rounded-sm">
              {error}
            </div>
          )}

          {/* initial loading */}
          {!game.currentScene && !isHistoryView && (
            <div className="flex flex-col items-center justify-center py-24 gap-4">
              <div className="text-xs tracking-widest animate-pulse" style={{ color: theme.textMuted }}>
                GENERATING...
              </div>
              <div className="text-xs" style={{ color: theme.textMuted }}>
                Crafting your story
              </div>
            </div>
          )}

          {/* scene content */}
          {display.scene && (
            <>
              <SceneImage url={display.scene.imageUrl} alt="Story scene" />

              {imageError && !isHistoryView && (
                <div className="text-xs text-amber-500 text-center py-2 px-4 border border-amber-100 rounded-sm">
                  {imageError}
                </div>
              )}

              <div className="px-1">
                {isHistoryView ? (
                  <div
                    className="text-base leading-relaxed whitespace-pre-wrap transition-colors duration-500"
                    style={{ color: theme.text }}
                  >
                    {display.scene.narrative}
                  </div>
                ) : (
                  <>
                    <NarrativeText text={display.scene.narrative} onComplete={onTypingDone} textColor={theme.text} />
                    {!typingDone && (
                      <p className="text-xs mt-4 tracking-wider" style={{ color: theme.textMuted }}>
                        CLICK TO SKIP
                      </p>
                    )}
                  </>
                )}
              </div>

              {/* history: show the chosen choice */}
              {isHistoryView && display.choice && (
                <div className="px-1 mt-2">
                  <div
                    className="text-sm py-3 px-4 rounded-sm tracking-wide"
                    style={{
                      color: theme.accent,
                      border: `1px solid ${theme.border}`,
                    }}
                  >
                    → {display.choice.choiceText}
                  </div>
                </div>
              )}

              {/* history: navigation at bottom */}
              {isHistoryView && (
                <div className="flex items-center justify-between px-1 mt-4">
                  <button
                    onClick={() => setViewingHistoryIndex((prev) =>
                      prev !== null ? Math.max(0, prev - 1) : 0
                    )}
                    disabled={viewingHistoryIndex === 0}
                    className="text-xs tracking-wider transition-colors duration-300 disabled:opacity-20"
                    style={{ color: theme.textMuted }}
                    onMouseEnter={(e) => {
                      if (viewingHistoryIndex !== 0) e.currentTarget.style.color = theme.text
                    }}
                    onMouseLeave={(e) => e.currentTarget.style.color = theme.textMuted}
                  >
                    &lt; PREV
                  </button>
                  <button
                    onClick={() => setViewingHistoryIndex(null)}
                    className="text-xs tracking-wider transition-colors duration-300"
                    style={{ color: theme.textSecondary }}
                    onMouseEnter={(e) => e.currentTarget.style.color = theme.text}
                    onMouseLeave={(e) => e.currentTarget.style.color = theme.textSecondary}
                  >
                    BACK TO CURRENT
                  </button>
                  <button
                    onClick={() => setViewingHistoryIndex((prev) =>
                      prev !== null ? Math.min(game.history.length - 1, prev + 1) : game.history.length - 1
                    )}
                    disabled={viewingHistoryIndex === game.history.length - 1}
                    className="text-xs tracking-wider transition-colors duration-300 disabled:opacity-20"
                    style={{ color: theme.textMuted }}
                    onMouseEnter={(e) => {
                      if (viewingHistoryIndex !== game.history.length - 1) e.currentTarget.style.color = theme.text
                    }}
                    onMouseLeave={(e) => e.currentTarget.style.color = theme.textMuted}
                  >
                    NEXT &gt;
                  </button>
                </div>
              )}

              {/* choices */}
              {!isHistoryView &&
                typingDone &&
                !waitingFor &&
                game.status === 'playing' &&
                game.currentChoices.length > 0 && (
                  <div className="flex flex-col gap-2.5 px-1 mt-2">
                    {game.currentChoices.map((choice, i) => {
                      const b = branches[choice.id]
                      const isReady = b?.status === 'ready'
                      const isGen = b?.status === 'generating'
                      return (
                        <div
                          key={choice.id}
                          className="animate-fade-in-up"
                          style={{ animationDelay: `${i * 150}ms`, opacity: 0 }}
                        >
                          <ChoiceButton
                            text={choice.text + (isGen ? '  ...' : '')}
                            index={i}
                            onClick={() => handleChoice(choice.id)}
                            disabled={!isReady && !isGen}
                            themeBorder={theme.border}
                            themeText={theme.text}
                            themeTextSecondary={theme.textSecondary}
                            themeHoverBorder={theme.choiceBorderHover}
                          />
                        </div>
                      )
                    })}
                    {totalBranches > 0 && (
                      <div className="text-center text-xs mt-2 tracking-wider" style={{ color: theme.textMuted }}>
                        {readyCount}/{totalBranches} PATHS READY
                      </div>
                    )}
                  </div>
                )}

              {/* waiting */}
              {!isHistoryView && waitingFor && (
                <div className="flex items-center justify-center py-8">
                  <div className="text-xs tracking-widest animate-pulse" style={{ color: theme.textMuted }}>
                    PREPARING THIS PATH...
                  </div>
                </div>
              )}

              {/* ending */}
              {!isHistoryView && game.status === 'completed' && game.endingText && typingDone && (
                <div className="mt-8 px-1 space-y-6">
                  <div className="pt-6" style={{ borderTop: `1px solid ${theme.border}` }}>
                    <p className="text-xs mb-3 tracking-widest" style={{ color: theme.textMuted }}>
                      EPILOGUE
                    </p>
                    <NarrativeText text={game.endingText} onComplete={() => { }} textColor={theme.text} />
                  </div>
                  <button
                    onClick={handleRestart}
                    className="w-full py-3.5 text-sm tracking-widest transition-all duration-200 rounded-none"
                    style={{
                      border: `1px solid ${theme.border}`,
                      color: theme.textSecondary,
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = theme.choiceBorderHover
                      e.currentTarget.style.color = theme.text
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = theme.border
                      e.currentTarget.style.color = theme.textSecondary
                    }}
                  >
                    START A NEW STORY
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  )
}
