'use client'

import { useState } from 'react'

interface Props {
  onSubmit: (text: string) => void
  disabled: boolean
  themeBorder: string
  themeText: string
  themeTextSecondary: string
}

export default function FreeActionInput({
  onSubmit,
  disabled,
  themeBorder,
  themeText,
  themeTextSecondary,
}: Props) {
  const [text, setText] = useState('')

  function handleSubmit() {
    const trimmed = text.trim()
    if (!trimmed) return
    onSubmit(trimmed)
    setText('')
  }

  return (
    <div className="flex flex-col gap-2 px-1 mt-6 animate-fade-in-up">
      <div className="flex gap-2 items-stretch">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="输入你的行动..."
          className="flex-1 px-4 py-2.5 text-sm bg-transparent border-b focus:outline-none transition-colors"
          style={{
            color: themeText,
            borderColor: themeBorder,
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSubmit()
          }}
          disabled={disabled}
          autoFocus
        />
        <button
          onClick={handleSubmit}
          disabled={disabled || !text.trim()}
          className="px-5 py-2 text-xs tracking-wider transition-all duration-200 whitespace-nowrap disabled:opacity-30 hover:opacity-70"
          style={{
            color: themeTextSecondary,
            border: `1px solid ${themeBorder}`,
          }}
        >
          行动
        </button>
      </div>
    </div>
  )
}
