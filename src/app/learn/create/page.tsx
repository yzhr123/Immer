'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useLearnStore } from '@/learn/store'
import { useStore } from '@/lib/store'
import { COURSES } from '@/learn/courses'
import type { LearnCourse } from '@/learn/types'

const DIFFICULTY_OPTIONS = [
  { value: 'beginner', label: '入门' },
  { value: 'intermediate', label: '进阶' },
  { value: 'advanced', label: '高级' },
] as const

export default function CreateCoursePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const editId = searchParams.get('id')
  const seriesId = searchParams.get('seriesId')
  const kpId = searchParams.get('kpId')
  const kpName = searchParams.get('kpName')
  const kpDesc = searchParams.get('kpDesc')

  const addUserCourse = useLearnStore((s) => s.addUserCourse)
  const updateCourse = useLearnStore((s) => s.updateCourse)
  const deleteCourse = useLearnStore((s) => s.deleteCourse)
  const updateSeriesKp = useLearnStore((s) => s.updateSeriesKp)
  const userCourses = useLearnStore((s) => s.userCourses)
  const llmSettings = useStore((s) => s.llmSettings)

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [subject, setSubject] = useState('')
  const [difficulty, setDifficulty] = useState<'beginner' | 'intermediate' | 'advanced'>('beginner')
  const [estimatedMinutes, setEstimatedMinutes] = useState(20)
  const [totalNodes, setTotalNodes] = useState(6)
  const [icon, setIcon] = useState('')
  const [objectives, setObjectives] = useState<string[]>([])
  const [objectiveInput, setObjectiveInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [genLoading, setGenLoading] = useState(false)

  // Edit mode: load existing course
  useEffect(() => {
    if (!editId) return
    const course =
      userCourses.find((c) => c.id === editId) ||
      COURSES.find((c) => c.id === editId)
    if (!course) return
    setTitle(course.title)
    setDescription(course.description)
    setSubject(course.subject)
    setDifficulty(course.difficulty)
    setEstimatedMinutes(course.estimatedMinutes)
    setTotalNodes(course.totalNodes)
    setIcon(course.icon)
    setObjectives(course.objectives)
  }, [editId, userCourses])

  // Series context: pre-fill from KP info
  useEffect(() => {
    if (!seriesId || !kpId) return
    if (kpName) setTitle(kpName)
    if (kpDesc) setObjectives([kpDesc])
  }, [seriesId, kpId, kpName, kpDesc])

  const isEditing = !!editId

  function addObjective() {
    const trimmed = objectiveInput.trim()
    if (trimmed && !objectives.includes(trimmed)) {
      setObjectives([...objectives, trimmed])
      setObjectiveInput('')
    }
  }

  function removeObjective(idx: number) {
    setObjectives(objectives.filter((_, i) => i !== idx))
  }

  async function generateDescription() {
    if (!title.trim()) return
    if (!llmSettings?.apiUrl || !llmSettings?.apiKey) {
      alert('请先在 Settings 中配置 LLM API')
      return
    }
    setGenLoading(true)
    try {
      const res = await fetch('/api/learn/generate-description', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          subject: subject.trim(),
          difficulty,
          objectives,
          llmConfig: llmSettings,
          language: 'zh',
        }),
      })
      if (!res.ok) throw new Error('生成失败')
      const data = await res.json()
      if (data.description) setDescription(data.description)
      if (data.subject && !subject.trim()) setSubject(data.subject)
      if (data.icon && !icon.trim()) setIcon(data.icon)
      if (data.objectives?.length && objectives.length === 0) setObjectives(data.objectives)
    } catch {
      alert('生成描述失败，请重试')
    } finally {
      setGenLoading(false)
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    setSaving(true)

    if (isEditing && editId) {
      // Find existing course (built-in or user)
      const existing = [...COURSES, ...userCourses].find((c) => c.id === editId)
      if (!existing) return
      const isUserCourse = userCourses.some((c) => c.id === editId)

      const updated: LearnCourse = {
        ...existing,
        title: title.trim(),
        description: description.trim(),
        subject: subject.trim() || 'general',
        difficulty,
        estimatedMinutes,
        totalNodes,
        icon: icon.trim() || title.trim()[0] || '?',
        objectives,
      }

      if (isUserCourse) {
        updateCourse(editId, updated)
      } else {
        // Built-in course: copy to userCourses with same ID, hide original
        addUserCourse(updated, editId)
        deleteCourse(editId)
      }
      router.push(`/learn/course/${editId}`)
    } else {
      const id = addUserCourse({
        title: title.trim(),
        description: description.trim(),
        subject: subject.trim() || 'general',
        difficulty,
        estimatedMinutes,
        totalNodes,
        icon: icon.trim() || title.trim()[0] || '?',
        objectives,
      })
      // Link course to series KP if in series context
      if (seriesId && kpId) {
        updateSeriesKp(seriesId, kpId, { courseId: id })
      }
      router.push(seriesId ? `/learn/series/${seriesId}` : `/learn/course/${id}`)
    }
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
            {isEditing ? '编辑课程' : '创建课程'}
          </span>
        </div>

        <h1
          className="mb-8"
          style={{
            fontFamily: 'var(--font-noto-serif-sc)',
            fontWeight: 300,
            fontSize: 'clamp(1.2rem, 2.5vw, 1.5rem)',
            letterSpacing: '0.2em',
            color: '#1c1c1e',
          }}
        >
          {isEditing ? '编辑课程' : '创建课程'}
        </h1>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          {/* Title */}
          <div>
            <label className="text-[10px] tracking-wider mb-2 block" style={{ color: '#8e8e93' }}>
              课程名称
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="例：Python 入门"
              required
              className="w-full px-4 py-3 text-sm outline-none transition-colors"
              style={{
                border: '1px solid rgba(0,0,0,0.06)',
                borderRadius: '12px',
                background: 'rgba(255,255,255,0.5)',
                color: '#1c1c1e',
              }}
            />
          </div>

          {/* Description */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[10px] tracking-wider" style={{ color: '#8e8e93' }}>
                课程描述
              </label>
              <button
                type="button"
                onClick={generateDescription}
                disabled={!title.trim() || genLoading}
                className="text-[11px] tracking-wider transition-all duration-200 disabled:opacity-30"
                style={{
                  padding: '5px 14px',
                  borderRadius: '8px',
                  background: '#1c1c1e',
                  color: '#fff',
                  letterSpacing: '0.12em',
                  opacity: genLoading ? 0.5 : 1,
                }}
                onMouseEnter={(e) => { if (!genLoading) e.currentTarget.style.opacity = '0.8' }}
                onMouseLeave={(e) => { e.currentTarget.style.opacity = genLoading ? '0.5' : '1' }}
              >
                {genLoading ? '生成中...' : 'AI 生成'}
              </button>
            </div>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="学员将在课程中体验什么？"
              rows={3}
              className="w-full px-4 py-3 text-sm outline-none resize-none transition-colors"
              style={{
                border: '1px solid rgba(0,0,0,0.06)',
                borderRadius: '12px',
                background: 'rgba(255,255,255,0.5)',
                color: '#1c1c1e',
              }}
            />
          </div>

          {/* Subject + Story name row */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] tracking-wider mb-2 block" style={{ color: '#8e8e93' }}>
                学科分类
              </label>
              <input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="例：编程 / 设计"
                className="w-full px-4 py-3 text-sm outline-none transition-colors"
                style={{
                  border: '1px solid rgba(0,0,0,0.06)',
                  borderRadius: '12px',
                  background: 'rgba(255,255,255,0.5)',
                  color: '#1c1c1e',
                }}
              />
            </div>
            <div>
              <label className="text-[10px] tracking-wider mb-2 block" style={{ color: '#8e8e93' }}>
                图标
              </label>
              <input
                value={icon}
                onChange={(e) => setIcon(e.target.value.slice(0, 1))}
                placeholder="单个字"
                maxLength={1}
                className="w-20 px-4 py-3 text-sm text-center outline-none transition-colors"
                style={{
                  border: '1px solid rgba(0,0,0,0.06)',
                  borderRadius: '12px',
                  background: 'rgba(255,255,255,0.5)',
                  color: '#1c1c1e',
                }}
                onFocus={(e) => { e.target.style.borderColor = 'rgba(0,0,0,0.15)' }}
                onBlur={(e) => { e.target.style.borderColor = 'rgba(0,0,0,0.06)' }}
              />
            </div>
          </div>

          {/* Difficulty + Numbers row */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-[10px] tracking-wider mb-2 block" style={{ color: '#8e8e93' }}>
                难度
              </label>
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value as typeof difficulty)}
                className="w-full px-4 py-3 text-sm outline-none transition-colors"
                style={{
                  border: '1px solid rgba(0,0,0,0.06)',
                  borderRadius: '12px',
                  background: 'rgba(255,255,255,0.5)',
                  color: '#1c1c1e',
                  appearance: 'none',
                }}
              >
                {DIFFICULTY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] tracking-wider mb-2 block" style={{ color: '#8e8e93' }}>
                预计时长(分)
              </label>
              <input
                type="number"
                min={1}
                max={999}
                value={estimatedMinutes}
                onChange={(e) => setEstimatedMinutes(Number(e.target.value))}
                className="w-full px-4 py-3 text-sm outline-none transition-colors"
                style={{
                  border: '1px solid rgba(0,0,0,0.06)',
                  borderRadius: '12px',
                  background: 'rgba(255,255,255,0.5)',
                  color: '#1c1c1e',
                }}
              />
            </div>
            <div>
              <label className="text-[10px] tracking-wider mb-2 block" style={{ color: '#8e8e93' }}>
                场景数
              </label>
              <input
                type="number"
                min={1}
                max={99}
                value={totalNodes}
                onChange={(e) => setTotalNodes(Number(e.target.value))}
                className="w-full px-4 py-3 text-sm outline-none transition-colors"
                style={{
                  border: '1px solid rgba(0,0,0,0.06)',
                  borderRadius: '12px',
                  background: 'rgba(255,255,255,0.5)',
                  color: '#1c1c1e',
                }}
              />
            </div>
          </div>

          {/* Objectives */}
          <div>
            <label className="text-[10px] tracking-wider mb-2 block" style={{ color: '#8e8e93' }}>
              学习目标（每行一个）
            </label>
            <div className="flex gap-2 mb-2">
              <input
                value={objectiveInput}
                onChange={(e) => setObjectiveInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addObjective() } }}
                placeholder="输入目标后按回车添加"
                className="flex-1 px-4 py-3 text-sm outline-none transition-colors"
                style={{
                  border: '1px solid rgba(0,0,0,0.06)',
                  borderRadius: '12px',
                  background: 'rgba(255,255,255,0.5)',
                  color: '#1c1c1e',
                }}
              />
              <button
                type="button"
                onClick={addObjective}
                className="px-4 text-[10px] tracking-wider transition-colors"
                style={{
                  border: '1px solid rgba(0,0,0,0.06)',
                  borderRadius: '12px',
                  color: '#8e8e93',
                }}
              >
                + 添加
              </button>
            </div>
            {objectives.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {objectives.map((obj, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1.5 text-[10px] px-2.5 py-1 rounded-full"
                    style={{
                      background: 'rgba(0,0,0,0.03)',
                      border: '1px solid rgba(0,0,0,0.06)',
                      color: '#636366',
                    }}
                  >
                    {obj}
                    <button
                      type="button"
                      onClick={() => removeObjective(i)}
                      className="hover:opacity-60 transition-opacity"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Submit */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={!title.trim() || saving}
              className="w-full py-3 text-xs tracking-wider transition-all duration-200 disabled:opacity-30"
              style={{
                borderRadius: '12px',
                background: '#1c1c1e',
                color: '#fff',
              }}
            >
              {saving
                ? '保存中...'
                : isEditing
                  ? '保存修改'
                  : '创建课程并开始学习'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
