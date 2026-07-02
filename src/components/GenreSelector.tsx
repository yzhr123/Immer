'use client'

import { useState, useEffect, useRef } from 'react'
import { Genre, GENRE_NAMES, GENRE_NAMES_EN } from '@/lib/ai/types'
import { useStore } from '@/lib/store'
import { t } from '@/lib/i18n'
import type { LLMSettings } from '@/lib/ai/types'

const GENRES: Genre[] = ['fantasy', 'sci-fi', 'mystery', 'historical', 'horror', 'martial-arts']

export default function GenreSelector({
  selected,
  onSelect,
}: {
  selected: string | null
  onSelect: (genre: string) => void
}) {
  const language = useStore((s) => s.language)
  const llmSettings = useStore((s) => s.llmSettings)
  const [customMode, setCustomMode] = useState(false)
  const [customValue, setCustomValue] = useState('')
  const [generating, setGenerating] = useState(false)
  const [genError, setGenError] = useState('')

  // Auto-switch to custom mode when a non-preset genre is selected (Story Club import).
  useEffect(() => {
    if (!selected) return
    if ((GENRES as string[]).includes(selected)) {
      setCustomMode(false)
      setCustomValue('')
    } else {
      setCustomMode(true)
      setCustomValue(selected)
    }
  }, [selected])

  /* ─── sliding glass pill ─── */
  const containerRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([])
  const [pill, setPill] = useState({ left: 0, width: 0, top: 0, height: 0 })

  useEffect(() => {
    if (!selected || !containerRef.current) return
    const idx = GENRES.indexOf(selected as Genre)
    if (idx === -1) return
    const el = itemRefs.current[idx]
    const parent = containerRef.current
    if (!el) return
    const pr = parent.getBoundingClientRect()
    const er = el.getBoundingClientRect()
    setPill({
      left: er.left - pr.left,
      width: er.width,
      top: er.top - pr.top,
      height: er.height,
    })
  }, [selected])

  async function generateGenre() {
    if (!llmSettings.apiUrl || !llmSettings.model || !llmSettings.apiKey) {
      setGenError(language === 'en' ? 'LLM not configured' : '未配置 LLM')
      return
    }
    setGenError('')
    setGenerating(true)
    try {
      const res = await fetch('/api/beta/random-genre', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ llmConfig: llmSettings, language }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err?.error || 'Generate failed')
      }
      const data = await res.json()
      if (data.genre) {
        setCustomValue(data.genre)
        onSelect(data.genre)
      }
    } catch (e) {
      setGenError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setGenerating(false)
    }
  }

  if (customMode) {
    return (
      <div className="flex flex-col items-center gap-3">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={customValue}
            onChange={(e) => {
              setGenError('')
              setCustomValue(e.target.value)
              onSelect(e.target.value)
            }}
            placeholder={t('genre.customPlaceholder', language)}
            className="w-56 text-center text-sm text-zinc-600 placeholder-zinc-300 bg-transparent border-b border-zinc-200 pb-1.5 focus:outline-none focus:border-zinc-600 transition-colors"
            autoFocus
          />
          <button
            onClick={generateGenre}
            disabled={generating}
            className="text-xs tracking-wider text-zinc-400 hover:text-zinc-600 transition-colors disabled:opacity-30 whitespace-nowrap"
            title={language === 'en' ? 'AI Generate' : 'AI 随机生成'}
          >
            {generating ? '...' : '✦'}
          </button>
        </div>
        {genError && (
          <p className="text-[11px] text-red-400/70 tracking-wider">{genError}</p>
        )}
        <button
          onClick={() => {
            setCustomMode(false)
            setCustomValue('')
            onSelect(GENRES[0])
          }}
          className="text-xs text-zinc-400 hover:text-zinc-600 tracking-wider transition-colors"
        >
          {t('genre.backToPresets', language)}
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-5">
      <div ref={containerRef} className="relative flex flex-wrap justify-center gap-3">
        {/* sliding glass pill — positioned behind the selected item */}
        {selected && (GENRES as string[]).includes(selected) && (
          <div
            className="absolute rounded-full pointer-events-none transition-all duration-500 ease-out"
            style={{
              left: pill.left,
              width: pill.width,
              top: pill.top,
              height: pill.height,
              background: 'rgba(28,28,30,0.75)',
              backdropFilter: 'blur(16px) saturate(140%)',
              WebkitBackdropFilter: 'blur(16px) saturate(140%)',
              border: '1px solid rgba(255,255,255,0.06)',
              boxShadow: '0 2px 8px rgba(0,0,0,0.12), 0 0 0 1px rgba(255,255,255,0.04)',
            }}
          />
        )}

        {GENRES.map((genre, idx) => (
          <button
            key={genre}
            ref={(el) => { itemRefs.current[idx] = el }}
            onClick={() => onSelect(genre)}
            className="relative px-5 py-2.5 text-xs tracking-wider rounded-full transition-all duration-300 z-10"
            style={{
              color: selected === genre ? '#ffffff' : '#aeaeb2',
            }}
          >
            {language === 'en' ? GENRE_NAMES_EN[genre] : GENRE_NAMES[genre]}
          </button>
        ))}
      </div>
      <button
        onClick={() => setCustomMode(true)}
        className={`text-[11px] tracking-wider transition-all duration-200 ${
          selected && !(GENRES as string[]).includes(selected)
            ? 'opacity-80 underline underline-offset-4'
            : 'opacity-40 hover:opacity-70'
        }`}
        style={{ color: '#1c1c1e' }}
      >
        {t('genre.custom', language)}
      </button>
    </div>
  )
}
