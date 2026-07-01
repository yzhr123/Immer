'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import FluidCanvas from '@/components/FluidCanvas'

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

export default function LearnPage() {
  const router = useRouter()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  return (
    <div className="flex flex-col items-center justify-center h-screen w-screen overflow-hidden select-none relative bg-white">
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
        className={`transition-all duration-1000 ${
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
        <div className="text-center mb-10">
          <h1
            style={{
              ...sharedNoto,
              fontSize: 'clamp(1.5rem, 4vw, 2.2rem)',
              letterSpacing: '0.25em',
              color: '#111',
              marginBottom: '0.75rem',
            }}
          >
            沉浸式学习空间
          </h1>
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

        {/* Module cards grid */}
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
