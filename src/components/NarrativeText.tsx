'use client'

import { useState, useEffect, useRef, useCallback, memo } from 'react'

interface NarrativeTextProps {
  text: string
  onComplete: () => void
  speed?: number
  textColor?: string
}

function NarrativeTextInner({ text, onComplete, speed = 30, textColor = '#27272a' }: NarrativeTextProps) {
  const [displayed, setDisplayed] = useState('')
  const [isTyping, setIsTyping] = useState(true)
  const indexRef = useRef(0)
  const calledRef = useRef(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const finish = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current)
    setDisplayed(text)
    setIsTyping(false)
    if (!calledRef.current) {
      calledRef.current = true
      setTimeout(() => onComplete(), 100)
    }
  }, [text, onComplete])

  useEffect(() => {
    indexRef.current = 0
    calledRef.current = false
    setDisplayed('')
    setIsTyping(true)

    intervalRef.current = setInterval(() => {
      if (indexRef.current < text.length) {
        setDisplayed(text.slice(0, indexRef.current + 1))
        indexRef.current++
      } else {
        finish()
      }
    }, speed)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [text, speed, finish])

  return (
    <div
      onClick={finish}
      className="leading-relaxed text-sm tracking-wide cursor-pointer"
      style={{ color: textColor }}
    >
      {displayed}
      {isTyping && (
        <span className="inline-block w-[1px] h-[1em] align-middle ml-0.5 animate-blink" style={{ backgroundColor: textColor }} />
      )}
    </div>
  )
}

export default memo(NarrativeTextInner)
