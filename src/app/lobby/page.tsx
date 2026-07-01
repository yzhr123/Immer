'use client'

import { useState } from 'react'
import LobbyPageOld from './LobbyOld'
import LobbyPageNew from './LobbyNew'
import { useStore } from '@/lib/store'

type LobbyTab = 'old' | 'new'

export default function LobbyPage() {
  const [tab, setTab] = useState<LobbyTab>('new')
  const { language } = useStore()

  return (
    <div className="flex flex-col flex-1">
      {/* Tab Switcher */}
      <div
        className="fixed top-0 left-0 right-0 z-50 flex justify-start"
        style={{
          background: tab === 'new'
            ? 'linear-gradient(180deg, #faf8f5 0%, rgba(250,248,245,0) 100%)'
            : 'linear-gradient(180deg, #ffffff 0%, rgba(255,255,255,0) 100%)',
          paddingTop: 'env(safe-area-inset-top, 0px)',
        }}
      >
        <div className="flex items-center gap-1 px-4 py-3">
          <button
            onClick={() => setTab('old')}
            className={`px-4 py-2 text-[11px] tracking-[0.2em] transition-all duration-300 rounded-full ${
              tab === 'old'
                ? 'bg-zinc-800/10 text-zinc-800'
                : 'text-zinc-300 hover:text-zinc-500'
            }`}
          >
            {language === 'zh' ? '旧版本' : 'Original'}
          </button>
          <button
            onClick={() => setTab('new')}
            className={`px-4 py-2 text-[11px] tracking-[0.2em] transition-all duration-300 rounded-full ${
              tab === 'new'
                ? 'bg-zinc-800/10 text-zinc-800'
                : 'text-zinc-300 hover:text-zinc-500'
            }`}
          >
            {language === 'zh' ? '新版本' : 'Premium'}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col">
        {tab === 'old' ? <LobbyPageOld /> : <LobbyPageNew />}
      </div>
    </div>
  )
}
