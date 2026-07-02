'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { useLearnStore } from '@/learn/store'

export default function EditSeriesPage() {
  const router = useRouter()
  const params = useParams()
  const seriesId = params.id as string

  const series = useLearnStore((s) => s.series.find((se) => se.id === seriesId))
  const updateSeries = useLearnStore((s) => s.updateSeries)
  const updateSeriesKp = useLearnStore((s) => s.updateSeriesKp)
  const removeSeries = useLearnStore((s) => s.removeSeries)

  const [title, setTitle] = useState('')
  const [topic, setTopic] = useState('')
  const [icon, setIcon] = useState('')
  const [saving, setSaving] = useState(false)
  const [editingKpId, setEditingKpId] = useState<string | null>(null)
  const [editingKpName, setEditingKpName] = useState('')
  const [editingKpDesc, setEditingKpDesc] = useState('')

  useEffect(() => {
    if (!series) return
    setTitle(series.title)
    setTopic(series.topic)
    setIcon(series.icon || '')
  }, [series])

  if (!series) {
    return (
      <div className="flex items-center justify-center min-h-screen" style={{ background: '#faf8f5' }}>
        <p className="text-[12px] tracking-wider" style={{ color: '#aeaeb2' }}>
          系列课程未找到
        </p>
      </div>
    )
  }

  function handleSave() {
    if (!title.trim()) return
    setSaving(true)
    updateSeries(seriesId, {
      title: title.trim(),
      topic: topic.trim(),
      icon: icon.trim() || title.trim()[0] || '系',
    })
    router.push(`/learn/series/${seriesId}`)
  }

  function handleKpEdit(kp: { id: string; name: string; description: string }) {
    setEditingKpId(kp.id)
    setEditingKpName(kp.name)
    setEditingKpDesc(kp.description)
  }

  function handleKpSave() {
    if (!editingKpId || !editingKpName.trim()) return
    updateSeriesKp(seriesId, editingKpId, {
      name: editingKpName.trim(),
      description: editingKpDesc.trim(),
    })
    setEditingKpId(null)
    setEditingKpName('')
    setEditingKpDesc('')
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
            编辑系列课程
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
          编辑系列课程
        </h1>

        {/* Basic info */}
        <div className="flex flex-col gap-5 mb-8">
          <div>
            <label className="text-[10px] tracking-wider mb-2 block" style={{ color: '#8e8e93' }}>
              系列标题
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
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

          <div>
            <label className="text-[10px] tracking-wider mb-2 block" style={{ color: '#8e8e93' }}>
              学习专题
            </label>
            <input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
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

          <div>
            <label className="text-[10px] tracking-wider mb-2 block" style={{ color: '#8e8e93' }}>
              系列图标
            </label>
            <input
              value={icon}
              onChange={(e) => setIcon(e.target.value)}
              placeholder="留空自动取标题首字"
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

        {/* Knowledge points */}
        <div className="mb-8">
          <h2
            className="mb-4"
            style={{
              fontFamily: 'var(--font-noto-serif-sc)',
              fontWeight: 300,
              fontSize: '1rem',
              letterSpacing: '0.15em',
              color: '#1c1c1e',
            }}
          >
            知识点 ({series.knowledgePoints.length})
          </h2>

          <div className="flex flex-col gap-2">
            {series.knowledgePoints.map((kp, i) => (
              <div
                key={kp.id}
                className="p-3 rounded-xl transition-all duration-200"
                style={{
                  border: '1px solid rgba(0,0,0,0.06)',
                  background: 'rgba(255,255,255,0.4)',
                }}
              >
                {editingKpId === kp.id ? (
                  <div className="flex flex-col gap-2">
                    <input
                      value={editingKpName}
                      onChange={(e) => setEditingKpName(e.target.value)}
                      className="w-full px-3 py-2 text-[11px] tracking-wider outline-none transition-colors"
                      style={{
                        border: '1px solid rgba(0,0,0,0.1)',
                        borderRadius: '8px',
                        background: '#fff',
                        color: '#1c1c1e',
                      }}
                      placeholder="知识点名称"
                    />
                    <input
                      value={editingKpDesc}
                      onChange={(e) => setEditingKpDesc(e.target.value)}
                      className="w-full px-3 py-2 text-[9px] tracking-wider outline-none transition-colors"
                      style={{
                        border: '1px solid rgba(0,0,0,0.1)',
                        borderRadius: '8px',
                        background: '#fff',
                        color: '#636366',
                      }}
                      placeholder="知识点描述"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={handleKpSave}
                        className="text-[9px] tracking-wider px-3 py-1 rounded-full transition-all duration-200"
                        style={{
                          background: '#1c1c1e',
                          color: '#fff',
                        }}
                      >
                        保存
                      </button>
                      <button
                        onClick={() => setEditingKpId(null)}
                        className="text-[9px] tracking-wider px-3 py-1 rounded-full transition-all duration-200"
                        style={{
                          border: '1px solid rgba(0,0,0,0.1)',
                          color: '#636366',
                        }}
                      >
                        取消
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px]" style={{ color: '#aeaeb2' }}>
                          {i + 1}
                        </span>
                        <span className="text-[11px] tracking-wider" style={{ color: '#1c1c1e' }}>
                          {kp.name}
                        </span>
                        {kp.courseId && (
                          <span className="text-[8px] px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(44,110,73,0.1)', color: '#2c6e49' }}>
                            已创建课程
                          </span>
                        )}
                      </div>
                      <div className="text-[9px] leading-relaxed" style={{ color: '#aeaeb2' }}>
                        {kp.description}
                      </div>
                    </div>
                    <button
                      onClick={() => handleKpEdit(kp)}
                      className="text-[9px] tracking-wider px-2 py-1 rounded-full transition-all duration-200 shrink-0"
                      style={{
                        border: '1px solid rgba(0,0,0,0.06)',
                        color: '#999',
                      }}
                    >
                      编辑
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Save button */}
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !title.trim()}
          className="w-full py-3 text-xs tracking-wider transition-all duration-200 rounded-xl disabled:opacity-30"
          style={{
            background: '#1c1c1e',
            color: '#fff',
            letterSpacing: '0.12em',
          }}
        >
          {saving ? '保存中...' : '保存修改'}
        </button>

        {/* Delete series */}
        <button
          type="button"
          onClick={() => {
            if (confirm('确定要删除这个系列课程吗？')) {
              removeSeries(seriesId)
              router.push('/learn')
            }
          }}
          className="w-full mt-3 py-3 text-xs tracking-wider transition-all duration-200 rounded-xl"
          style={{
            border: '1px solid rgba(196,30,58,0.2)',
            color: '#c41e3a',
            letterSpacing: '0.12em',
          }}
        >
          删除系列课程
        </button>
      </div>
    </div>
  )
}
