'use client'

import { useMemo } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { useLearnStore } from '@/learn/store'
import { COURSES } from '@/learn/courses'
import { SERIES_DEPTH_LABELS } from '@/learn/types'
import type { SeriesDepthLevel } from '@/learn/types'

export default function SeriesDetailPage() {
  const router = useRouter()
  const params = useParams()
  const seriesId = params.id as string

  const series = useLearnStore((s) => s.series.find((se) => se.id === seriesId))
  const progresses = useLearnStore((s) => s.progresses)
  const userCourses = useLearnStore((s) => s.userCourses)
  const updateSeriesKp = useLearnStore((s) => s.updateSeriesKp)

  const allCourses = useMemo(() => [...COURSES, ...userCourses], [userCourses])

  // Compute KP stats
  const stats = useMemo(() => {
    if (!series) return { total: 0, created: 0, inProgress: 0, completed: 0, pct: 0 }
    const total = series.knowledgePoints.length
    let created = 0
    let inProgress = 0
    let completed = 0
    for (const kp of series.knowledgePoints) {
      if (kp.courseId) created++
      const prog = progresses[kp.courseId || '']
      if (prog?.status === 'in-progress') inProgress++
      if (kp.completed || prog?.status === 'completed') completed++
    }
    return {
      total,
      created,
      inProgress,
      completed,
      pct: total > 0 ? Math.round((completed / total) * 100) : 0,
    }
  }, [series, progresses])

  if (!series) {
    return (
      <div className="flex items-center justify-center min-h-screen" style={{ background: '#faf8f5' }}>
        <p className="text-[12px] tracking-wider" style={{ color: '#aeaeb2' }}>
          系列课程未找到
        </p>
      </div>
    )
  }

  return (
    <div style={{ background: '#faf8f5', minHeight: '100vh' }}>
      <div className="max-w-xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <Link
            href="/learn"
            className="text-[10px] tracking-wider transition-colors"
            style={{ color: '#aeaeb2' }}
          >
            ← 学习空间
          </Link>
          <span style={{ color: 'rgba(0,0,0,0.06)' }}>/</span>
          <span className="text-[10px] tracking-wider" style={{ color: '#8e8e93' }}>
            {series.title}
          </span>
        </div>

        {/* Series header card */}
        <div
          className="rounded-xl p-6 mb-6"
          style={{
            border: '1px solid rgba(0,0,0,0.06)',
            background: 'rgba(255,255,255,0.4)',
          }}
        >
          <h1
            className="mb-1"
            style={{
              fontFamily: 'var(--font-noto-serif-sc)',
              fontWeight: 300,
              fontSize: 'clamp(1.2rem, 3vw, 1.6rem)',
              letterSpacing: '0.15em',
              color: '#1c1c1e',
            }}
          >
            {series.title}
          </h1>
          <p className="text-[10px] tracking-wider mb-4" style={{ color: '#aeaeb2' }}>
            {series.topic} · {SERIES_DEPTH_LABELS[series.depth as SeriesDepthLevel] || series.depth} · 共{stats.total}个知识点
          </p>

          {/* Progress */}
          <div className="mb-1 flex justify-between text-[9px]" style={{ color: '#aeaeb2' }}>
            <span>已创建 {stats.created}/{stats.total}</span>
            <span>{stats.completed}/{stats.total} 已完成</span>
          </div>
          <div className="w-full h-0.5 rounded-full" style={{ background: 'rgba(0,0,0,0.04)' }}>
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${stats.pct}%`, background: '#1c1c1e' }}
            />
          </div>
        </div>

        {/* Knowledge points list */}
        <div className="flex flex-col gap-2">
          {series.knowledgePoints.map((kp, i) => {
            const course = kp.courseId ? allCourses.find((c) => c.id === kp.courseId) : undefined
            const progress = kp.courseId ? progresses[kp.courseId] : undefined
            const isCompleted = kp.completed || progress?.status === 'completed'
            const isInProgress = progress?.status === 'in-progress'

            return (
              <div
                key={kp.id}
                className="flex items-start gap-3 p-4 rounded-xl transition-all duration-200"
                style={{
                  border: '1px solid rgba(0,0,0,0.06)',
                  background: isCompleted ? 'rgba(44,110,73,0.03)' : 'rgba(255,255,255,0.4)',
                }}
              >
                {/* Number */}
                <span
                  className="text-[10px] mt-0.5 shrink-0"
                  style={{
                    color: isCompleted ? '#2c6e49' : '#aeaeb2',
                    minWidth: '1.2rem',
                  }}
                >
                  {isCompleted ? '✓' : `${i + 1}`}
                </span>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div
                    className="text-[11px] tracking-wider mb-0.5"
                    style={{
                      color: isCompleted ? '#2c6e49' : '#1c1c1e',
                      textDecoration: isCompleted ? 'line-through' : 'none',
                    }}
                  >
                    {kp.name}
                  </div>
                  <div className="text-[9px] leading-relaxed mb-2" style={{ color: '#aeaeb2' }}>
                    {kp.description}
                  </div>

                  {/* Status + Action */}
                  <div className="flex items-center gap-2">
                    {!kp.courseId ? (
                      <Link
                        href={`/learn/create?seriesId=${series.id}&kpId=${kp.id}&kpName=${encodeURIComponent(kp.name)}&kpDesc=${encodeURIComponent(kp.description)}`}
                        className="inline-block text-[9px] tracking-wider px-3 py-1 rounded-full transition-all duration-200 hover:scale-110 hover:-translate-y-0.5 active:scale-95"
                        style={{
                          border: '1px solid rgba(0,0,0,0.1)',
                          color: '#636366',
                        }}
                      >
                        创建此课程
                      </Link>
                    ) : isCompleted ? (
                      <span className="text-[9px]" style={{ color: '#2c6e49' }}>
                        已完成
                      </span>
                    ) : (
                      <Link
                        href={`/learn/course/${kp.courseId}`}
                        className="inline-block text-[9px] tracking-wider px-3 py-1 rounded-full transition-all duration-200 hover:scale-110 hover:-translate-y-0.5 active:scale-95"
                        style={{
                          background: '#1c1c1e',
                          color: '#fff',
                        }}
                      >
                        {isInProgress ? '继续学习' : '进入课程'}
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Empty state */}
        {series.knowledgePoints.length === 0 && (
          <div className="text-center py-12">
            <p className="text-[11px] tracking-wider" style={{ color: '#aeaeb2' }}>
              该系列暂无知识点
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
