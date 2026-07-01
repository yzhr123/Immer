'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import FluidCanvas from '@/components/FluidCanvas'

const GENRES = [
  { id: 'fantasy',      label: '奇幻' },
  { id: 'sci-fi',       label: '科幻' },
  { id: 'mystery',      label: '悬疑' },
  { id: 'historical',   label: '历史' },
  { id: 'horror',       label: '恐怖' },
  { id: 'martial-arts', label: '武侠' },
]

const B = 'cubic-bezier(0.16, 1, 0.3, 1)'

export default function Portal() {
  const router = useRouter()
  const [titleHovered, setTitleHovered] = useState(false)
  const [revealed, setRevealed] = useState(false)
  const cardsRef = useRef<(HTMLButtonElement | null)[]>([])
  const isTouchRef = useRef(false)

  useEffect(() => {
    isTouchRef.current = 'ontouchstart' in window || window.innerWidth < 640
  }, [])

  // mirrors ui.html: .glass-card::before mouse-following radial highlight
  useEffect(() => {
    const cards = cardsRef.current.filter(Boolean) as HTMLButtonElement[]
    const handler = (e: MouseEvent, card: HTMLButtonElement) => {
      const rect = card.getBoundingClientRect()
      card.style.setProperty('--x', `${e.clientX - rect.left}px`)
      card.style.setProperty('--y', `${e.clientY - rect.top}px`)
    }
    cards.forEach((card) => {
      card.addEventListener('mousemove', (e: MouseEvent) => handler(e, card))
    })
    return () => {
      cards.forEach((card) => {
        card.removeEventListener('mousemove', (e: MouseEvent) => handler(e, card))
      })
    }
  }, [revealed])

  function handleGenreClick(genreId: string) {
    router.push(`/lobby?genre=${genreId}`)
  }

  // 鼠标悬停 Immer → blur 随进随出自由切换；首次 hover 同时触发 revealed（一次 latch）
  const handleMouseEnter = useCallback(() => {
    setTitleHovered(true)
    if (!revealed) setRevealed(true)
  }, [revealed])

  const handleMouseLeave = useCallback(() => {
    setTitleHovered(false)
  }, [])

  // 点击 Immer → 仅在触屏设备上触发 reveal + 短暂 blur 作为反馈
  const handleClick = useCallback(() => {
    if (!revealed) {
      setRevealed(true)
      if (isTouchRef.current) {
        setTitleHovered(true)
        setTimeout(() => setTitleHovered(false), 1000)
      }
    }
  }, [revealed])

  const sharedNoto = {
    fontFamily: 'var(--font-noto-serif-sc)',
    fontWeight: 300,
  }

  return (
    <div className="flex flex-col items-center justify-center h-screen w-screen overflow-hidden select-none relative bg-white">
      {/* 液态波纹背景 */}
      <FluidCanvas />

      {/* === .brand-box (z-10 浮在 canvas 之上) === */}
      <div
        className="text-center cursor-default"
        style={{ zIndex: 10, marginBottom: '8vh' }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
      >
        {/* .brand-title — 模糊/字距只跟随 titleHovered */}
        <h1
          className="transition-all duration-800"
          style={{
            fontFamily: 'var(--font-plus-jakarta)',
            fontWeight: 200,
            fontSize: 'clamp(3.5rem, 12vw, 6rem)',
            color: '#000000',
            letterSpacing: titleHovered ? '2.2rem' : '1.5rem',
            textIndent: titleHovered ? '2.2rem' : '1.5rem',
            marginBottom: '0.8rem',
            opacity: titleHovered ? 0.3 : 0.95,
            filter: titleHovered ? 'blur(8px)' : 'blur(0)',
            transitionTimingFunction: B,
            transitionDuration: '800ms',
            transitionProperty: 'letter-spacing, text-indent, opacity, filter',
          }}
        >
          Immer
        </h1>

        {/* .brand-subtitle */}
        <p
          className="transition-all duration-800"
          style={{
            ...sharedNoto,
            fontSize: '1rem',
            color: '#333333',
            letterSpacing: '0.6rem',
            textIndent: '0.6rem',
            opacity: titleHovered ? 0.2 : 0.5,
            transitionTimingFunction: 'ease',
          }}
        >
          AI 互动故事
        </p>

        {/* 系统介绍 — revealed 后永久显示 */}
        <div
          className={`transition-all duration-800 ${
            revealed
              ? 'opacity-100 blur-none translate-y-0'
              : 'opacity-0 blur-[6px] translate-y-3'
          }`}
          style={{
            marginTop: '2.5rem',
            marginBottom: '1rem',
            transitionTimingFunction: B,
            transitionProperty: 'opacity, filter, transform',
          }}
        >
          <p
            style={{
              ...sharedNoto,
              fontSize: '0.85rem',
              color: '#555555',
              letterSpacing: '0.2rem',
              lineHeight: '2',
            }}
          >
            沉浸式AI剧情体验 · 每一次选择，都将重塑故事的流向
          </p>
        </div>
      </div>

      {/* === .category-grid — revealed 后永久显示 === */}
      <div
        className={`transition-all duration-1000 ${
          revealed
            ? 'opacity-100 blur-none translate-y-0 pointer-events-auto'
            : 'opacity-0 blur-[20px] translate-y-10 pointer-events-none'
        }`}
        style={{
          width: '85%',
          maxWidth: '1200px',
          transitionTimingFunction: B,
          transitionProperty: 'opacity, filter, transform',
          zIndex: 10,
        }}
      >
        <div className="grid grid-cols-2 sm:grid-cols-6 gap-4 sm:gap-6">
          {GENRES.map((genre, index) => (
            <button
              key={genre.id}
              ref={(el) => { cardsRef.current[index] = el }}
              onClick={() => handleGenreClick(genre.id)}
              style={{
                transitionDelay: revealed ? `${index * 70}ms` : '0ms',
                transitionTimingFunction: B,
              }}
              className="group relative text-center overflow-hidden cursor-pointer transition-all duration-600 hover:-translate-y-2.5 active:scale-95"
            >
              {/* .glass-card background + backdrop-filter — 无边框，靠背景反差感知 */}
              <div
                className="absolute inset-0"
                style={{
                  background: 'rgba(255,255,255,0.25)',
                  borderRadius: '20px',
                  backdropFilter: 'blur(35px) saturate(130%)',
                  WebkitBackdropFilter: 'blur(35px) saturate(130%)',
                  transition: 'background-color 0.6s ease, box-shadow 0.6s ease',
                }}
              />
              {/* .glass-card:hover: 自然凸显 — 无阴影，靠上移 + 聚白 + 高光 */}
              <div
                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-600"
                style={{
                  background: 'rgba(255,255,255,0.45)',
                  borderRadius: '20px',
                }}
              />
              {/* .glass-card::before — mouse-following radial highlight */}
              <span
                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-600 pointer-events-none"
                style={{
                  borderRadius: '20px',
                  background: 'radial-gradient(100px circle at var(--x, 0px) var(--y, 0px), rgba(0,0,0,0.05), transparent 80%)',
                  zIndex: 1,
                }}
              />

              {/* === .card-content === */}
              <div
                className="relative flex flex-col items-center justify-center transition-transform duration-500 group-hover:-translate-y-2.5"
                style={{
                  height: '100%',
                  padding: '2.5rem 1rem',
                  transitionTimingFunction: B,
                  zIndex: 2,
                }}
              >
                {/* .card-name */}
                <span
                  className="transition-all duration-400 text-[#111111] group-hover:text-black group-hover:font-normal"
                  style={{
                    ...sharedNoto,
                    fontSize: '1.15rem',
                    letterSpacing: '0.3rem',
                    textIndent: '0.3rem',
                    zIndex: 2,
                  }}
                >
                  {genre.label}
                </span>

                {/* .action-hint */}
                <span
                  className="absolute transition-all duration-500 opacity-0 translate-y-[10px] group-hover:!opacity-100 group-hover:!translate-y-0"
                  style={{
                    ...sharedNoto,
                    fontWeight: 400,
                    fontSize: '0.75rem',
                    color: '#000000',
                    letterSpacing: '0.1rem',
                    marginTop: '0.8rem',
                    bottom: '1.2rem',
                    transitionTimingFunction: B,
                    filter: 'blur(0)',
                  }}
                >
                  进入体验 →
                </span>
              </div>
            </button>
          ))}
        </div>

        {/* === Immersive Learning Lab Entry — below genre grid === */}
        <div
          className="transition-all duration-1000 mt-12 flex justify-center"
          style={{
            transitionTimingFunction: B,
            transitionProperty: 'opacity, filter, transform',
          }}
        >
          <button
            onClick={() => router.push('/learn')}
            className="group relative cursor-pointer overflow-hidden transition-all duration-600 hover:-translate-y-1.5 active:scale-95"
            style={{
              borderRadius: '999px',
              padding: '1rem 3rem',
            }}
          >
            {/* Default: light glass background */}
            <div
              className="absolute inset-0 transition-all duration-600"
              style={{
                background: 'rgba(255,255,255,0.50)',
                borderRadius: '999px',
                backdropFilter: 'blur(35px) saturate(160%)',
                WebkitBackdropFilter: 'blur(35px) saturate(160%)',
                border: '1px solid rgba(0,0,0,0.08)',
                boxShadow: '0 4px 20px rgba(0,0,0,0.04)',
              }}
            />
            {/* Hover: dark solid inversion */}
            <div
              className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-all duration-600"
              style={{
                background: '#18181b',
                borderRadius: '999px',
                border: '1px solid rgba(255,255,255,0.12)',
                boxShadow: '0 8px 32px rgba(0,0,0,0.20)',
              }}
            />

            {/* Content — text swaps on hover */}
            <div className="relative flex items-center justify-center">
              {/* Default text */}
              <span
                className="transition-opacity duration-600 group-hover:opacity-0"
                style={{ ...sharedNoto, fontSize: '0.95rem', letterSpacing: '0.18rem', color: '#1a1a1a' }}
              >
                沉浸式学习空间
              </span>
              {/* Hover text (white, replaces) */}
              <span
                className="absolute inset-0 flex items-center justify-center transition-opacity duration-600 opacity-0 group-hover:opacity-100"
                style={{ ...sharedNoto, fontSize: '0.95rem', letterSpacing: '0.18rem', color: '#ffffff' }}
              >
                进入学习空间
              </span>
            </div>
          </button>
        </div>
      </div>
    </div>
  )
}
