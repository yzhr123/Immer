'use client'

import { useState, useEffect } from 'react'
import type { StoryEntry } from '@/lib/storyclub/store'
import { GENRE_NAMES, type Genre } from '@/lib/ai/types'
import { getUserId } from '@/lib/credit/client'
import { t, type Lang } from '@/lib/i18n'

const GENRES: Genre[] = ['fantasy', 'sci-fi', 'mystery', 'historical', 'horror', 'martial-arts']

export default function StoryClubPanel({
  open,
  onClose,
  onSelect,
  language,
}: {
  open: boolean
  onClose: () => void
  onSelect: (premise: string, genre: string) => void
  language: Lang
}) {
  const [stories, setStories] = useState<StoryEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const [tab, setTab] = useState<'browse' | 'share'>('browse')

  // Story detail view
  const [viewingStory, setViewingStory] = useState<StoryEntry | null>(null)

  // Submit form state
  const [formGenre, setFormGenre] = useState<string>('mystery')
  const [formTitle, setFormTitle] = useState('')
  const [formContent, setFormContent] = useState('')
  const [formAuthor, setFormAuthor] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitSuccess, setSubmitSuccess] = useState(false)
  const [submitError, setSubmitError] = useState(false)

  useEffect(() => {
    if (!open) return
    setLoading(true)
    setLoadError(false)
    fetch('/api/storyclub')
      .then((res) => res.json())
      .then((data) => {
        setStories(data.stories || [])
        setLoading(false)
      })
      .catch(() => {
        setLoadError(true)
        setLoading(false)
      })
    // Reset state on open
    setViewingStory(null)
    setTab('browse')
    setSubmitSuccess(false)
    setSubmitError(false)
    setFormGenre('mystery')
    setFormTitle('')
    setFormContent('')
    setFormAuthor('')
  }, [open])

  async function handleSubmit() {
    if (!formTitle.trim() || !formContent.trim() || !formAuthor.trim()) return
    setSubmitting(true)
    setSubmitError(false)
    try {
      const res = await fetch('/api/storyclub', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          genre: formGenre,
          title: formTitle.trim(),
          content: formContent.trim(),
          author: formAuthor.trim(),
          userId: getUserId(),
        }),
      })
      if (!res.ok) throw new Error('Submit failed')
      setFormTitle('')
      setFormContent('')
      setFormAuthor('')
      fetch('/api/storyclub')
        .then((r) => r.json())
        .then((data) => {
          setStories(Array.isArray(data.stories) ? data.stories : [])
        })
      setSubmitSuccess(true)
    } catch {
      setSubmitError(true)
    } finally {
      setSubmitting(false)
    }
  }

  function handleImport(story: StoryEntry) {
    onSelect(story.content, story.genre)
    onClose()
  }

  async function handleDelete(storyId: string) {
    const userId = getUserId()
    if (!userId) return
    const res = await fetch(`/api/storyclub?id=${encodeURIComponent(storyId)}&userId=${encodeURIComponent(userId)}`, {
      method: 'DELETE',
    })
    if (res.ok) {
      setStories((prev) => prev.filter((s) => s.id !== storyId))
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/20 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative w-full max-w-lg bg-white border-l border-zinc-100 shadow-xl flex flex-col animate-slide-in">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100">
          <h2 className="text-sm tracking-widest text-zinc-800">
            {t('storyclub.title', language)}
          </h2>
          <button
            onClick={onClose}
            className="text-xs text-zinc-400 hover:text-zinc-600 transition-colors tracking-wider"
          >
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-zinc-100">
          <button
            onClick={() => { setSubmitSuccess(false); setTab('browse') }}
            className={`flex-1 py-3 text-xs tracking-wider transition-colors ${
              tab === 'browse'
                ? 'text-zinc-800 border-b border-zinc-800'
                : 'text-zinc-400 hover:text-zinc-600'
            }`}
          >
            {t('storyclub.browse', language)}
          </button>
          <button
            onClick={() => setTab('share')}
            className={`flex-1 py-3 text-xs tracking-wider transition-colors ${
              tab === 'share'
                ? 'text-zinc-800 border-b border-zinc-800'
                : 'text-zinc-400 hover:text-zinc-600'
            }`}
          >
            {t('storyclub.share', language)}
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {tab === 'browse' && (
            <div className="p-6">
              {viewingStory ? (
                /* Story detail view */
                <div className="flex flex-col min-h-0">
                  {/* Back button */}
                  <button
                    onClick={() => setViewingStory(null)}
                    className="text-xs text-zinc-400 hover:text-zinc-600 transition-colors tracking-wider mb-5 self-start"
                  >
                    ← {t('storyclub.backToList', language)}
                  </button>

                  {/* Genre tag */}
                  <span className="inline-block self-start px-2 py-0.5 text-[10px] tracking-wider rounded-sm bg-zinc-100 text-zinc-500 mb-3">
                    {GENRE_NAMES[viewingStory.genre as Genre] || viewingStory.genre}
                  </span>

                  {/* Title */}
                  <h3 className="text-base text-zinc-800 font-medium mb-1">
                    {viewingStory.title}
                  </h3>

                  {/* Author */}
                  <span className="text-[10px] text-zinc-400 tracking-wider mb-5">
                    {t('storyclub.by', language, { author: viewingStory.author })}
                  </span>

                  {/* Full content */}
                  <div className="flex-1 overflow-y-auto mb-6">
                    <p className="text-sm text-zinc-600 leading-relaxed whitespace-pre-wrap">
                      {viewingStory.content}
                    </p>
                  </div>

                  {/* Use button */}
                  <button
                    onClick={() => handleImport(viewingStory)}
                    className="w-full py-2.5 text-xs tracking-widest border border-zinc-800 text-zinc-800 hover:bg-zinc-800 hover:text-white transition-all rounded-none"
                  >
                    {t('storyclub.useBtn', language)}
                  </button>
                </div>
              ) : (
                <>
                  {loading && (
                    <p className="text-xs text-zinc-400 text-center py-12 tracking-wider">
                      Loading...
                    </p>
                  )}

                  {loadError && (
                    <p className="text-xs text-red-400 text-center py-12 tracking-wider">
                      {t('storyclub.loadFailed', language)}
                    </p>
                  )}

                  {!loading && !loadError && stories.length === 0 && (
                    <p className="text-xs text-zinc-400 text-center py-12 tracking-wider">
                      {t('storyclub.empty', language)}
                    </p>
                  )}

                  {!loading && !loadError && stories.length > 0 && (
                    <div className="space-y-4">
                      {stories.map((story) => {
                        const isOwn = story.userId && story.userId === getUserId()
                        return (
                          <div
                            key={story.id}
                            className="group border border-zinc-100 rounded-md p-4 hover:border-zinc-300 transition-colors cursor-pointer"
                            onClick={() => setViewingStory(story)}
                          >
                            {/* Genre tag */}
                            <span className="inline-block px-2 py-0.5 text-[10px] tracking-wider rounded-sm bg-zinc-100 text-zinc-500 mb-2">
                              {GENRE_NAMES[story.genre as Genre] || story.genre}
                            </span>

                            {/* Title */}
                            <h3 className="text-sm text-zinc-800 font-medium mb-1">
                              {story.title}
                            </h3>

                            {/* Content preview */}
                            <p className="text-xs text-zinc-500 leading-relaxed line-clamp-3 mb-2">
                              {story.content}
                            </p>

                            {/* Footer */}
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] text-zinc-400 tracking-wider">
                                {t('storyclub.by', language, { author: story.author })}
                              </span>
                              <div className="flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleImport(story)
                                  }}
                                  className="text-[10px] text-zinc-500 hover:text-zinc-800 transition-colors tracking-wider"
                                >
                                  {t('storyclub.importBtn', language)} →
                                </button>
                                {isOwn && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      handleDelete(story.id)
                                    }}
                                    className="text-[10px] text-red-300 hover:text-red-500 transition-colors tracking-wider"
                                  >
                                    {t('storyclub.deleteBtn', language)}
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {tab === 'share' && (
            <div className="p-6">
              <p className="text-xs text-zinc-500 tracking-wider mb-6">
                {t('storyclub.submitTitle', language)}
              </p>

              {submitSuccess && (
                <p className="text-xs text-emerald-600 tracking-wider text-center py-4 mb-4 border border-emerald-100 bg-emerald-50 rounded-md">
                  {t('storyclub.submitSuccess', language)}
                </p>
              )}

              {submitError && (
                <p className="text-xs text-red-500 tracking-wider text-center py-4 mb-4 border border-red-100 bg-red-50 rounded-md">
                  {t('storyclub.submitFail', language)}
                </p>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-xs text-zinc-400 tracking-wider mb-2">
                    {t('storyclub.formGenre', language)}
                  </label>
                  <input
                    type="text"
                    value={formGenre}
                    onChange={(e) => setFormGenre(e.target.value)}
                    placeholder={t('storyclub.formGenre', language)}
                    className="w-full px-3 py-2 text-xs text-zinc-700 border border-zinc-200 rounded-sm bg-transparent focus:outline-none focus:border-zinc-500 transition-colors placeholder-zinc-300"
                  />
                  <div className="flex flex-wrap gap-2 mt-2">
                    {GENRES.map((g) => (
                      <button
                        key={g}
                        type="button"
                        onClick={() => setFormGenre(g)}
                        className={`px-2 py-0.5 text-[10px] tracking-wider rounded-sm transition-colors ${
                          formGenre === g
                            ? 'bg-zinc-800 text-white'
                            : 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200'
                        }`}
                      >
                        {GENRE_NAMES[g]}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Title */}
                <div>
                  <label className="block text-xs text-zinc-400 tracking-wider mb-2">
                    {t('storyclub.formTitle', language)}
                  </label>
                  <input
                    type="text"
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    placeholder={t('storyclub.formTitle', language)}
                    className="w-full px-3 py-2 text-xs text-zinc-700 border border-zinc-200 rounded-sm bg-transparent focus:outline-none focus:border-zinc-500 transition-colors placeholder-zinc-300"
                  />
                </div>

                {/* Content */}
                <div>
                  <label className="block text-xs text-zinc-400 tracking-wider mb-2">
                    {t('storyclub.formContent', language)}
                  </label>
                  <textarea
                    value={formContent}
                    onChange={(e) => setFormContent(e.target.value)}
                    placeholder={t('storyclub.formContent', language)}
                    rows={5}
                    className="w-full px-3 py-2 text-xs text-zinc-700 border border-zinc-200 rounded-sm bg-transparent focus:outline-none focus:border-zinc-500 transition-colors placeholder-zinc-300 resize-none"
                  />
                </div>

                {/* Author */}
                <div>
                  <label className="block text-xs text-zinc-400 tracking-wider mb-2">
                    {t('storyclub.formAuthor', language)}
                  </label>
                  <input
                    type="text"
                    value={formAuthor}
                    onChange={(e) => setFormAuthor(e.target.value)}
                    placeholder={t('storyclub.formAuthor', language)}
                    className="w-full px-3 py-2 text-xs text-zinc-700 border border-zinc-200 rounded-sm bg-transparent focus:outline-none focus:border-zinc-500 transition-colors placeholder-zinc-300"
                  />
                </div>

                {/* Submit button */}
                <button
                  onClick={handleSubmit}
                  disabled={submitting || !formTitle.trim() || !formContent.trim() || !formAuthor.trim()}
                  className="w-full py-2.5 text-xs tracking-widest border border-zinc-300 text-zinc-600 hover:text-zinc-900 hover:border-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed transition-all rounded-none"
                >
                  {submitting ? '...' : t('storyclub.submitBtn', language)}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Slide-in animation */}
      <style jsx>{`
        .animate-slide-in {
          animation: slideIn 0.25s cubic-bezier(0.16, 1, 0.3, 1);
        }
        @keyframes slideIn {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
      `}</style>
    </div>
  )
}
