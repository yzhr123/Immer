'use client'

import { useStore } from '@/lib/store'
import type { ImageMode } from '@/lib/ai/types'
import { t } from '@/lib/i18n'

export default function ImageModeSelector() {
  const { imageMode, setImageMode, language } = useStore()

  return (
    <div suppressHydrationWarning className="w-full border-t border-zinc-100 pt-4">
      <p className="text-center text-xs text-zinc-400 tracking-widest mb-3">
        {t('settings.imageMode', language)}
      </p>
      <div className="flex justify-center gap-4">
        {(['full', 'lazy', 'none'] as ImageMode[]).map((mode) => (
          <label
            key={mode}
            className={`flex items-center gap-2 px-3 py-2 rounded-md cursor-pointer text-xs tracking-wider transition-colors ${
              imageMode === mode
                ? 'bg-zinc-800 text-white'
                : 'bg-zinc-50 text-zinc-500 hover:text-zinc-700'
            }`}
          >
            <input
              type="radio"
              name="imageMode"
              value={mode}
              defaultChecked={imageMode === mode}
              onChange={() => setImageMode(mode)}
              className="sr-only"
            />
            <span className="flex flex-col items-center gap-0.5">
              <span>{mode === 'full' ? t('settings.full', language) : mode === 'lazy' ? t('settings.lazy', language) : t('settings.none', language)}</span>
              <span className={`text-[10px] ${imageMode === mode ? 'text-white/60' : 'text-zinc-400'}`}>
                {mode === 'full' ? t('settings.priceFull', language) : mode === 'lazy' ? t('settings.priceLazy', language) : t('settings.priceNone', language)}
              </span>
            </span>
          </label>
        ))}
      </div>
    </div>
  )
}
