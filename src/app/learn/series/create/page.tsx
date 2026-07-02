'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useLearnStore } from '@/learn/store'
import { useStore } from '@/lib/store'
import type { SeriesDepthLevel, SeriesKnowledgePoint } from '@/learn/types'

const DEPTH_OPTIONS: { value: SeriesDepthLevel; label: string; desc: string }[] = [
  {
    value: 'overview',
    label: '概览了解',
    desc: '覆盖核心基础概念，适合快速入门',
  },
  {
    value: 'detailed',
    label: '深入学习',
    desc: '覆盖主要知识领域，适合系统学习',
  },
  {
    value: 'comprehensive',
    label: '全面掌握',
    desc: '系统性覆盖各层面，适合精通掌握',
  },
]

export default function CreateSeriesPage() {
  const router = useRouter()
  const addSeries = useLearnStore((s) => s.addSeries)
  const llmSettings = useStore((s) => s.llmSettings)

  const [topic, setTopic] = useState('')
  const [depth, setDepth] = useState<SeriesDepthLevel>('detailed')
  const [icon, setIcon] = useState('')
  const [generating, setGenerating] = useState(false)
  const [generatedTitle, setGeneratedTitle] = useState('')
  const [generatedKps, setGeneratedKps] = useState<SeriesKnowledgePoint[]>([])
  const [saving, setSaving] = useState(false)

  async function handleGenerate() {
    if (!topic.trim()) return
    if (!llmSettings?.apiUrl || !llmSettings?.apiKey) {
      alert('请先在 Settings 中配置 LLM API')
      return
    }
    setGenerating(true)
    try {
      const res = await fetch('/api/learn/generate-series', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: topic.trim(),
          depth,
          llmConfig: llmSettings,
          language: 'zh',
        }),
      })
      if (!res.ok) throw new Error('生成失败')
      const data = await res.json()
      setGeneratedTitle(data.title || topic.trim())
      if (data.icon && !icon.trim()) setIcon(data.icon)
      setGeneratedKps((data.knowledgePoints || []).map((kp: any) => ({
        ...kp,
        completed: false,
      })))
    } catch {
      alert('生成知识点失败，请重试')
    } finally {
      setGenerating(false)
    }
  }

  function handleSave() {
    if (!topic.trim() || generatedKps.length === 0) return
    setSaving(true)
    const id = addSeries({
      title: generatedTitle || topic.trim(),
      topic: topic.trim(),
      depth,
      icon: icon.trim() || generatedTitle.trim()[0] || topic.trim()[0] || '系',
      knowledgePoints: generatedKps,
    })
    router.push(`/learn/series/${id}`)
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
            创建系列课程
          </span>
        </div>

        <h1
          className="mb-2"
          style={{
            fontFamily: 'var(--font-noto-serif-sc)',
            fontWeight: 300,
            fontSize: 'clamp(1.2rem, 2.5vw, 1.5rem)',
            letterSpacing: '0.2em',
            color: '#1c1c1e',
          }}
        >
          创建系列课程
        </h1>
        <p
          className="mb-8 text-[11px] tracking-wider"
          style={{ color: '#aeaeb2', letterSpacing: '0.05em' }}
        >
          定义一个学习专题，AI 将为你生成完整的知识体系，逐步创建课程
        </p>

        {/* Step 1: Topic + Depth */}
        <div className="flex flex-col gap-5 mb-8">
          {/* Topic */}
          <div>
            <label className="text-[10px] tracking-wider mb-2 block" style={{ color: '#8e8e93' }}>
              你想学习什么？
            </label>
            <input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="例：税务筹划 / Python 数据分析 / 设计思维"
              className="w-full px-4 py-3 text-sm outline-none transition-colors"
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

          {/* Depth selection */}
          <div>
            <label className="text-[10px] tracking-wider mb-3 block" style={{ color: '#8e8e93' }}>
              学习深度
            </label>
            <div className="grid grid-cols-3 gap-3">
              {DEPTH_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setDepth(opt.value)}
                  className="text-left p-3.5 rounded-xl transition-all duration-200"
                  style={{
                    border: `1px solid ${depth === opt.value ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.06)'}`,
                    background: depth === opt.value ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.3)',
                  }}
                >
                  <div
                    className="text-[11px] tracking-wider mb-1"
                    style={{ color: depth === opt.value ? '#1c1c1e' : '#636366' }}
                  >
                    {opt.label}
                  </div>
                  <div className="text-[9px] leading-relaxed" style={{ color: '#aeaeb2' }}>
                    {opt.desc}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Icon */}
          <div>
            <label className="text-[10px] tracking-wider mb-2 block" style={{ color: '#8e8e93' }}>
              系列图标（单个字）
            </label>
            <input
              value={icon}
              onChange={(e) => setIcon(e.target.value.slice(0, 1))}
              placeholder="留空自动取标题首字"
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

          {/* Generate button */}
          <button
            type="button"
            onClick={handleGenerate}
            disabled={!topic.trim() || generating}
            className="w-full py-3 text-xs tracking-wider transition-all duration-200 rounded-xl disabled:opacity-30"
            style={{
              background: 'linear-gradient(135deg, #1c1c1e 0%, #3a3a3c 100%)',
              color: '#fff',
              letterSpacing: '0.12em',
            }}
          >
            {generating ? 'AI 生成中...' : 'AI 生成知识体系'}
          </button>
        </div>

        {/* Step 2: Generated results */}
        {generatedKps.length > 0 && (
          <div
            className="rounded-xl p-5 mb-8 transition-all duration-500"
            style={{
              border: '1px solid rgba(0,0,0,0.06)',
              background: 'rgba(255,255,255,0.4)',
            }}
          >
            <div className="flex items-center justify-between mb-4">
              <h2
                style={{
                  fontFamily: 'var(--font-noto-serif-sc)',
                  fontWeight: 300,
                  fontSize: '0.95rem',
                  letterSpacing: '0.12em',
                  color: '#1c1c1e',
                }}
              >
                {generatedTitle || topic}
              </h2>
              <span className="text-[10px]" style={{ color: '#aeaeb2' }}>
                {generatedKps.length} 个知识点
              </span>
            </div>

            <div className="flex flex-col gap-2">
              {generatedKps.map((kp, i) => (
                <div
                  key={kp.id}
                  className="flex items-start gap-3 p-3 rounded-lg transition-colors"
                  style={{ background: 'rgba(255,255,255,0.5)' }}
                >
                  <span
                    className="text-[10px] mt-0.5 shrink-0"
                    style={{ color: '#aeaeb2', minWidth: '1.2rem' }}
                  >
                    {i + 1}
                  </span>
                  <div className="min-w-0">
                    <div className="text-[11px] tracking-wider mb-0.5" style={{ color: '#1c1c1e' }}>
                      {kp.name}
                    </div>
                    <div className="text-[9px] leading-relaxed" style={{ color: '#aeaeb2' }}>
                      {kp.description}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Save button */}
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="w-full mt-4 py-3 text-xs tracking-wider transition-all duration-200 rounded-xl disabled:opacity-30"
              style={{
                border: '1px solid rgba(0,0,0,0.1)',
                color: '#1c1c1e',
                letterSpacing: '0.12em',
                background: 'rgba(255,255,255,0.5)',
              }}
            >
              {saving ? '保存中...' : '确认创建系列课程'}
            </button>

            {/* Regenerate */}
            <button
              type="button"
              onClick={handleGenerate}
              disabled={!topic.trim() || generating}
              className="w-full mt-2 py-2.5 text-[10px] tracking-wider transition-all duration-200 rounded-xl disabled:opacity-30"
              style={{
                color: '#aeaeb2',
                letterSpacing: '0.1em',
              }}
            >
              重新生成
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
