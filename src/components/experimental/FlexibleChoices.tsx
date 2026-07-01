'use client'

import { useState } from 'react'
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
  const [customInput, setCustomInput] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)

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

  const hasCustom = choices.some((c) => c.allowCustom)

  function handleSelect(choiceId: string) {
    setSelectedId(choiceId)
    if (!hasCustom) {
      onChoice(choiceId)
    }
  }

  function handleConfirm() {
    if (!selectedId) return
    const choice = choices.find((c) => c.id === selectedId)
    if (choice?.allowCustom) {
      onChoice(selectedId, customInput)
    } else {
      onChoice(selectedId)
    }
  }

  return (
    <div className="flex flex-col gap-3 px-1 mt-2">
      {choices.map((choice, i) => {
        const isSelected = selectedId === choice.id
        return (
          <div
            key={choice.id}
            className="animate-fade-in-up"
            style={{ animationDelay: `${i * 120}ms`, opacity: 0 }}
          >
            <button
              onClick={() => handleSelect(choice.id)}
              disabled={disabled}
              className={`w-full text-left py-3 px-4 text-sm tracking-wide transition-all duration-200 ${
                isSelected ? 'opacity-100' : 'opacity-70 hover:opacity-100'
              }`}
              style={{
                color: isSelected ? themeAccent : themeText,
                border: `1px solid ${isSelected ? themeAccent : themeBorder}`,
                backgroundColor: isSelected ? `${themeAccent}08` : 'transparent',
              }}
            >
              {choice.text}
            </button>
          </div>
        )
      })}

      {/* 自定义输入区 */}
      {selectedId && hasCustom && (
        <div className="flex flex-col gap-2 mt-2 animate-fade-in-up">
          <input
            type="text"
            value={customInput}
            onChange={(e) => setCustomInput(e.target.value)}
            placeholder="输入你的行动..."
            className="w-full px-4 py-2.5 text-sm bg-transparent border-b focus:outline-none transition-colors"
            style={{
              color: themeText,
              borderColor: themeBorder,
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && customInput.trim()) handleConfirm()
            }}
            autoFocus
          />
          <div className="flex justify-end">
            <button
              onClick={handleConfirm}
              disabled={!customInput.trim()}
              className="px-5 py-2 text-xs tracking-wider transition-all duration-200 disabled:opacity-30"
              style={{
                color: themeAccent,
                border: `1px solid ${themeAccent}`,
              }}
            >
              确定
            </button>
          </div>
        </div>
      )}

      {/* 已选但不需要自定义时，显示确认 */}
      {selectedId && !hasCustom && (
        <div className="flex justify-center mt-1">
          <button
            onClick={handleConfirm}
            className="px-5 py-2 text-xs tracking-wider transition-all duration-200"
            style={{
              color: themeAccent,
              border: `1px solid ${themeAccent}`,
            }}
          >
            确定
          </button>
        </div>
      )}
    </div>
  )
}
