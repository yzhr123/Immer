'use client'

import { useState } from 'react'
import { Genre, GENRE_NAMES } from '@/lib/ai/types'

const GENRES: Genre[] = ['fantasy', 'sci-fi', 'mystery', 'historical', 'horror', 'martial-arts']

export default function GenreSelector({
  selected,
  onSelect,
}: {
  selected: string | null
  onSelect: (genre: string) => void
}) {
  const [customMode, setCustomMode] = useState(false)
  const [customValue, setCustomValue] = useState('')

  if (customMode) {
    return (
      <div className="flex flex-col items-center gap-3">
        <input
          type="text"
          value={customValue}
          onChange={(e) => {
            setCustomValue(e.target.value)
            onSelect(e.target.value || '自定义')
          }}
          placeholder="输入自定义类型..."
          className="w-64 text-center text-sm text-zinc-600 placeholder-zinc-300 bg-transparent border-b border-zinc-200 pb-1.5 focus:outline-none focus:border-zinc-600 transition-colors"
          autoFocus
        />
        <button
          onClick={() => {
            setCustomMode(false)
            setCustomValue('')
            onSelect(GENRES[0])
          }}
          className="text-xs text-zinc-400 hover:text-zinc-600 tracking-wider transition-colors"
        >
          BACK TO PRESETS
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex flex-wrap justify-center gap-x-8 gap-y-4">
        {GENRES.map((genre) => (
          <button
            key={genre}
            onClick={() => onSelect(genre)}
            className={`relative text-sm tracking-wider transition-all duration-200 pb-0.5 ${
              selected === genre
                ? 'text-zinc-800'
                : 'text-zinc-400 hover:text-zinc-600'
            }`}
          >
            {GENRE_NAMES[genre]}
            {selected === genre && (
              <span className="absolute bottom-0 left-0 right-0 h-px bg-zinc-800" />
            )}
          </button>
        ))}
      </div>
      <button
        onClick={() => setCustomMode(true)}
        className={`text-xs tracking-wider transition-colors ${
          selected && !(GENRES as string[]).includes(selected)
            ? 'text-zinc-800 underline'
            : 'text-zinc-400 hover:text-zinc-600'
        }`}
      >
        CUSTOM
      </button>
    </div>
  )
}
