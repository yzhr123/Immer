'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import FluidCanvas from '@/components/FluidCanvas'
import LearnCourses from '@/components/LearnCourses'
import { COURSES } from '@/learn/courses'
import { SUBJECT_LABELS } from '@/learn/courses'
import type { LearnCourse } from '@/learn/types'
import { useLearnStore } from '@/learn/store'

function subjectLabel(s: string) {
  return SUBJECT_LABELS[s] || s
}

const B = 'cubic-bezier(0.16, 1, 0.3, 1)'

const MODULES = [
  { id: 'read',       labelZh: '沉浸阅读',    labelEn: 'Immersive Read',   desc: '放缓节奏，逐句品味' },
  { id: 'notes',      labelZh: '智能笔记',    labelEn: 'Smart Notes',      desc: '摘录·批注·卡片回顾' },
  { id: 'practice',   labelZh: '对话练习',    labelEn: 'Dialogue Practice', desc: '角色对练 · 发音反馈' },
  { id: 'library',    labelZh: '内容库',      labelEn: 'Content Library',  desc: '收藏 · 分类 · 搜索' },
]

const sharedNoto = {
  fontFamily: 'var(--font-noto-serif-sc)',
  fontWeight: 300,
}

function LearnedKnowledgePoints({
  progresses,
  allCourses,
  activeSubject,
}: {
  progresses: Record<string, any>
  allCourses: LearnCourse[]
  activeSubject: string
}) {
  const groups = useMemo(() => {
    const map: Record<string, { name: string; mastered: boolean }[]> = {}

    for (const [courseId, progress] of Object.entries(progresses)) {
      if (!progress.knowledgePoints?.length) continue
      const course = allCourses.find((c) => c.id === courseId)
      if (!course) continue
      if (activeSubject !== 'all' && subjectLabel(course.subject) !== activeSubject) continue
      map[course.title] = progress.knowledgePoints.map((kp: any) => ({
        name: kp.name,
        mastered: kp.mastered,
      }))
    }

    for (const course of allCourses) {
      if (progresses[course.id]) continue
      if (activeSubject !== 'all' && subjectLabel(course.subject) !== activeSubject) continue
      if (!course.objectives?.length) continue
      map[course.title] = course.objectives.map((obj) => ({
        name: obj,
        mastered: false,
      }))
    }

    return map
  }, [progresses, allCourses, activeSubject])

  const entries = Object.entries(groups)
  if (entries.length === 0) return null

  const total = entries.reduce((acc, [, kps]) => acc + kps.length, 0)
  const masteredCount = entries.reduce(
    (acc, [, kps]) => acc + kps.filter((k) => k.mastered).length,
    0,
  )

  return (
    <div className="mt-10">
      <div className="max-w-lg mx-auto">
        <p className="text-center mb-6" style={{
          ...sharedNoto,
          fontSize: 'clamp(0.75rem, 1.5vw, 0.85rem)',
          letterSpacing: '0.15em',
          color: '#888',
        }}>
          知识点 ({total})
          <span style={{ color: '#aeaeb2', fontSize: '0.65rem' }}>
            {' · '}已掌握 {masteredCount}
          </span>
        </p>
        <div className="flex flex-col gap-4">
          {entries.map(([courseTitle, kps]) => (
            <div key={courseTitle} className="text-left">
              <p
                className="text-[10px] tracking-wider mb-2"
                style={{ color: '#aeaeb2', letterSpacing: '0.1em' }}
              >
                {courseTitle}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {kps.map((kp, i) => (
                  <span
                    key={i}
                    className="text-[9px] tracking-wider px-2.5 py-1 rounded-full"
                    style={
                      kp.mastered
                        ? {
                            background: 'rgba(44,110,73,0.06)',
                            border: '1px solid rgba(44,110,73,0.12)',
                            color: '#2c6e49',
                          }
                        : {
                            background: 'rgba(0,0,0,0.02)',
                            border: '1px solid rgba(0,0,0,0.06)',
                            color: '#aeaeb2',
                          }
                    }
                  >
                    {kp.name}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function LearnPage() {
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  const [activeSubject, setActiveSubject] = useState('all')
  const progresses = useLearnStore((s) => s.progresses)
  const userCourses = useLearnStore((s) => s.userCourses)
  const deletedCourseIds = useLearnStore((s) => s.deletedCourseIds)
  const deleteCourse = useLearnStore((s) => s.deleteCourse)
  const deletedSet = useMemo(() => new Set(deletedCourseIds), [deletedCourseIds])
  const allCourses = useMemo(
    () => [...COURSES, ...userCourses].filter((c) => !deletedSet.has(c.id)),
    [userCourses, deletedSet],
  )

  useEffect(() => {
    setMounted(true)
  }, [])

  return (
    <div className="flex flex-col items-center justify-start min-h-screen w-screen select-none relative bg-white overflow-y-auto">
      {/* Background */}
      <FluidCanvas />

      {/* Top bar */}
      <div
        className="fixed top-0 left-0 right-0 flex items-center justify-between px-6 py-4"
        style={{ zIndex: 20 }}
      >
        <button
          onClick={() => router.back()}
          className="group flex items-center gap-1.5 transition-all duration-400 hover:-translate-x-0.5"
          style={{ color: '#555' }}
        >
          <span className="transition-all duration-400 text-xs group-hover:opacity-60">←</span>
          <span
            className="transition-all duration-400 text-[11px] tracking-[0.15em] group-hover:opacity-60"
          >
            返回
          </span>
        </button>

        <span
          style={{
            fontFamily: 'var(--font-plus-jakarta)',
            fontWeight: 200,
            fontSize: '0.8rem',
            letterSpacing: '0.15em',
            color: '#999',
          }}
        >
          Immer
        </span>
      </div>

      {/* Main content */}
      <div
        className={`transition-all duration-1000 pt-20 pb-16 ${
          mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
        }`}
        style={{
          transitionTimingFunction: B,
          zIndex: 10,
          width: '85%',
          maxWidth: '900px',
        }}
      >
        {/* Header */}
        <div className="text-center mb-8">
          <Link href="/">
            <h1
              style={{
                ...sharedNoto,
                fontSize: 'clamp(1.5rem, 4vw, 2.2rem)',
                letterSpacing: '0.25em',
                color: '#111',
                marginBottom: '0.75rem',
              }}
              className="cursor-pointer transition-opacity hover:opacity-60"
            >
              沉浸式学习空间
            </h1>
          </Link>
          <p
            style={{
              fontFamily: 'var(--font-plus-jakarta)',
              fontWeight: 200,
              fontSize: 'clamp(0.75rem, 1.5vw, 0.9rem)',
              letterSpacing: '0.1em',
              color: '#888',
            }}
          >
            Immersive Learning Lab
          </p>
          <div
            className="mx-auto mt-4 h-px"
            style={{
              width: '60px',
              background: 'rgba(0,0,0,0.08)',
            }}
          />
          <p
            className="mt-4"
            style={{
              ...sharedNoto,
              fontSize: '0.8rem',
              letterSpacing: '0.12em',
              color: '#888',
            }}
          >
            专注 · 探索 · 成长
          </p>
        </div>

        {/* ─── 沉浸式课程 (moved above modules) ─── */}
        {mounted && (
          <LearnCourses
            courses={allCourses}
            progresses={progresses}
            activeSubject={activeSubject}
            onSubjectChange={setActiveSubject}
            onDelete={(id) => deleteCourse(id)}
          />
        )}

        {/* Create course */}
        {mounted && (
          <div className="mt-6 text-center">
            <Link
              href="/learn/create"
              className="inline-block text-[10px] tracking-wider transition-colors hover:opacity-60"
              style={{ color: '#bbb', letterSpacing: '0.12em' }}
            >
              + 创建课程
            </Link>
          </div>
        )}

        {/* ─── 已学知识点 ─── */}
        {mounted && <LearnedKnowledgePoints progresses={progresses} allCourses={allCourses} activeSubject={activeSubject} />}

        {/* Separator */}
        <div
          className="mx-auto my-10 h-px"
          style={{ width: '40px', background: 'rgba(0,0,0,0.06)' }}
        />

        {/* Module cards grid */}
        <div>
          <div className="text-center mb-6">
            <h2
              style={{
                ...sharedNoto,
                fontSize: 'clamp(0.85rem, 2vw, 1rem)',
                letterSpacing: '0.2em',
                color: '#888',
                marginBottom: '0.3rem',
              }}
            >
              更多工具
            </h2>
            <p
              style={{
                fontFamily: 'var(--font-plus-jakarta)',
                fontWeight: 200,
                fontSize: 'clamp(0.55rem, 1vw, 0.65rem)',
                letterSpacing: '0.1em',
                color: '#bbb',
              }}
            >
              More Tools
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:gap-6">
            {MODULES.map((mod, i) => (
              <div
                key={mod.id}
                className={`transition-all duration-800 ${
                  mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
                }`}
                style={{
                  transitionDelay: mounted ? `${100 + i * 80}ms` : '0ms',
                  transitionTimingFunction: B,
                }}
              >
                <div
                  className="group relative overflow-hidden transition-all duration-500 hover:-translate-y-1.5 active:scale-95 h-full"
                  style={{ borderRadius: '20px' }}
                >
                  {/* Glass background */}
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
                  {/* Hover brighten */}
                  <div
                    className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                    style={{
                      background: 'rgba(255,255,255,0.45)',
                      borderRadius: '20px',
                    }}
                  />

                  {/* Content */}
                  <div className="relative flex flex-col items-start justify-between p-5 sm:p-6 h-full min-h-[120px] sm:min-h-[140px]">
                    <div>
                      {/* Icon area */}
                      <div
                        className="w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center mb-3 transition-all duration-500 group-hover:scale-105"
                        style={{
                          background: 'rgba(0,0,0,0.03)',
                          border: '1px solid rgba(0,0,0,0.06)',
                        }}
                      >
                        <span className="text-[10px] sm:text-xs" style={{ color: '#777' }}>
                          {['◈', '◈', '◈', '◈'][i]}
                        </span>
                      </div>

                      {/* Title */}
                      <h3
                        className="transition-all duration-400"
                        style={{
                          ...sharedNoto,
                          fontSize: 'clamp(0.85rem, 2vw, 1rem)',
                          letterSpacing: '0.12em',
                          color: '#222',
                          marginBottom: '0.2rem',
                        }}
                      >
                        {mod.labelZh}
                      </h3>
                      <p
                        style={{
                          fontFamily: 'var(--font-plus-jakarta)',
                          fontWeight: 300,
                          fontSize: 'clamp(0.55rem, 1.2vw, 0.65rem)',
                          letterSpacing: '0.06em',
                          color: '#888',
                          marginBottom: '0.5rem',
                        }}
                      >
                        {mod.labelEn}
                      </p>

                      {/* Description */}
                      <p
                        style={{
                          ...sharedNoto,
                          fontSize: 'clamp(0.65rem, 1.2vw, 0.75rem)',
                          color: '#999',
                          letterSpacing: '0.08em',
                        }}
                      >
                        {mod.desc}
                      </p>
                    </div>

                    {/* Status badge */}
                    <div className="mt-3 self-end">
                      <span
                        className="transition-all duration-400 text-[9px] tracking-[0.12em] opacity-40 group-hover:opacity-60"
                        style={{ color: '#888' }}
                      >
                        即将推出 →
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-10 text-center">
          <p
            className="transition-all duration-800"
            style={{
              ...sharedNoto,
              fontSize: '0.7rem',
              letterSpacing: '0.15em',
              color: '#bbb',
            }}
          >
            更多模式即将上线
          </p>
        </div>
      </div>
    </div>
  )
}
