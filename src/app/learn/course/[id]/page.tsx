'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { COURSES } from '@/learn/courses'
import { useLearnStore } from '@/learn/store'
import { useStore } from '@/lib/store'
import NarrativeText from '@/components/NarrativeText'
import type { LearnChoice, LearnSceneResponse, KnowledgePoint, LearnMistake } from '@/learn/types'

type LearnPhase = 'concept' | 'scenario' | 'practice' | 'review'

export default function LearnCoursePage() {
  const router = useRouter()
  const params = useParams()
  const courseId = params?.id as string
  const userCourses = useLearnStore((s) => s.userCourses)
  const course = [...COURSES, ...userCourses].find((c) => c.id === courseId)
  const llmSettings = useStore((s) => s.llmSettings)

  const progresses = useLearnStore((s) => s.progresses)
  const updateProgress = useLearnStore((s) => s.updateProgress)

  const [phase, setPhase] = useState<LearnPhase>('concept')
  const [nodeIndex, setNodeIndex] = useState(0)
  const [narrative, setNarrative] = useState('')
  const [choices, setChoices] = useState<LearnChoice[]>([])
  const [knowledgePoints, setKnowledgePoints] = useState<KnowledgePoint[]>([])
  const [companionTip, setCompanionTip] = useState('')
  const [typingDone, setTypingDone] = useState(false)

  // Feedback state
  const [feedback, setFeedback] = useState<{ text: string; isCorrect: boolean | null } | null>(null)
  const [mistakes, setMistakes] = useState<LearnMistake[]>([])

  // Summary / end
  const [showSummary, setShowSummary] = useState(false)
  const [summary, setSummary] = useState('')
  const [score, setScore] = useState(0)

  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')

  const [showStart, setShowStart] = useState(false)
  const [showResume, setShowResume] = useState(false)
  const [resumeData, setResumeData] = useState<{ node: number; kps: KnowledgePoint[]; errs: LearnMistake[] } | null>(null)

  const typingDoneRef = useRef(false)
  typingDoneRef.current = typingDone

  // ---- redirect if course not found ----
  useEffect(() => {
    if (!course) router.push('/learn')
  }, [course, router])

  // Resume state — restore from saved progress
  const [initialized, setInitialized] = useState(false)

  useEffect(() => {
    if (!course || initialized) return
    setInitialized(true)
    const saved = progresses[courseId]

    if (saved?.status === 'completed') {
      setShowSummary(true)
      setScore(saved.score)
      return
    }

    if (saved?.status === 'in-progress' && saved.currentNode > 0) {
      setResumeData({
        node: saved.currentNode,
        kps: saved.knowledgePoints || [],
        errs: saved.mistakes || [],
      })
      setShowResume(true)
      return
    }

    setShowStart(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId])

  const onTypingDone = useCallback(() => {
    setTypingDone(true)
  }, [])

  // ---- generate scene ----
  async function generateScene(idx: number, currentPhase: LearnPhase, context: any[]) {
    if (!course || !llmSettings?.apiUrl || !llmSettings?.apiKey) {
      setError('请先在 Settings 中配置 LLM API')
      return
    }
    setGenerating(true)
    setError('')
    setFeedback(null)
    setTypingDone(false)
    setCompanionTip('')

    try {
      const isCustom = course.id.startsWith('custom_')
      const res = await fetch('/api/learn/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseId: course.id,
          nodeIndex: idx + 1,
          context,
          choices: context.filter((c: any) => c.chosenText),
          phase: currentPhase,
          llmConfig: llmSettings,
          language: 'zh',
          ...(isCustom ? { courseData: course } : {}),
        }),
      })
      if (!res.ok) throw new Error('生成失败')
      const data: LearnSceneResponse = await res.json()

      setNarrative(data.narrative)
      setChoices(data.choices || [])
      setCompanionTip(data.companionTip || '')

      // Track knowledge points
      if (data.knowledgePoints) {
        setKnowledgePoints((prev) => {
          const existing = new Set(prev.map((k) => k.id))
          const newKps = data.knowledgePoints.filter((kp) => !existing.has(kp.id)).map((kp) => ({
            ...kp,
            mastered: false,
            acquiredAt: idx,
          }))
          return [...prev, ...newKps]
        })
      }

      if (data.isEnd) {
        setSummary(data.summary || '')
        setScore(data.score ?? 0)
        setShowSummary(true)

        // Mark as completed
        const allKps = [...knowledgePoints]
        const existing = new Set(allKps.map((k) => k.id))
        if (data.knowledgePoints) {
          data.knowledgePoints.forEach((kp) => {
            if (!existing.has(kp.id)) {
              allKps.push({ ...kp, mastered: false, acquiredAt: idx })
            }
          })
        }
        updateProgress(courseId, {
          status: 'completed',
          currentNode: idx + 1,
          knowledgePoints: allKps,
          mistakes,
          score: data.score ?? score,
          completedAt: new Date().toISOString(),
        })
        return
      }

      // Save progress
      updateProgress(courseId, {
        status: 'in-progress',
        currentNode: idx + 1,
        knowledgePoints,
        mistakes,
        score: 0,
      })

      setNodeIndex(idx + 1)
      setPhase(idx < 2 ? 'concept' : 'scenario')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      setError(msg)
    } finally {
      setGenerating(false)
    }
  }

  // ---- handle choice ----
  function handleChoice(choiceId: string) {
    const choice = choices.find((c) => c.id === choiceId)
    if (!choice) return

    // Show feedback
    setFeedback({ text: choice.explanation, isCorrect: choice.isCorrect })

    // Track mistake
    if (choice.isCorrect === false) {
      setMistakes((prev) => [
        ...prev,
        {
          sceneIndex: nodeIndex,
          question: choice.text,
          userAnswer: choice.text,
          correctAnswer: choices.find((c) => c.isCorrect === true)?.text || choice.text,
          explanation: choice.explanation,
        },
      ])
    }

    // Mark knowledge points as mastered if correct
    if (choice.isCorrect === true) {
      setKnowledgePoints((prev) =>
        prev.map((kp) => {
          const sceneKps = choices.filter((c) => c.isCorrect === true)
          return sceneKps.length > 0 ? { ...kp, mastered: true } : kp
        })
      )
    }

    // Build context for next scene
    const contextEntry = {
      narrative,
      chosenText: choice.text,
      feedback: choice.explanation,
      isCorrect: choice.isCorrect,
    }

    // After brief delay, generate next scene
    setTimeout(() => {
      setFeedback(null)
      const nextIdx = nodeIndex + 1
      const currentPhase = nextIdx < 2 ? 'concept' as const : 'scenario' as const
      generateScene(nextIdx, currentPhase, [
        ...(nodeIndex > 0 ? [{ narrative: '', chosenText: '', feedback: '' }] : []),
        contextEntry,
      ])
    }, 2500)
  }

  // ---- handle restart ----
  function handleRestart() {
    setNodeIndex(0)
    setPhase('concept')
    setNarrative('')
    setChoices([])
    setKnowledgePoints([])
    setCompanionTip('')
    setFeedback(null)
    setMistakes([])
    setShowSummary(false)
    setSummary('')
    setScore(0)
    setTypingDone(false)
    setGenerating(false)

    updateProgress(courseId, {
      status: 'not-started',
      currentNode: 0,
      knowledgePoints: [],
      mistakes: [],
      score: 0,
    })

    generateScene(0, 'concept', [])
  }

  if (!course) return null

  // ==== Start screen ====
  if (showStart) {
    return (
      <div className="flex items-center justify-center min-h-screen" style={{ background: '#faf8f5' }}>
        <div className="max-w-lg mx-auto px-6 text-center">
          <div
            className="rounded-2xl p-8"
            style={{
              background: 'rgba(255,255,255,0.7)',
              border: '1px solid rgba(0,0,0,0.04)',
            }}
          >
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-4"
              style={{
                background: 'rgba(0,0,0,0.03)',
                border: '1px solid rgba(0,0,0,0.06)',
              }}
            >
              <span className="text-sm" style={{ color: '#636366' }}>{course.icon}</span>
            </div>
            <h1
              className="text-base mb-2"
              style={{
                fontFamily: 'var(--font-noto-serif-sc)',
                fontWeight: 300,
                letterSpacing: '0.2em',
                color: '#1c1c1e',
              }}
            >
              {course.title}
            </h1>
            <p className="text-[11px] leading-relaxed mb-6" style={{ color: '#8e8e93', letterSpacing: '0.06em' }}>
              {course.description}
            </p>
            {course.objectives.length > 0 && (
              <div className="mb-6 text-left">
                <p className="text-[10px] tracking-wider mb-2" style={{ color: '#aeaeb2' }}>
                  学习目标
                </p>
                <ul className="flex flex-col gap-1.5">
                  {course.objectives.map((obj, i) => (
                    <li key={i} className="text-[11px] pl-3" style={{ color: '#636366', borderLeft: '1px solid rgba(0,0,0,0.08)' }}>
                      {obj}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="flex items-center justify-center gap-3 mb-6 text-[10px]" style={{ color: '#aeaeb2' }}>
              <span>{course.estimatedMinutes} 分钟</span>
              <span style={{ color: 'rgba(0,0,0,0.06)' }}>/</span>
              <span>{course.totalNodes} 个场景</span>
            </div>
            <div className="flex items-center justify-center gap-3">
              <Link
                href="/learn"
                className="px-5 py-2 text-xs tracking-wider transition-all duration-200"
                style={{
                  borderRadius: '10px',
                  border: '1px solid rgba(0,0,0,0.08)',
                  color: '#636366',
                }}
              >
                退出
              </Link>
              <button
                onClick={() => {
                  setShowStart(false)
                  generateScene(0, 'concept', [])
                }}
                className="px-5 py-2 text-xs tracking-wider transition-all duration-200"
                style={{
                  borderRadius: '10px',
                  background: '#1c1c1e',
                  color: '#fff',
                }}
              >
                确认开始
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ==== Resume screen ====
  if (showResume && resumeData) {
    const progressPct = Math.round((resumeData.node / course.totalNodes) * 100)
    return (
      <div className="flex items-center justify-center min-h-screen" style={{ background: '#faf8f5' }}>
        <div className="max-w-lg mx-auto px-6 text-center">
          <div
            className="rounded-2xl p-8"
            style={{
              background: 'rgba(255,255,255,0.7)',
              border: '1px solid rgba(0,0,0,0.04)',
            }}
          >
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-4"
              style={{
                background: 'rgba(0,0,0,0.03)',
                border: '1px solid rgba(0,0,0,0.06)',
              }}
            >
              <span className="text-sm" style={{ color: '#636366' }}>{course.icon}</span>
            </div>
            <h1
              className="text-base mb-2"
              style={{
                fontFamily: 'var(--font-noto-serif-sc)',
                fontWeight: 300,
                letterSpacing: '0.2em',
                color: '#1c1c1e',
              }}
            >
              {course.title}
            </h1>
            <p className="text-[11px] leading-relaxed mb-4" style={{ color: '#8e8e93', letterSpacing: '0.06em' }}>
              {course.description}
            </p>

            <div className="w-full h-1 rounded-full mb-2" style={{ background: 'rgba(0,0,0,0.04)' }}>
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${progressPct}%`,
                  background: '#1c1c1e',
                }}
              />
            </div>
            <p className="text-[10px] tracking-wider mb-6" style={{ color: '#aeaeb2' }}>
              已完成 {resumeData.node}/{course.totalNodes} 个场景 ({progressPct}%)
            </p>

            {resumeData.kps.filter(k => k.mastered).length > 0 && (
              <div className="mb-6 text-left">
                <p className="text-[10px] tracking-wider mb-2" style={{ color: '#aeaeb2' }}>
                  已掌握知识点
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {resumeData.kps.filter(k => k.mastered).map((kp) => (
                    <span
                      key={kp.id}
                      className="text-[9px] tracking-wider px-2 py-1 rounded-full"
                      style={{
                        background: 'rgba(44,110,73,0.08)',
                        color: '#2c6e49',
                        border: '1px solid rgba(44,110,73,0.15)',
                      }}
                    >
                      ✓ {kp.name}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {resumeData.errs.length > 0 && (
              <div className="mb-6 text-left">
                <p className="text-[10px] tracking-wider mb-2" style={{ color: '#aeaeb2' }}>
                  待复习错题 ({resumeData.errs.length})
                </p>
                {resumeData.errs.slice(0, 2).map((m, i) => (
                  <div
                    key={i}
                    className="py-1.5 px-2 mb-1 rounded text-[10px]"
                    style={{ background: 'rgba(0,0,0,0.02)', border: '1px solid rgba(0,0,0,0.04)' }}
                  >
                    <span style={{ color: '#c41e3a' }}>✗ {m.question}</span>
                  </div>
                ))}
                {resumeData.errs.length > 2 && (
                  <p className="text-[9px] mt-1" style={{ color: '#aeaeb2' }}>还有 {resumeData.errs.length - 2} 道错题...</p>
                )}
              </div>
            )}

            <div className="flex items-center justify-center gap-3">
              <Link
                href="/learn"
                className="px-5 py-2 text-xs tracking-wider transition-all duration-200 inline-block"
                style={{
                  borderRadius: '10px',
                  border: '1px solid rgba(0,0,0,0.08)',
                  color: '#aeaeb2',
                }}
              >
                退出
              </Link>
              <button
                onClick={() => {
                  updateProgress(courseId, {
                    status: 'not-started',
                    currentNode: 0,
                    knowledgePoints: [],
                    mistakes: [],
                    score: 0,
                  })
                  setShowResume(false)
                  setShowStart(true)
                }}
                className="px-5 py-2 text-xs tracking-wider transition-all duration-200"
                style={{
                  borderRadius: '10px',
                  border: '1px solid rgba(0,0,0,0.08)',
                  color: '#636366',
                }}
              >
                重新开始
              </button>
              <button
                onClick={() => {
                  setShowResume(false)
                  setNodeIndex(resumeData.node)
                  if (resumeData.kps.length) setKnowledgePoints(resumeData.kps)
                  if (resumeData.errs.length) setMistakes(resumeData.errs)
                  generateScene(resumeData.node, resumeData.node < 2 ? 'concept' : 'scenario', [])
                }}
                className="px-5 py-2 text-xs tracking-wider transition-all duration-200"
                style={{
                  borderRadius: '10px',
                  background: '#1c1c1e',
                  color: '#fff',
                }}
              >
                继续学习
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ==== Summary screen ====
  if (showSummary) {
    return (
      <div className="flex items-center justify-center min-h-screen" style={{ background: '#faf8f5' }}>
        <div className="max-w-lg mx-auto px-6 text-center">
          <div
            className="rounded-2xl p-8"
            style={{
              background: 'rgba(255,255,255,0.7)',
              border: '1px solid rgba(0,0,0,0.04)',
            }}
          >
            <span className="text-3xl mb-4 block">{course.icon}</span>
            <h1 className="text-base tracking-[0.2em] mb-2" style={{ color: '#1c1c1e' }}>
              {course.title}
            </h1>
            <div className="text-4xl font-light tracking-wider my-6" style={{ color: '#1c1c1e' }}>
              {score}%
            </div>
            <p className="text-[10px] tracking-wider mb-6" style={{ color: '#8e8e93' }}>
              掌握度
            </p>
            {summary && (
              <div
                className="text-sm leading-relaxed mb-6 text-left"
                style={{ color: '#636366', letterSpacing: '0.03em' }}
              >
                {summary}
              </div>
            )}
            {mistakes.length > 0 && (
              <div className="mb-6 text-left">
                <p className="text-[10px] tracking-wider mb-2" style={{ color: '#aeaeb2' }}>
                  错题回顾 ({mistakes.length})
                </p>
                {mistakes.map((m, i) => (
                  <div
                    key={i}
                    className="py-2 px-3 mb-2 rounded-lg text-xs"
                    style={{ background: 'rgba(0,0,0,0.02)', border: '1px solid rgba(0,0,0,0.04)' }}
                  >
                    <p style={{ color: '#c41e3a' }}>✗ {m.question}</p>
                    <p className="mt-1" style={{ color: '#2c6e49' }}>✓ {m.correctAnswer}</p>
                    <p className="mt-1 text-[10px]" style={{ color: '#8e8e93' }}>{m.explanation}</p>
                  </div>
                ))}
              </div>
            )}
            <div className="flex items-center justify-center gap-4">
              <button
                onClick={handleRestart}
                className="px-5 py-2 text-xs tracking-wider transition-all duration-200"
                style={{
                  borderRadius: '10px',
                  border: '1px solid rgba(0,0,0,0.08)',
                  color: '#636366',
                }}
              >
                重新学习
              </button>
              <Link
                href="/learn"
                className="px-5 py-2 text-xs tracking-wider transition-all duration-200"
                style={{
                  borderRadius: '10px',
                  background: '#1c1c1e',
                  color: '#fff',
                }}
              >
                返回学习空间
              </Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ===== Main learning interface =====
  return (
    <div style={{ background: '#faf8f5', minHeight: '100vh' }}>
      <div className="max-w-2xl mx-auto px-6 py-8">
        {/* Header bar */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Link
              href="/learn"
              className="text-[10px] tracking-wider transition-colors hover:opacity-60"
              style={{ color: '#aeaeb2' }}
            >
              ← 退出
            </Link>
            <span style={{ color: 'rgba(0,0,0,0.06)' }}>/</span>
            <span className="text-[10px] tracking-wider" style={{ color: '#8e8e93' }}>
              {course.icon} {course.title}
            </span>
          </div>
          <span className="text-[10px] tracking-wider" style={{ color: '#aeaeb2' }}>
            {nodeIndex}/{course.totalNodes}
          </span>
        </div>

        {/* Progress bar */}
        <div className="w-full h-0.5 rounded-full mb-8" style={{ background: 'rgba(0,0,0,0.04)' }}>
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${course.totalNodes > 0 ? Math.round((nodeIndex / course.totalNodes) * 100) : 0}%`,
              background: '#1c1c1e',
            }}
          />
        </div>

        {/* Knowledge points */}
        {knowledgePoints.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-6">
            {knowledgePoints.map((kp) => (
              <span
                key={kp.id}
                className="text-[9px] tracking-wider px-2 py-1 rounded-full transition-all duration-300"
                style={{
                  background: kp.mastered ? 'rgba(44,110,73,0.08)' : 'rgba(0,0,0,0.03)',
                  color: kp.mastered ? '#2c6e49' : '#aeaeb2',
                  border: `1px solid ${kp.mastered ? 'rgba(44,110,73,0.15)' : 'rgba(0,0,0,0.04)'}`,
                }}
              >
                {kp.mastered ? '✓ ' : ''}{kp.name}
              </span>
            ))}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="text-xs text-red-400 text-center py-2 px-4 mb-4" style={{ border: '1px solid rgba(196,30,58,0.15)' }}>
            {error}
          </div>
        )}

        {/* Generating */}
        {generating && !narrative && (
          <div className="flex items-center justify-center py-16">
            <div className="text-xs tracking-widest animate-pulse" style={{ color: '#aeaeb2' }}>
              生成学习场景...
            </div>
          </div>
        )}

        {/* Narrative */}
        {narrative && (
          <div className="mb-6">
            <NarrativeText
              text={narrative}
              onComplete={onTypingDone}
              textColor="#1c1c1e"
            />
          </div>
        )}

        {/* Feedback */}
        {feedback && (
          <div
            className="py-4 px-5 rounded-xl mb-6 transition-all duration-300 animate-fade-in-up"
            style={{
              background: feedback.isCorrect === false
                ? 'rgba(196,30,58,0.04)'
                : feedback.isCorrect === true
                  ? 'rgba(44,110,73,0.04)'
                  : 'rgba(0,0,0,0.02)',
              border: `1px solid ${
                feedback.isCorrect === false
                  ? 'rgba(196,30,58,0.12)'
                  : feedback.isCorrect === true
                    ? 'rgba(44,110,73,0.12)'
                    : 'rgba(0,0,0,0.04)'
              }`,
            }}
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs">
                {feedback.isCorrect === false ? '✗' : feedback.isCorrect === true ? '✓' : '·'}
              </span>
              <span className="text-[10px] tracking-wider" style={{ color: '#8e8e93' }}>
                {feedback.isCorrect === false ? '不正确' : feedback.isCorrect === true ? '正确' : '反馈'}
              </span>
            </div>
            <p className="text-xs leading-relaxed" style={{ color: '#636366' }}>
              {feedback.text}
            </p>
          </div>
        )}

        {/* Choices */}
        {typingDone && !feedback && choices.length > 0 && !generating && (
          <div className="flex flex-col gap-2 mt-6">
            {choices.map((choice, i) => (
              <button
                key={choice.id}
                onClick={() => handleChoice(choice.id)}
                className="w-full text-left py-3 px-4 text-sm tracking-wide transition-all duration-200 animate-fade-in-up"
                style={{
                  color: '#1c1c1e',
                  border: '1px solid rgba(0,0,0,0.06)',
                  borderRadius: '12px',
                  opacity: 0,
                  animationDelay: `${i * 100}ms`,
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(0,0,0,0.2)' }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(0,0,0,0.06)' }}
              >
                {choice.text}
              </button>
            ))}
          </div>
        )}

        {/* Companion tip */}
        {typingDone && companionTip && !feedback && (
          <div
            className="mt-6 py-3 px-4 rounded-xl text-xs leading-relaxed animate-fade-in-up"
            style={{
              background: 'rgba(0,0,0,0.02)',
              border: '1px solid rgba(0,0,0,0.04)',
              color: '#8e8e93',
              fontStyle: 'italic',
            }}
          >
            {companionTip}
          </div>
        )}

        {/* Generating next */}
        {generating && narrative && (
          <div className="flex items-center justify-center py-6">
            <div className="text-xs tracking-widest animate-pulse" style={{ color: '#aeaeb2' }}>
              生成下一场景...
            </div>
          </div>
        )}

        {/* Generate error retry */}
        {error && (
          <div className="text-center mt-4">
            <button
              onClick={() => generateScene(nodeIndex, phase, [])}
              className="text-[10px] tracking-wider transition-colors"
              style={{ color: '#aeaeb2' }}
            >
              重试
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
