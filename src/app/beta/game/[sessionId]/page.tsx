'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useStore, buildContext } from '@/lib/store'
import type { ContextEntry, Mood } from '@/lib/ai/types'
import type { BetaChoice, BetaSceneResponse, PrologueResponse, BetaPhase } from '@/lib/ai/experimental/types'
import { getTheme } from '@/lib/theme'
import { getUserId, useCredits } from '@/lib/credit/client'
import SceneImage from '@/components/SceneImage'
import NarrativeText from '@/components/NarrativeText'
import BGMPlayer from '@/components/BGMPlayer'
import ClueSidebar from '@/components/ClueSidebar'
import CompanionBubble from '@/components/CompanionBubble'
import FlexibleChoices from '@/components/experimental/FlexibleChoices'
import FreeActionInput from '@/components/experimental/FreeActionInput'

export default function BetaGamePage() {
  const router = useRouter()
  const params = useParams()
  const sessionId = params?.sessionId as string

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
    imageMode,
    companionEnabled,
    setCompanionEnabled,
    addClues,
    setCompanionState,
    setCharacterIdentity,
    setStoryPhase,
    language,
  } = useStore()

  const { balance, refresh: refreshBalance, setBalance } = useCredits()

  const [typingDone, setTypingDone] = useState(false)
  const [waitingFor, setWaitingFor] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [viewingHistoryIndex, setViewingHistoryIndex] = useState<number | null>(null)
  const [showHistoryList, setShowHistoryList] = useState(false)

  // Ending (same as original)
  const [endingPhase, setEndingPhase] = useState<'none' | 'fade' | 'typing' | 'end'>('none')
  const [revealedText, setRevealedText] = useState('')
  const [typingComplete, setTypingComplete] = useState(false)
  const revealRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Beta prologue
  const [betaPhase, setBetaPhase] = useState<BetaPhase>('generating-prologue')
  const [prologueData, setPrologueData] = useState<PrologueResponse | null>(null)
  const [prologueRevealed, setPrologueRevealed] = useState('')
  const [prologueTypingDone, setPrologueTypingDone] = useState(false)
  const prologueRevealRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Branch pre-generation
  const [branches, setBranches] = useState<Record<string, BetaSceneResponse>>({})

  const firstGenRef = useRef(false)
  const preGenRef = useRef(false)
  const abortRef = useRef<AbortController | null>(null)

  const isHistoryView = viewingHistoryIndex !== null

  const onTypingDone = useCallback(() => setTypingDone(true), [])

  const currentMood: Mood = game?.currentMood || 'calm'
  const theme = getTheme(currentMood)

  const characterIdentity = game?.characterIdentity || prologueData?.characterIdentity || ''

  // ---- load or init ----
  useEffect(() => {
    if (!game || game.sessionId !== sessionId) {
      const saved = loadGame(sessionId)
      if (saved) {
        useStore.setState({ game: saved })
        // If saved beta game has no scene yet, generate prologue instead of jumping to 'playing'
        if (saved.isBeta) {
          if (!saved.currentScene && !firstGenRef.current) {
            firstGenRef.current = true
            generatePrologue()
          } else {
            setBetaPhase('playing')
          }
        }
        return
      }
      router.push('/lobby')
      return
    }

    if (game.isBeta && !game.currentScene && !firstGenRef.current) {
      firstGenRef.current = true
      generatePrologue()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ---- prologue generation ----
  async function generatePrologue() {
    setBetaPhase('generating-prologue')
    setError('')
    const currentGame = useStore.getState().game
    if (!currentGame) {
      setError('游戏数据不存在')
      router.push('/lobby')
      return
    }
    try {
      const res = await fetch('/api/beta/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phase: 'prologue',
          genre: currentGame.genre,
          premise: currentGame.premise,
          llmConfig: llmSettings,
          language,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error((data as any).error || 'Prologue generation failed')
      }
      const data: PrologueResponse = await res.json()
      setPrologueData(data)

      // Always show prologue first, character selection comes after
      setBetaPhase('playing-prologue')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      setError(msg)
      // fallback: jump to playing anyway
      setBetaPhase('playing')
      generateFirstScene()
    }
  }

  // ---- character select UI (inline) ----
  function handleCharacterSelect(char: { id: string; identity: string; background: string }) {
    setCharacterIdentity(char.identity, char.background)
    setPrologueData(null)
    setBetaPhase('playing')
    generateFirstScene()
  }

  // ---- prologue typing effect (like the original ending pattern) ----
  useEffect(() => {
    if (betaPhase !== 'playing-prologue' || !prologueData) return
    setPrologueRevealed('')
    setPrologueTypingDone(false)

    let i = 0
    prologueRevealRef.current = setInterval(() => {
      i += 2
      setPrologueRevealed(prologueData.prologue.slice(0, i))
      if (i >= prologueData.prologue.length) {
        if (prologueRevealRef.current) clearInterval(prologueRevealRef.current)
        prologueRevealRef.current = null
        setPrologueTypingDone(true)
      }
    }, 40)

    return () => {
      if (prologueRevealRef.current) clearInterval(prologueRevealRef.current)
    }
  }, [betaPhase, prologueData])

  function handlePrologueDone() {
    // Always go to character selection, even if only 1 option
    if (prologueData) {
      setBetaPhase('choosing-character')
    }
  }

  // ---- first scene generation ----
  async function generateFirstScene() {
    setError('')
    const g = useStore.getState().game
    if (!g) return
    try {
      const res = await fetch('/api/beta/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phase: 'scene',
          genre: g.genre,
          premise: g.premise,
          llmConfig: llmSettings,
          characterIdentity: g.characterIdentity || prologueData?.characterIdentity,
          characterBackground: g.characterBackground || prologueData?.characterBackground,
          storyPhase: 'beginning',
          sceneIndex: 1,
          context: [],
          language,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error((data as any).error || 'Generation failed')
      }
      const data: BetaSceneResponse = await res.json()

      setCurrentScene(
        { id: sessionId, narrative: data.narrative, imageUrl: '', imagePrompt: '', clues: data.clues || [] },
        mapChoices(data.choices),
        data.mood || 'calm',
        data.isEnding || false,
        data.endingText || null,
        data.endingTitle || '',
      )
      if (data.clues) addClues(data.clues)
      if (data.companionThought) setCompanionState(data.companionThought, data.companionRole)
      if (data.storyPhase) setStoryPhase(data.storyPhase)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      setError(msg)
    }
  }

  function mapChoices(betaChoices: BetaChoice[]) {
    return betaChoices.map((c) => ({
      id: c.id,
      text: c.text,
      type: c.type,
      allowCustom: c.allowCustom,
    }))
  }

  // ---- pre-gen branches when scene is displayed ----
  useEffect(() => {
    if (
      betaPhase !== 'playing' ||
      !game?.currentScene ||
      !game.currentChoices ||
      game.currentChoices.length === 0 ||
      game.status !== 'playing'
    ) return

    const choiceOptions = game.currentChoices.filter((c: any) => !c.type || c.type === 'choice')
    if (choiceOptions.length === 0) return

    preGenRef.current = false
    setBranches({})
    setTypingDone(false)
    setWaitingFor(null)

    const timer = setTimeout(() => startPreGen(choiceOptions), 200)
    return () => {
      clearTimeout(timer)
      abortRef.current?.abort()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game?.currentScene?.id, betaPhase])

  function startPreGen(choices: any[]) {
    const g = useStore.getState().game
    if (!g || preGenRef.current) return
    preGenRef.current = true
    abortRef.current?.abort()
    const ac = new AbortController()
    abortRef.current = ac

    const context = buildContext(g)
    const sceneIndex = g.completedScenes.length + 2

    choices.forEach((choice) => {
      fetchBetaBranch(choice.id, choice.text, context, sceneIndex, ac.signal)
    })
  }

  async function fetchBetaBranch(
    choiceId: string,
    choiceText: string,
    context: ContextEntry[],
    sceneIndex: number,
    signal: AbortSignal,
  ) {
    const g = useStore.getState().game
    if (!g) return
    try {
      const res = await fetch('/api/beta/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phase: 'scene',
          genre: g.genre,
          premise: g.premise,
          context,
          choice: { id: choiceId, text: choiceText },
          llmConfig: llmSettings,
          characterIdentity: g.characterIdentity || '',
          characterBackground: g.characterBackground || '',
          storyPhase: g.storyPhase || 'development',
          sceneIndex,
          language,
        }),
        signal,
      })
      if (!res.ok) throw new Error('Branch generation failed')
      const data: BetaSceneResponse = await res.json()
      setBranches((prev) => ({ ...prev, [choiceId]: data }))
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return
    }
  }

  // ---- watch for branch readiness ----
  useEffect(() => {
    if (!waitingFor) return
    const branch = branches[waitingFor]
    if (branch) {
      applyBetaBranch(waitingFor, branch)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branches])

  function applyBetaBranch(choiceId: string, branch: BetaSceneResponse) {
    const g = useStore.getState().game
    if (!g) return

    advanceToScene({
      scene: {
        id: `${sessionId}_s${g.completedScenes.length + 1}`,
        narrative: branch.narrative,
        imageUrl: '',
        imagePrompt: '',
        clues: branch.clues || [],
      },
      choices: mapChoices(branch.choices),
      mood: branch.mood || 'calm',
      historyEntry: {
        sceneId: g.currentScene?.id || '',
        choiceId,
        choiceText: branch.narrative.slice(0, 30),
        mood: g.currentMood || 'calm',
      },
      isEnding: branch.isEnding || false,
      endingText: branch.endingText || null,
      endingTitle: branch.endingTitle || '',
    })

    setBranches({})
    setWaitingFor(null)
    setViewingHistoryIndex(null)
    setTypingDone(false)
    saveCurrentGame()

    if (branch.clues) addClues(branch.clues)
    if (branch.companionThought) setCompanionState(branch.companionThought, branch.companionRole)
    if (branch.storyPhase) setStoryPhase(branch.storyPhase)
  }

  // ---- handle choice from user ----
  function handleChoice(choiceId: string, customInput?: string) {
    const choice = game?.currentChoices?.find((c) => c.id === choiceId)

    // Free action: no matching choice, use the typed text
    if (!choice) {
      setWaitingFor(choiceId)
      generateBranchOnDemand(choiceId, customInput || '')
      return
    }

    const isTransition = (choice as any)?.type === 'transition'
    if (isTransition) {
      handleTransition(choiceId)
      return
    }

    const branch = branches[choiceId]
    if (branch) {
      applyBetaBranch(choiceId, branch)
    } else {
      setWaitingFor(choiceId)
      generateBranchOnDemand(choiceId, customInput)
    }
  }

  async function handleTransition(choiceId: string) {
    const g = useStore.getState().game
    if (!g) return
    const context = buildContext(g)
    const sceneIndex = g.completedScenes.length + 2

    try {
      const res = await fetch('/api/beta/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phase: 'scene',
          genre: g.genre,
          premise: g.premise,
          context,
          llmConfig: llmSettings,
          characterIdentity: g.characterIdentity || '',
          characterBackground: g.characterBackground || '',
          storyPhase: g.storyPhase || 'development',
          sceneIndex,
        }),
      })
      if (!res.ok) throw new Error('Transition failed')
      const data: BetaSceneResponse = await res.json()

      advanceToScene({
        scene: {
          id: `${sessionId}_s${g.completedScenes.length + 1}`,
          narrative: data.narrative,
          imageUrl: '',
          imagePrompt: '',
          clues: data.clues || [],
        },
        choices: mapChoices(data.choices),
        mood: data.mood || 'calm',
        historyEntry: {
          sceneId: g.currentScene?.id || '',
          choiceId,
          choiceText: data.narrative.slice(0, 30),
          mood: g.currentMood || 'calm',
        },
        isEnding: data.isEnding || false,
        endingText: data.endingText || null,
        endingTitle: data.endingTitle || '',
      })

      setTypingDone(false)
      saveCurrentGame()
      if (data.clues) addClues(data.clues)
      if (data.companionThought) setCompanionState(data.companionThought, data.companionRole)
      if (data.storyPhase) setStoryPhase(data.storyPhase)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      setError(msg)
    }
  }

  async function generateBranchOnDemand(choiceId: string, customInput?: string) {
    const g = useStore.getState().game
    if (!g) return
    const context = buildContext(g)
    const sceneIndex = g.completedScenes.length + 2

    try {
      const res = await fetch('/api/beta/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phase: 'scene',
          genre: g.genre,
          premise: g.premise,
          context,
          choice: { id: choiceId, text: customInput || '' },
          llmConfig: llmSettings,
          characterIdentity: g.characterIdentity || '',
          characterBackground: g.characterBackground || '',
          storyPhase: g.storyPhase || 'development',
          sceneIndex,
          language,
        }),
      })
      if (!res.ok) throw new Error('Generation failed')
      const data: BetaSceneResponse = await res.json()
      applyBetaBranch(choiceId, data)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      setError(msg)
    }
  }

  // ---- ending sequence (same as original) ----
  useEffect(() => {
    if (game?.status !== 'completed' || !typingDone || isHistoryView || endingPhase !== 'none') return
    const t1 = setTimeout(() => setEndingPhase('fade'), 800)
    return () => clearTimeout(t1)
  }, [game?.status, typingDone, isHistoryView])

  useEffect(() => {
    if (endingPhase !== 'fade') return
    const next = game?.endingText ? 'typing' as const : 'end' as const
    const t = setTimeout(() => setEndingPhase(next), 1500)
    return () => clearTimeout(t)
  }, [endingPhase, game?.endingText])

  useEffect(() => {
    if (endingPhase !== 'typing' || !game?.endingText) return
    let i = 0
    setTypingComplete(false)
    revealRef.current = setInterval(() => {
      i++
      setRevealedText(game.endingText!.slice(0, i))
      if (i >= game.endingText!.length) {
        clearInterval(revealRef.current!)
        revealRef.current = null
        setTypingComplete(true)
      }
    }, 50)
    return () => {
      if (revealRef.current) clearInterval(revealRef.current)
    }
  }, [endingPhase, game?.endingText])

  // ---- history navigation ----
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (!game || game.history.length === 0) return
      if (e.key === 'ArrowLeft') {
        if (viewingHistoryIndex === null) {
          setViewingHistoryIndex(game.history.length - 1)
        } else if (viewingHistoryIndex > 0) {
          setViewingHistoryIndex(viewingHistoryIndex - 1)
        }
      } else if (e.key === 'ArrowRight') {
        if (viewingHistoryIndex === null) {
          setViewingHistoryIndex(0)
        } else if (viewingHistoryIndex < game.history.length - 1) {
          setViewingHistoryIndex(viewingHistoryIndex + 1)
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [game, viewingHistoryIndex])

  // ---- error dismiss ----
  useEffect(() => {
    if (!error) return
    const t = setTimeout(() => setError(''), 5000)
    return () => clearTimeout(t)
  }, [error])

  function handleRestart() {
    abortRef.current?.abort()
    clearGame()
    router.push('/lobby')
  }

  // ---- history helpers ----
  function getDisplayScene() {
    if (viewingHistoryIndex === null || !game) {
      return { scene: game?.currentScene ?? null, choice: null, historyMood: null }
    }
    const scene = game.completedScenes[viewingHistoryIndex]
    const choice = game.history[viewingHistoryIndex]
    return { scene: scene ?? null, choice: choice ?? null, historyMood: (choice?.mood as Mood) ?? null }
  }

  // ---- render ----
  if (!game) return null

  const readyCount = Object.values(branches).filter((b) => b).length
  const totalBranches = Object.keys(branches).length
  const display = getDisplayScene()

  // ---- Character Select screen (black bg, white border, light text) ----
  if (betaPhase === 'choosing-character' && prologueData) {
    const options = prologueData.characterOptions && prologueData.characterOptions.length > 0
      ? prologueData.characterOptions
      : prologueData.characterIdentity
        ? [{ id: 'default', identity: prologueData.characterIdentity, background: prologueData.characterBackground }]
        : []

    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black">
        <div className="max-w-lg w-full px-8 py-12">
          <p className="text-xs tracking-widest mb-10 text-center text-white/40">
            {language === 'zh' ? '选择你的角色' : 'Choose Your Character'}
          </p>
          <div className="flex flex-col gap-4">
            {options.map((char) => (
              <button
                key={char.id}
                onClick={() => handleCharacterSelect(char)}
                className="group w-full text-left transition-all duration-400 hover:-translate-y-1 active:scale-[0.98]"
              >
                <div className="relative overflow-hidden rounded-sm border border-white/20 bg-black/40">
                  <div
                    className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-400"
                    style={{ background: 'rgba(255,255,255,0.06)' }}
                  />
                  <div className="relative px-6 py-5">
                    <p className="text-base tracking-wide mb-2 font-medium text-zinc-300">{char.identity}</p>
                    <p className="text-sm text-white/40 leading-relaxed">{char.background}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // ---- Main game layout (same structure as original game page) ----
  return (
    <>
      {game.currentScene && (
        <BGMPlayer mood={isHistoryView && display.historyMood ? display.historyMood : currentMood} enabled={bgmEnabled} />
      )}

      <div
        className={"flex flex-col flex-1 items-center px-6 py-8 transition-all duration-700" + (isHistoryView ? ' pb-20' : '')}
        style={{ backgroundColor: theme.bg, color: theme.text }}
      >
        <div className="w-full max-w-2xl flex flex-col gap-8">
          {/* top bar (same as original) */}
          <div
            className="flex items-center justify-between text-xs tracking-wider transition-colors duration-500"
            style={{ color: theme.textMuted }}
          >
            <button onClick={handleRestart} className="hover:opacity-70 transition-opacity">BACK</button>

            {isHistoryView ? (
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setViewingHistoryIndex(Math.max(0, viewingHistoryIndex! - 1))}
                  disabled={viewingHistoryIndex === 0}
                  className="disabled:opacity-20 hover:opacity-70"
                >&lt;</button>
                <button onClick={() => setShowHistoryList(true)} className="hover:underline">
                  HISTORY {viewingHistoryIndex! + 1}/{game.history.length}
                </button>
                <button
                  onClick={() => setViewingHistoryIndex(Math.min(game.history.length - 1, viewingHistoryIndex! + 1))}
                  disabled={viewingHistoryIndex === game.history.length - 1}
                  className="disabled:opacity-20 hover:opacity-70"
                >&gt;</button>
              </div>
            ) : (
              <div className="flex items-center gap-4">
                {characterIdentity && (
                  <span className="text-sm tracking-wider font-medium" style={{ color: theme.text }}>
                    {characterIdentity}
                  </span>
                )}
                <span className="text-[11px]" style={{ color: theme.textMuted }}>CHAPTER {game.completedScenes.length + 1}</span>
                {game.storyPhase && (
                  <span className="text-[10px] uppercase tracking-widest" style={{ color: theme.textMuted }}>
                    {phaseLabel(game.storyPhase)}
                  </span>
                )}
              </div>
            )}

            <div className="flex items-center gap-3">
              <button
                onClick={() => setBgmEnabled(!bgmEnabled)}
                className="hover:opacity-70 transition-opacity tracking-wider"
                style={{ color: bgmEnabled ? theme.textSecondary : theme.textMuted }}
              >BGM:{bgmEnabled ? 'ON' : 'OFF'}</button>
              <button
                onClick={() => setCompanionEnabled(!companionEnabled)}
                className="hover:opacity-70 transition-opacity tracking-wider"
                style={{ color: companionEnabled ? theme.textSecondary : theme.textMuted }}
              >AI:{companionEnabled ? 'ON' : 'OFF'}</button>
              <span>¥{balance}</span>
            </div>

            <button
              onClick={() => {
                if (game.history.length > 0) setViewingHistoryIndex(game.history.length - 1)
              }}
              className="hover:opacity-70 transition-opacity"
              style={{
                opacity: game.history.length > 0 ? 1 : 0,
                pointerEvents: game.history.length > 0 ? 'auto' : 'none',
              }}
            >HISTORY ({game.history.length})</button>
          </div>

          {/* history list overlay */}
          {showHistoryList && (
            <div
              className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center pt-20"
              onClick={() => setShowHistoryList(false)}
            >
              <div
                className="w-full max-w-lg max-h-[60vh] overflow-y-auto rounded-sm shadow-xl"
                style={{ backgroundColor: theme.bgCard, border: `1px solid ${theme.border}` }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="px-5 py-4 text-xs tracking-widest" style={{ color: theme.textMuted }}>HISTORY</div>
                {game.history.map((entry, i) => {
                  const pastScene = game.completedScenes[i]
                  const isActive = viewingHistoryIndex === i
                  return (
                    <button
                      key={entry.sceneId}
                      onClick={() => { setViewingHistoryIndex(i); setShowHistoryList(false) }}
                      className="w-full text-left px-5 py-3.5 transition-colors duration-200 border-t"
                      style={{
                        borderColor: theme.border,
                        backgroundColor: isActive ? theme.border : 'transparent',
                      }}
                    >
                      <div className="text-xs tracking-widest mb-1" style={{ color: theme.textMuted }}>CHAPTER {i + 1}</div>
                      <div className="text-sm leading-relaxed line-clamp-2" style={{ color: theme.text }}>
                        {pastScene?.narrative.slice(0, 80) || ''}{pastScene && pastScene.narrative.length > 80 ? '...' : ''}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* error */}
          {error && (
            <div className="text-xs text-red-400 text-center py-2 px-4 border border-red-100 rounded-sm">{error}</div>
          )}

          {/* scene content */}
          {display.scene && (
            <>
              <div className="px-1">
                {isHistoryView ? (
                  <div className="text-base leading-relaxed whitespace-pre-wrap" style={{ color: theme.text }}>
                    {display.scene.narrative}
                  </div>
                ) : (
                  <>
                    <NarrativeText text={display.scene.narrative} onComplete={onTypingDone} textColor={theme.text} />
                    {!typingDone && (
                      <p className="text-xs mt-4 tracking-wider" style={{ color: theme.textMuted }}>CLICK TO SKIP</p>
                    )}
                  </>
                )}
              </div>

              {/* history: show the chosen choice */}
              {isHistoryView && display.choice && (
                <div className="px-1 mt-2">
                  <div className="text-sm py-3 px-4 rounded-sm tracking-wide" style={{ color: theme.textSecondary, border: `1px solid ${theme.border}` }}>
                    → {display.choice.choiceText}
                  </div>
                </div>
              )}

              {/* FlexibleChoices (beta's unique difference from original) */}
              {!isHistoryView && typingDone && !waitingFor && game.status === 'playing' && game.currentChoices.length > 0 && (
                <FlexibleChoices
                  choices={game.currentChoices as any[]}
                  onChoice={handleChoice}
                  disabled={false}
                  themeBorder={theme.border}
                  themeText={theme.text}
                  themeTextSecondary={theme.textSecondary}
                  themeAccent={theme.textSecondary}
                />
              )}

              {/* Free text input — always available for custom actions */}
              {!isHistoryView && typingDone && !waitingFor && game.status === 'playing' && (
                <FreeActionInput
                  onSubmit={(text) => handleChoice('__free__', text)}
                  disabled={false}
                  themeBorder={theme.border}
                  themeText={theme.text}
                  themeTextSecondary={theme.textSecondary}
                />
              )}

              {/* waiting */}
              {!isHistoryView && waitingFor && (
                <div className="flex items-center justify-center py-8">
                  <div className="text-xs tracking-widest animate-pulse" style={{ color: theme.textMuted }}>
                    PREPARING THIS PATH...
                  </div>
                </div>
              )}

              {/* branch readiness indicator */}
              {!isHistoryView && typingDone && game.status === 'playing' && totalBranches > 0 && (
                <div className="text-center text-xs mt-2 tracking-wider" style={{ color: theme.textMuted }}>
                  {readyCount}/{totalBranches} PATHS READY
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Prologue overlay — shows setup text, then role identity */}
      {betaPhase === 'playing-prologue' && prologueData && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black">
          <div
            className="max-w-2xl px-8 text-center"
            onClick={prologueTypingDone ? handlePrologueDone : () => {
              if (prologueRevealRef.current) clearInterval(prologueRevealRef.current)
              setPrologueRevealed(prologueData.prologue)
              setPrologueTypingDone(true)
            }}
          >
            <p className="text-xs tracking-widest mb-8 text-white/40">序章</p>
            <div className="text-base leading-relaxed whitespace-pre-wrap text-white">
              {prologueRevealed}
              {!prologueTypingDone && <span className="animate-pulse text-white/50">▌</span>}
            </div>

            {prologueTypingDone && (
              <p className="text-xs text-white/40 tracking-wider mt-8 animate-fade-in-up">点击继续</p>
            )}
          </div>
        </div>
      )}

      {/* Loading overlay */}
      {betaPhase === 'generating-prologue' && (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black gap-4">
          <div className="text-xs tracking-widest animate-pulse text-white/50">生成前情提要...</div>
        </div>
      )}

      {/* Ending overlay (same as original) */}
      {endingPhase !== 'none' && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black"
          style={{ opacity: endingPhase === 'fade' ? 0 : 1, transition: 'opacity 1.5s ease-in-out' }}
        >
          {endingPhase === 'typing' && (
            <div className="max-w-2xl px-8 text-center" onClick={typingComplete ? () => setEndingPhase('end') : undefined}>
              <div className="text-base leading-relaxed whitespace-pre-wrap text-white">
                {revealedText}
                {!typingComplete && <span className="animate-pulse text-white/50">▌</span>}
              </div>
              {typingComplete && (
                <p className="text-xs text-white/40 tracking-wider mt-8 animate-fade-in-up">CLICK ANYWHERE TO CONTINUE</p>
              )}
            </div>
          )}
          {endingPhase === 'end' && (
            <div className="text-center z-10 animate-fade-in-up">
              <h1 className="text-3xl tracking-[0.3em] text-white mb-6 font-light">THE END</h1>
              <p className="text-base tracking-widest mb-12 text-white/70 italic">「{game?.endingTitle || game?.title}」</p>
              <button
                onClick={handleRestart}
                className="px-8 py-3 text-xs tracking-widest transition-all duration-200 border border-white/30 text-white/70 hover:border-white hover:text-white"
              >
                START A NEW STORY
              </button>
            </div>
          )}
        </div>
      )}

      {game.currentScene && (
        <ClueSidebar
          clues={game.clues}
          themeBorder={theme.border}
          themeBgCard={theme.bgCard}
          themeText={theme.text}
          themeTextSecondary={theme.textSecondary}
          themeTextMuted={theme.textMuted}
        />
      )}

      <CompanionBubble
        thought={game.companionThought}
        role={game.companionRole}
        enabled={companionEnabled}
        themeBorder={theme.border}
        themeBgCard={theme.bgCard}
        themeText={theme.text}
        themeTextMuted={theme.textMuted}
        bottomNav={isHistoryView}
      />

      {/* history bottom nav */}
      {isHistoryView && game.history.length > 0 && (
        <div
          className="fixed bottom-0 left-0 right-0 z-40 flex items-center justify-center gap-8 py-4 px-6 border-t"
          style={{ backgroundColor: theme.bg, borderColor: theme.border }}
        >
          <button
            onClick={() => setViewingHistoryIndex(Math.max(0, viewingHistoryIndex! - 1))}
            disabled={viewingHistoryIndex === 0}
            className="text-sm tracking-wider disabled:opacity-20 hover:opacity-70"
            style={{ color: theme.textMuted }}
          >&lt; PREV</button>
          <button
            onClick={() => setViewingHistoryIndex(null)}
            className="text-sm tracking-wider hover:opacity-70"
            style={{ color: theme.textSecondary }}
          >BACK TO CURRENT</button>
          <button
            onClick={() => setViewingHistoryIndex(Math.min(game.history.length - 1, viewingHistoryIndex! + 1))}
            disabled={viewingHistoryIndex === game.history.length - 1}
            className="text-sm tracking-wider disabled:opacity-20 hover:opacity-70"
            style={{ color: theme.textMuted }}
          >NEXT &gt;</button>
        </div>
      )}
    </>
  )
}

function phaseLabel(phase: string): string {
  const labels: Record<string, string> = {
    beginning: '序幕',
    development: '发展',
    climax: '高潮',
    ending: '终章',
  }
  return labels[phase] || phase
}
