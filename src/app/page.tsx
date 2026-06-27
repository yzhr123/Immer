'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import GenreSelector from '@/components/GenreSelector'
import SettingsDialog from '@/components/SettingsDialog'
import { useStore } from '@/lib/store'
import { generateId } from '@/lib/utils'
import { GENRE_TITLES, StoryLength, LENGTH_LABELS } from '@/lib/ai/types'

export default function Lobby() {
  const router = useRouter()
  const { llmSettings, initGame, savedGames, refreshSavedGames } = useStore()
  const [genre, setGenre] = useState<string | null>(null)
  const [premise, setPremise] = useState('')
  const [storyLength, setStoryLength] = useState<StoryLength>('medium')
  const [loading, setLoading] = useState(false)

  function handleStart() {
    if (!genre) return
    if (!llmSettings.apiUrl || !llmSettings.apiKey) {
      alert('请在 Settings 中配置 LLM API')
      return
    }

    setLoading(true)
    const sessionId = generateId()

    initGame({
      sessionId,
      genre,
      title: GENRE_TITLES[genre] || genre,
      premise,
      storyLength,
    })

    router.push(`/game/${sessionId}`)
  }

  return (
    <div className="flex flex-col flex-1 items-center justify-center px-6">
      <div className="w-full max-w-lg flex flex-col items-center py-24 gap-16">

        {/* Header */}
        <div className="text-center space-y-3">
          <h1 className="text-5xl font-light tracking-[0.15em] text-zinc-800">
            Immer
          </h1>
          <p className="text-sm text-zinc-400 tracking-wider">
            AI Interactive Story
          </p>
        </div>

        {/* Genre Selection */}
        <div className="w-full space-y-5">
          <p className="text-center text-xs text-zinc-400 tracking-widest">
            SELECT GENRE
          </p>
          <GenreSelector selected={genre} onSelect={setGenre} />
        </div>

        {/* Story Length */}
        <div className="w-full space-y-3">
          <p className="text-center text-xs text-zinc-400 tracking-widest">
            STORY LENGTH
          </p>
          <div className="flex justify-center gap-3">
            {(['short', 'medium', 'long'] as StoryLength[]).map((len) => (
              <button
                key={len}
                onClick={() => setStoryLength(len)}
                className={`px-5 py-2 text-xs tracking-wider transition-all duration-200 rounded-sm ${
                  storyLength === len
                    ? 'bg-zinc-800 text-white'
                    : 'text-zinc-500 border border-zinc-200 hover:border-zinc-400'
                }`}
              >
                {LENGTH_LABELS[len]}
              </button>
            ))}
          </div>
        </div>

        {/* Premise Input */}
        <div className="w-full space-y-3">
          <p className="text-center text-xs text-zinc-400 tracking-widest">
            OR ENTER A PREMISE
          </p>
          <input
            type="text"
            value={premise}
            onChange={(e) => setPremise(e.target.value)}
            placeholder="A lone detective in a city that never sleeps..."
            className="w-full text-center text-sm text-zinc-600 placeholder-zinc-300 bg-transparent border-b border-zinc-200 pb-2 focus:outline-none focus:border-zinc-600 transition-colors"
          />
        </div>

        {/* Start Button */}
        <button
          onClick={handleStart}
          disabled={!genre || loading}
          className="w-full py-3.5 text-sm tracking-widest border border-zinc-300
            text-zinc-600 hover:text-zinc-900 hover:border-zinc-800
            disabled:opacity-30 disabled:cursor-not-allowed
            transition-all duration-200 rounded-none"
        >
          {loading ? 'INITIALIZING...' : genre ? 'BEGIN' : 'SELECT A GENRE'}
        </button>

        {/* Bottom Links */}
        <div className="flex items-center gap-8 text-xs text-zinc-400">
          <button
            onClick={() => {
              refreshSavedGames()
              router.push('/games')
            }}
            className="hover:text-zinc-800 transition-colors tracking-wider"
          >
            {savedGames.length > 0 ? `HISTORY (${savedGames.length})` : 'HISTORY'}
          </button>
          <SettingsDialog />
        </div>
      </div>
    </div>
  )
}
