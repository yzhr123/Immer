'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useStore } from '@/lib/store'
import { SavedGameMeta } from '@/lib/ai/types'

export default function GamesPage() {
  const router = useRouter()
  const { savedGames, refreshSavedGames, loadGame, deleteGame } = useStore()
  const [list, setList] = useState<SavedGameMeta[]>([])

  useEffect(() => {
    refreshSavedGames()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    setList(savedGames)
  }, [savedGames])

  function handleResume(meta: SavedGameMeta) {
    const game = loadGame(meta.sessionId)
    if (game) {
      useStore.setState({ game })
      router.push(`/game/${meta.sessionId}`)
    }
  }

  function handleDelete(sessionId: string) {
    deleteGame(sessionId)
  }

  return (
    <div className="flex flex-col flex-1 items-center px-6 py-12">
      <div className="w-full max-w-lg flex flex-col gap-8">

        {/* Header */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => router.push('/')}
            className="text-xs text-zinc-400 hover:text-zinc-800 transition-colors tracking-wider"
          >
            BACK
          </button>
          <h1 className="text-sm font-medium text-zinc-800 tracking-wider">
            HISTORY
          </h1>
          <span className="text-xs text-zinc-300">{list.length} SAVES</span>
        </div>

        {/* List */}
        {list.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <p className="text-sm text-zinc-400 tracking-wider">NO SAVED GAMES</p>
            <button
              onClick={() => router.push('/')}
              className="text-xs text-zinc-300 hover:text-zinc-600 border-b border-zinc-200 pb-0.5 transition-colors"
            >
              START A NEW STORY
            </button>
          </div>
        )}

        {list.map((meta) => (
          <div
            key={meta.sessionId}
            className="group flex items-center justify-between py-4 border-b border-zinc-100 last:border-0"
          >
            <div className="flex flex-col gap-1 flex-1 min-w-0">
              <div className="flex items-center gap-3">
                <span className="text-sm text-zinc-800 font-medium truncate">
                  {meta.title}
                </span>
                <span className="text-xs text-zinc-400 uppercase tracking-wider shrink-0">
                  {meta.genre}
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs text-zinc-400">
                <span>Chapter {meta.chapterCount}</span>
                <span>|</span>
                <span className="truncate">{meta.preview}</span>
              </div>
              <span className="text-xs text-zinc-300">
                {new Date(meta.lastPlayedAt).toLocaleString('zh-CN')}
              </span>
            </div>

            <div className="flex items-center gap-2 ml-4 shrink-0">
              <button
                onClick={() => handleResume(meta)}
                className="px-3 py-1.5 text-xs text-zinc-600 border border-zinc-200
                  hover:border-zinc-800 hover:text-zinc-900
                  transition-all duration-200 rounded-sm"
              >
                RESUME
              </button>
              <button
                onClick={() => handleDelete(meta.sessionId)}
                className="px-3 py-1.5 text-xs text-zinc-300 border border-transparent
                  hover:text-red-400 transition-colors"
              >
                DELETE
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
