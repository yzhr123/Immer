'use client'

import { useEffect, useRef } from 'react'
import { Mood } from '@/lib/ai/types'

const BGM_MAP: Record<Mood, string> = {
  dark: '/bgm/dark.mp3',
  mysterious: '/bgm/mysterious.mp3',
  tense: '/bgm/tense.mp3',
  peaceful: '/bgm/peaceful.mp3',
  epic: '/bgm/epic.mp3',
  sad: '/bgm/sad.mp3',
  joyful: '/bgm/joyful.mp3',
  scary: '/bgm/scary.mp3',
  calm: '/bgm/calm.mp3',
}

const FADE_DURATION = 1200
const VOLUME = 0.25

export default function BGMPlayer({ mood, enabled = true }: { mood: Mood; enabled?: boolean }) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const fadeTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const currentMoodRef = useRef<Mood | null>(null)
  const genRef = useRef(0)
  const retryTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  function fadeIn(audio: HTMLAudioElement) {
    audio.volume = 0
    const steps = 20
    const interval = FADE_DURATION / steps
    let step = 0
    if (fadeTimerRef.current) clearInterval(fadeTimerRef.current)
    fadeTimerRef.current = setInterval(() => {
      step++
      const progress = step / steps
      audio.volume = Math.min(VOLUME, VOLUME * progress)
      if (step >= steps) {
        if (fadeTimerRef.current) clearInterval(fadeTimerRef.current)
      }
    }, interval)
  }

  function fadeOutAndStop() {
    const old = audioRef.current
    if (!old) return
    const oldVolume = old.volume
    const steps = 20
    const interval = FADE_DURATION / steps
    let step = 0
    const timer = setInterval(() => {
      step++
      const progress = step / steps
      old.volume = Math.max(0, oldVolume * (1 - progress))
      if (step >= steps) {
        clearInterval(timer)
        old.pause()
        old.src = ''
      }
    }, interval)
  }

  function switchAudio(m: Mood) {
    genRef.current++
    const gen = genRef.current

    const src = BGM_MAP[m]
    if (!src) return

    if (fadeTimerRef.current) clearInterval(fadeTimerRef.current)
    if (retryTimerRef.current) { clearInterval(retryTimerRef.current); retryTimerRef.current = null }

    const newAudio = new Audio()
    newAudio.loop = true
    newAudio.volume = 0
    newAudio.preload = 'auto'
    newAudio.src = src
    newAudio.load()

    function isStale() { return gen !== genRef.current }

    function startPlaying() {
      if (isStale()) return
      if (audioRef.current) fadeOutAndStop()
      fadeIn(newAudio)
      audioRef.current = newAudio
      currentMoodRef.current = m
    }

    // 立即尝试播放，不等 canplaythrough
    newAudio.play().then(() => {
      if (isStale()) { newAudio.pause(); return }
      startPlaying()
    }).catch(() => {
      if (isStale()) return
      // 被拦截：保存引用，500ms 轮询重试
      audioRef.current = newAudio
      currentMoodRef.current = m
      retryTimerRef.current = setInterval(() => {
        if (isStale()) { clearInterval(retryTimerRef.current!); retryTimerRef.current = null; return }
        newAudio.play().then(() => {
          if (isStale()) { newAudio.pause(); clearInterval(retryTimerRef.current!); retryTimerRef.current = null; return }
          clearInterval(retryTimerRef.current!)
          retryTimerRef.current = null
          startPlaying()
        }).catch(() => {
          // 仍被拦截，继续等
        })
      }, 500)
    })
  }

  // mood 变化
  useEffect(() => {
    if (!enabled) {
      stopAll()
      return
    }
    if (currentMoodRef.current === mood) return
    switchAudio(mood)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mood, enabled])

  // 卸载时清理
  useEffect(() => {
    return () => stopAll()
  }, [])

  function stopAll() {
    genRef.current++
    if (retryTimerRef.current) { clearInterval(retryTimerRef.current); retryTimerRef.current = null }
    if (fadeTimerRef.current) clearInterval(fadeTimerRef.current)
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.src = ''
      audioRef.current = null
    }
    currentMoodRef.current = null
  }

  return null
}
