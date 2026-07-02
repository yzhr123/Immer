'use client'

import { useEffect, useState, useRef, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { LearnCourse, LearnSeries, SeriesDepthLevel } from '@/learn/types'
import { SERIES_DEPTH_LABELS } from '@/learn/types'
import { SUBJECT_LABELS } from '@/learn/courses'

const sharedNoto = {
  fontFamily: 'var(--font-noto-serif-sc)',
  fontWeight: 300,
}

const DIFFICULTY_LABELS: Record<string, string> = {
  beginner: '入门',
  intermediate: '进阶',
  advanced: '高级',
}

function subjectLabel(s: string) {
  return SUBJECT_LABELS[s] || s
}

interface Props {
  courses: LearnCourse[]
  series: LearnSeries[]
  progresses: Record<string, any>
  activeSubject: string
  onSubjectChange: (subject: string) => void
  onDelete?: (courseId: string) => void
  onSeriesDelete?: (seriesId: string) => void
}

export default function LearnCourses({ courses, series, progresses, activeSubject, onSubjectChange, onDelete, onSeriesDelete }: Props) {
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [confirmDeleteSeriesId, setConfirmDeleteSeriesId] = useState<string | null>(null)
  const [showCreateMenu, setShowCreateMenu] = useState(false)
  const confirmRef = useRef<HTMLButtonElement>(null)
  const createMenuRef = useRef<HTMLDivElement>(null)
  const createMenuTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => setMounted(true), [])

  // Click outside to cancel delete confirmation
  useEffect(() => {
    if (!confirmDeleteId) return
    function handleClick(e: MouseEvent) {
      if (confirmRef.current && !confirmRef.current.contains(e.target as Node)) {
        setConfirmDeleteId(null)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [confirmDeleteId])

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (createMenuTimeoutRef.current) clearTimeout(createMenuTimeoutRef.current)
    }
  }, [])

  function handleCreateMenuEnter() {
    if (createMenuTimeoutRef.current) clearTimeout(createMenuTimeoutRef.current)
    setShowCreateMenu(true)
  }

  function handleCreateMenuLeave() {
    createMenuTimeoutRef.current = setTimeout(() => setShowCreateMenu(false), 100)
  }

  // Derive subject options from display labels (merges e.g. 'economics' + '经济' → '经济')
  const subjectOptions = useMemo(() => {
    const labels = new Set(courses.map((c) => subjectLabel(c.subject)))
    return ['all', '系列课程', ...Array.from(labels)]
  }, [courses])

  if (!mounted) return null

  // Filter by search
  const q = searchQuery.trim().toLowerCase()
  const searched = q
    ? courses.filter(
        (c) =>
          c.title.toLowerCase().includes(q) ||
          c.description?.toLowerCase().includes(q),
      )
    : courses

  // Filter by subject display label (merges raw key + Chinese label)
  const isSeriesMode = activeSubject === '系列课程'
  const filtered = isSeriesMode
    ? [] // series have their own rendering
    : activeSubject === 'all'
      ? searched
      : searched.filter((c) => subjectLabel(c.subject) === activeSubject)

  // Filter series by search
  const filteredSeries = isSeriesMode
    ? (searchQuery.trim()
        ? series.filter((s) => s.title.toLowerCase().includes(q) || s.topic.toLowerCase().includes(q))
        : series)
    : []

  const inProgress = filtered.filter((c) => progresses[c.id]?.status === 'in-progress')
  const completed = filtered.filter((c) => progresses[c.id]?.status === 'completed')
  const notStarted = filtered.filter((c) => !progresses[c.id] || progresses[c.id]?.status === 'not-started')

  function handleDelete(e: React.MouseEvent, courseId: string) {
    e.preventDefault()
    e.stopPropagation()
    if (confirmDeleteId === courseId) {
      onDelete?.(courseId)
      setConfirmDeleteId(null)
    } else {
      setConfirmDeleteId(courseId)
    }
  }

  return (
    <div className="mt-8">
      <div className="text-center mb-6">
        <h2
          style={{
            ...sharedNoto,
            fontSize: 'clamp(1rem, 2.5vw, 1.3rem)',
            letterSpacing: '0.2em',
            color: '#222',
            marginBottom: '0.5rem',
          }}
        >
          沉浸式课程
        </h2>
        <p
          style={{
            fontFamily: 'var(--font-plus-jakarta)',
            fontWeight: 200,
            fontSize: 'clamp(0.65rem, 1.2vw, 0.75rem)',
            letterSpacing: '0.1em',
            color: '#999',
          }}
        >
          Interactive Courses
        </p>
        <div className="mx-auto mt-3 h-px" style={{ width: '40px', background: 'rgba(0,0,0,0.08)' }} />
      </div>

      {/* Subject filter tabs (by display label) */}
      <div className="flex flex-wrap justify-center gap-2 mb-5">
        {subjectOptions.map((s) => {
          const label = s === 'all' ? '全部' : s
          return (
            <button
              key={s}
              onClick={() => onSubjectChange(s)}
              className="text-[10px] tracking-wider px-3 py-1.5 rounded-full transition-all duration-200"
              style={{
                border: '1px solid',
                borderColor:
                  activeSubject === s ? 'rgba(0,0,0,0.15)' : 'rgba(0,0,0,0.06)',
                background:
                  activeSubject === s ? 'rgba(0,0,0,0.04)' : 'transparent',
                color: activeSubject === s ? '#333' : '#999',
              }}
            >
              {label}
            </button>
          )
        })}
      </div>

      {/* Search + Create */}
      <div className="flex items-center gap-3 max-w-sm mx-auto mb-6">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="搜索课程..."
          className="flex-1 text-xs tracking-wider outline-none py-2 px-4 transition-all duration-200"
          style={{
            borderRadius: '12px',
            background: 'rgba(0,0,0,0.02)',
            border: '1px solid rgba(0,0,0,0.06)',
            color: '#444',
            letterSpacing: '0.08em',
          }}
          onFocus={(e) => {
            e.target.style.borderColor = 'rgba(0,0,0,0.15)'
            e.target.style.background = 'rgba(0,0,0,0.03)'
          }}
          onBlur={(e) => {
            e.target.style.borderColor = 'rgba(0,0,0,0.06)'
            e.target.style.background = 'rgba(0,0,0,0.02)'
          }}
        />
        {/* Create dropdown */}
        <div
          className="relative"
          ref={createMenuRef}
          onMouseEnter={handleCreateMenuEnter}
          onMouseLeave={handleCreateMenuLeave}
        >
          <button
            type="button"
            className="text-[10px] tracking-wider px-4 py-2 rounded-xl transition-all duration-200 whitespace-nowrap hover:scale-105 hover:-translate-y-0.5 active:scale-95"
            style={{
              background: '#1c1c1e',
              color: '#fff',
              letterSpacing: '0.1em',
            }}
          >
            + 创建课程
          </button>
          {showCreateMenu && (
            <div
              className="absolute top-full right-0 mt-1 py-1 rounded-xl transition-all duration-200 z-50"
              style={{
                background: '#fff',
                border: '1px solid rgba(0,0,0,0.08)',
                boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
                minWidth: '140px',
              }}
            >
              <Link
                href="/learn/create"
                className="block px-4 py-2.5 text-[10px] tracking-wider transition-all duration-150 hover:bg-gray-100 hover:pl-5"
                style={{ color: '#1c1c1e' }}
                onClick={() => setShowCreateMenu(false)}
              >
                创建课程
              </Link>
              <Link
                href="/learn/series/create"
                className="block px-4 py-2.5 text-[10px] tracking-wider transition-all duration-150 hover:bg-gray-100 hover:pl-5"
                style={{ color: '#1c1c1e' }}
                onClick={() => setShowCreateMenu(false)}
              >
                创建系列课程
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Series cards */}
      {isSeriesMode && filteredSeries.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {filteredSeries.map((s) => renderSeriesCard(s))}
        </div>
      )}

      {/* Regular course cards */}
      {!isSeriesMode && (
        <>
          {inProgress.length > 0 && (
            <div className="mb-8">
              <p className="text-[10px] tracking-[0.2em] mb-3 text-center" style={{ color: '#aaa' }}>继续学习</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {inProgress.map((c) => renderCard(c, progresses[c.id], 'in-progress'))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {notStarted.map((c) => renderCard(c, progresses[c.id], 'not-started'))}
          </div>

          {completed.length > 0 && (
            <div className="mt-6">
              <details className="text-center">
                <summary className="text-[10px] tracking-wider cursor-pointer" style={{ color: '#bbb' }}>
                  已完成 ({completed.length})
                </summary>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                  {completed.map((c) => renderCard(c, progresses[c.id], 'completed'))}
                </div>
              </details>
            </div>
          )}
        </>
      )}

      {/* No results */}
      {(isSeriesMode ? filteredSeries.length === 0 : filtered.length === 0) && (searchQuery.trim() || activeSubject !== 'all') && (
        <p className="text-[11px] tracking-wider text-center mt-8" style={{ color: '#bbb' }}>
          未找到匹配的{isSeriesMode ? '系列课程' : '课程'}
        </p>
      )}
    </div>
  )

  // ── render single card ──
  function renderCard(course: LearnCourse, progress: any, status: string) {
    const completedNodes = progress?.currentNode || 0
    const totalNodes = course.totalNodes
    const pct = totalNodes > 0 ? Math.round((completedNodes / totalNodes) * 100) : 0

    const isConfirming = confirmDeleteId === course.id

    return (
      <div key={course.id} className="relative group">
        <Link
          href={`/learn/course/${course.id}`}
          className="block transition-all duration-500 hover:-translate-y-0.5"
        >
          <div
            className="relative overflow-hidden transition-all duration-500 h-full"
            style={{ borderRadius: '20px' }}
          >
            <div
              className="absolute inset-0 transition-colors duration-500"
              style={{
                background: 'rgba(255,255,255,0.25)',
                borderRadius: '20px',
                backdropFilter: 'blur(35px) saturate(130%)',
                WebkitBackdropFilter: 'blur(35px) saturate(130%)',
                border: '1px solid rgba(0,0,0,0.04)',
              }}
            />
            <div className="relative p-5 sm:p-6">
              <div className="flex items-start justify-between mb-2">
                <h3
                  style={{
                    ...sharedNoto,
                    fontSize: 'clamp(0.85rem, 1.8vw, 0.95rem)',
                    letterSpacing: '0.1em',
                    color: '#222',
                  }}
                >
                  {course.title}
                </h3>
                <span className="text-base tracking-wider shrink-0 ml-2" style={{ color: '#555' }}>{course.icon}</span>
              </div>
              <p
                className="line-clamp-2 text-[11px] leading-relaxed mb-3"
                style={{ color: '#999', letterSpacing: '0.06em' }}
              >
                {course.description}
              </p>
              <div className="flex items-center justify-between text-[9px]">
                <div className="flex items-center gap-3" style={{ color: '#bbb' }}>
                  <span
                    className="px-2 py-0.5 rounded-full"
                    style={{
                      border: '1px solid rgba(0,0,0,0.06)',
                      color: status === 'completed' ? '#2c6e49' : '#999',
                    }}
                  >
                    {DIFFICULTY_LABELS[course.difficulty]}
                  </span>
                  <span>{course.estimatedMinutes}分钟</span>
                  <span>{course.totalNodes}节</span>
                  {course.objectives.length > 0 && <span>{course.objectives.length}个目标</span>}
                </div>
                {onDelete && (
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        e.preventDefault()
                        router.push(`/learn/create?id=${course.id}`)
                      }}
                      className="text-[9px] tracking-wider px-2 py-1 rounded-full transition-all duration-200"
                      style={{
                        background: 'rgba(0,0,0,0.03)',
                        border: '1px solid rgba(0,0,0,0.06)',
                        color: '#999',
                      }}
                    >
                      编辑
                    </button>
                    <button
                      ref={isConfirming ? confirmRef : undefined}
                      onClick={(e) => handleDelete(e, course.id)}
                      className="text-[9px] tracking-wider px-2 py-1 rounded-full transition-all duration-200"
                      style={{
                        background: isConfirming ? 'rgba(196,30,58,0.12)' : 'rgba(0,0,0,0.03)',
                        border: `1px solid ${isConfirming ? 'rgba(196,30,58,0.25)' : 'rgba(0,0,0,0.06)'}`,
                        color: isConfirming ? '#c41e3a' : '#999',
                      }}
                    >
                      {isConfirming ? '确认删除' : '删除'}
                    </button>
                  </div>
                )}
              </div>
              {status === 'in-progress' && (
                <div className="mt-3">
                  <div className="flex justify-between text-[9px] mb-1" style={{ color: '#bbb' }}>
                    <span>进度 {completedNodes}/{totalNodes}</span>
                    <span>{pct}%</span>
                  </div>
                  <div className="w-full h-0.5 rounded-full" style={{ background: 'rgba(0,0,0,0.04)' }}>
                    <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: '#222' }} />
                  </div>
                </div>
              )}
              {status === 'completed' && progress && (
                <div className="mt-2 text-[9px]" style={{ color: '#2c6e49' }}>
                  掌握度 {progress.score}%
                </div>
              )}
            </div>
          </div>
        </Link>
      </div>
    )
  }

  function renderSeriesCard(s: LearnSeries) {
    const totalKps = s.knowledgePoints.length
    const completedKps = s.knowledgePoints.filter((kp) => kp.completed).length
    const pct = totalKps > 0 ? Math.round((completedKps / totalKps) * 100) : 0

    return (
      <div key={s.id} className="relative group">
        <Link
          href={`/learn/series/${s.id}`}
          className="block transition-all duration-500 hover:-translate-y-0.5"
        >
          <div
            className="relative overflow-hidden transition-all duration-500 h-full"
            style={{ borderRadius: '20px' }}
          >
            <div
              className="absolute inset-0 transition-colors duration-500"
              style={{
                background: 'rgba(255,255,255,0.25)',
                borderRadius: '20px',
                backdropFilter: 'blur(35px) saturate(130%)',
                WebkitBackdropFilter: 'blur(35px) saturate(130%)',
                border: '1px solid rgba(0,0,0,0.04)',
              }}
            />
            <div className="relative p-5 sm:p-6">
              <div className="flex items-start justify-between mb-2">
                <h3
                  style={{
                    ...sharedNoto,
                    fontSize: 'clamp(0.85rem, 1.8vw, 0.95rem)',
                    letterSpacing: '0.1em',
                    color: '#222',
                  }}
                >
                  {s.title}
                </h3>
                <span className="text-base tracking-wider shrink-0 ml-2" style={{ color: '#555' }}>
                  {s.icon || '系'}
                </span>
              </div>
              <p
                className="line-clamp-2 text-[11px] leading-relaxed mb-3"
                style={{ color: '#999', letterSpacing: '0.06em' }}
              >
                {s.topic} · {SERIES_DEPTH_LABELS[s.depth as SeriesDepthLevel] || s.depth}
              </p>
              <div className="flex items-center justify-between text-[9px]">
                <div className="flex items-center gap-3" style={{ color: '#bbb' }}>
                  <span
                    className="px-2 py-0.5 rounded-full"
                    style={{
                      border: '1px solid rgba(0,0,0,0.06)',
                      color: '#999',
                    }}
                  >
                    系列课程
                  </span>
                  <span>{totalKps} 个知识点</span>
                  <span>{completedKps} 已完成</span>
                </div>
                {onSeriesDelete && (
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        e.preventDefault()
                        router.push(`/learn/series/${s.id}/edit`)
                      }}
                      className="text-[9px] tracking-wider px-2 py-1 rounded-full transition-all duration-200"
                      style={{
                        background: 'rgba(0,0,0,0.03)',
                        border: '1px solid rgba(0,0,0,0.06)',
                        color: '#999',
                      }}
                    >
                      编辑
                    </button>
                    <button
                      ref={confirmDeleteSeriesId === s.id ? confirmRef : undefined}
                      onClick={(e) => {
                        e.stopPropagation()
                        e.preventDefault()
                        if (confirmDeleteSeriesId === s.id) {
                          onSeriesDelete(s.id)
                          setConfirmDeleteSeriesId(null)
                        } else {
                          setConfirmDeleteSeriesId(s.id)
                        }
                      }}
                      className="text-[9px] tracking-wider px-2 py-1 rounded-full transition-all duration-200"
                      style={{
                        background: confirmDeleteSeriesId === s.id ? 'rgba(196,30,58,0.12)' : 'rgba(0,0,0,0.03)',
                        border: `1px solid ${confirmDeleteSeriesId === s.id ? 'rgba(196,30,58,0.25)' : 'rgba(0,0,0,0.06)'}`,
                        color: confirmDeleteSeriesId === s.id ? '#c41e3a' : '#999',
                      }}
                    >
                      {confirmDeleteSeriesId === s.id ? '确认删除' : '删除'}
                    </button>
                  </div>
                )}
              </div>
              {totalKps > 0 && (
                <div className="mt-3">
                  <div className="flex justify-between text-[9px] mb-1" style={{ color: '#bbb' }}>
                    <span>进度 {completedKps}/{totalKps}</span>
                    <span>{pct}%</span>
                  </div>
                  <div className="w-full h-0.5 rounded-full" style={{ background: 'rgba(0,0,0,0.04)' }}>
                    <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: '#222' }} />
                  </div>
                </div>
              )}
            </div>
          </div>
        </Link>
      </div>
    )
  }
}
