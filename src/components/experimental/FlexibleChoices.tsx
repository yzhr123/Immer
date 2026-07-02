'use client'

import type { BetaChoice } from '@/lib/ai/experimental/types'

interface Props {
  choices: BetaChoice[]
  onChoice: (choiceId: string, customInput?: string) => void
  disabled: boolean
  themeBorder: string
  themeText: string
  themeTextSecondary: string
  themeAccent: string
}

export default function FlexibleChoices({
  choices,
  onChoice,
  disabled,
  themeBorder,
  themeText,
  themeTextSecondary,
  themeAccent,
}: Props) {
  // 纯过渡类型 — 只有一个 transition 选项，自动继续
  if (choices.length === 1 && choices[0].type === 'transition') {
    return (
      <div className="flex flex-col items-center gap-4 px-1 mt-6">
        <button
          onClick={() => onChoice(choices[0].id)}
          disabled={disabled}
          className="px-8 py-3 text-sm tracking-widest transition-all duration-300 hover:opacity-70 disabled:opacity-30"
          style={{
            color: themeTextSecondary,
            border: `1px solid ${themeBorder}`,
          }}
        >
          {choices[0].text}
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3 px-1 mt-2">
      {choices.map((choice, i) => (
        <div
          key={choice.id}
          className="animate-fade-in-up"
          style={{ animationDelay: `${i * 120}ms`, opacity: 0 }}
        >
          <button
            onClick={() => onChoice(choice.id)}
            disabled={disabled}
            className="w-full text-left py-3 px-4 text-sm tracking-wide transition-all duration-200 opacity-70 hover:opacity-100"
            style={{
              color: themeText,
              border: `1px solid ${themeBorder}`,
            }}
          >
            {choice.text}
          </button>
        </div>
      ))}
    </div>
  )
}
