'use client'

import { useState } from 'react'
import { Clue, CLUE_TYPE_NAMES } from '@/lib/ai/types'

interface ClueSidebarProps {
  clues: Clue[]
  themeBorder: string
  themeBgCard: string
  themeText: string
  themeTextSecondary: string
  themeTextMuted: string
}

const CLUE_ICONS: Record<string, string> = {
  letter: '▦',
  photo: '🖼',
  note: '✎',
  diary: '🗎',
  document: '▤',
  recording: '♪',
  object: '⌕',
}

export default function ClueSidebar({
  clues,
  themeBorder,
  themeBgCard,
  themeText,
  themeTextSecondary,
  themeTextMuted,
}: ClueSidebarProps) {
  const [open, setOpen] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  if (clues.length === 0) return null

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed right-0 top-1/2 -translate-y-1/2 z-40 px-2 py-10 text-xs tracking-wider transition-all duration-300 hover:px-3"
        style={{
          backgroundColor: themeBgCard,
          borderTop: `1px solid ${themeBorder}`,
          borderBottom: `1px solid ${themeBorder}`,
          borderLeft: `1px solid ${themeBorder}`,
          borderRight: 'none',
          color: themeTextSecondary,
          borderRadius: '4px 0 0 4px',
          writingMode: 'vertical-rl',
        }}
        title="Open clues"
      >
        CLUES ({clues.length})
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex justify-end"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-80 h-full overflow-y-auto shadow-xl transition-transform duration-300"
            style={{
              backgroundColor: themeBgCard,
              borderLeft: `1px solid ${themeBorder}`,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="sticky top-0 z-10 flex items-center justify-between px-5 py-4"
              style={{ backgroundColor: themeBgCard, borderBottom: `1px solid ${themeBorder}` }}
            >
              <span className="text-xs tracking-widest" style={{ color: themeTextMuted }}>
                CLUES ({clues.length})
              </span>
              <button
                onClick={() => setOpen(false)}
                className="text-xs transition-colors"
                style={{ color: themeTextMuted }}
              >
                CLOSE
              </button>
            </div>

            <div className="px-4 py-3 space-y-2">
              {clues.map((clue) => {
                const isExpanded = expandedId === clue.id
                return (
                  <div key={clue.id}>
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : clue.id)}
                      className="w-full text-left px-3 py-3 rounded-sm transition-colors duration-200"
                      style={{
                        border: `1px solid ${themeBorder}`,
                      }}
                    >
                      <div className="flex items-start gap-2.5">
                        <span className="text-sm mt-0.5">{CLUE_ICONS[clue.type] || '📎'}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-xs tracking-wider" style={{ color: themeTextMuted }}>
                              {CLUE_TYPE_NAMES[clue.type] || clue.type}
                            </span>
                          </div>
                          <div className="text-sm font-medium truncate" style={{ color: themeText }}>
                            {clue.title}
                          </div>
                          <div className="text-xs mt-0.5 line-clamp-2" style={{ color: themeTextSecondary }}>
                            {clue.summary}
                          </div>
                        </div>
                      </div>
                    </button>

                    {isExpanded && (
                      <div
                        className="px-3 py-3 mx-3 mb-2 rounded-sm text-sm leading-relaxed whitespace-pre-wrap"
                        style={{
                          backgroundColor: themeBorder + '40',
                          color: themeText,
                        }}
                      >
                        {clue.content}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
