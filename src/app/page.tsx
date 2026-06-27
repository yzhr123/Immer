'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import GenreSelector from '@/components/GenreSelector'
import SettingsDialog from '@/components/SettingsDialog'
import ImageModeSelector from '@/components/ImageModeSelector'
import { useStore } from '@/lib/store'
import { generateId } from '@/lib/utils'
import { GENRE_TITLES, StoryLength, LENGTH_LABELS, ImageMode } from '@/lib/ai/types'
import { fetchPendingCount, useCredits, generateOutTradeNo, submitManualPayment } from '@/lib/credit/client'
import { CREDIT_PRICES } from '@/lib/credit/store'
import { t, Lang } from '@/lib/i18n'

export default function Lobby() {
  const router = useRouter()
  const { llmSettings, initGame, savedGames, refreshSavedGames, language, setLanguage, imageMode, setImageMode } = useStore()
  const [genre, setGenre] = useState<string | null>(null)
  const [premise, setPremise] = useState('')
  const [storyLength, setStoryLength] = useState<StoryLength>('medium')
  const [loading, setLoading] = useState(false)

  const [pendingCount, setPendingCount] = useState(0)
  const { userId, balance, refresh: refreshBalance } = useCredits()
  const [paymentPhase, setPaymentPhase] = useState<
    { phase: 'idle' } |
    { phase: 'new'; outTradeNo: string; amount: number } |
    { phase: 'submitting' } |
    { phase: 'submitted' } |
    { phase: 'error'; message: string }
  >({ phase: 'idle' })
  const [customAmountMode, setCustomAmountMode] = useState(false)
  const [customAmount, setCustomAmount] = useState('')

  useEffect(() => {
    fetchPendingCount().then(setPendingCount)
    const interval = setInterval(() => fetchPendingCount().then(setPendingCount), 15_000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === 'visible') refreshBalance() }
    document.addEventListener('visibilitychange', onVisible)
    const balanceInterval = setInterval(refreshBalance, 30_000)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      clearInterval(balanceInterval)
    }
  }, [refreshBalance])

  function handleStart() {
    if (!genre) return
    if (!llmSettings.apiUrl || !llmSettings.apiKey) {
      alert('请在 Settings 中配置 LLM API')
      return
    }

    if (imageMode === 'full' || imageMode === 'lazy') {
      const required = CREDIT_PRICES[imageMode]
      if (balance < required) {
        const modeLabel = imageMode === 'full'
          ? (language === 'zh' ? '完整' : 'Full')
          : (language === 'zh' ? '精简' : 'Lazy')
        alert(t('lobby.insufficientCredits', language, {
          balance,
          mode: modeLabel,
          price: required,
        }))
        return
      }
    }

    setLoading(true)
    const sessionId = generateId()

    initGame({
      sessionId,
      genre,
      title: GENRE_TITLES[genre] || genre,
      premise,
      storyLength,
    })

    router.push(`/game/${sessionId}`)
  }

  function handleStartRecharge(amount: number) {
    if (!userId) return
    const outTradeNo = generateOutTradeNo()
    setPaymentPhase({ phase: 'new', outTradeNo, amount })
  }

  async function handleConfirmPayment() {
    const state = paymentPhase
    if (state.phase !== 'new') return
    if (!userId) return

    const { outTradeNo, amount } = state
    setPaymentPhase({ phase: 'submitting' })

    try {
      await submitManualPayment(userId, amount, outTradeNo)
      setPaymentPhase({ phase: 'submitted' })
      setTimeout(refreshBalance, 2000)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '提交失败'
      setPaymentPhase({ phase: 'error', message: msg })
    }
  }

  function handleCustomRecharge() {
    const amount = parseInt(customAmount)
    if (!amount || amount <= 0) return
    handleStartRecharge(amount)
    setCustomAmount('')
    setCustomAmountMode(false)
  }

  return (
    <div className="flex flex-col flex-1 items-center justify-center px-6">
      <div className="w-full max-w-lg flex flex-col items-center py-24 gap-16">

        {/* Header */}
        <div className="text-center space-y-3">
          <h1 className="text-5xl font-light tracking-[0.15em] text-zinc-800">
            Immer
          </h1>
          <p className="text-sm text-zinc-400 tracking-wider">
            {t('lobby.subtitle', language)}
          </p>
        </div>

        <ImageModeSelector />

        {/* Genre Selection */}
        <div className="w-full space-y-5">
          <p className="text-center text-xs text-zinc-400 tracking-widest">
            {t('lobby.selectGenre', language)}
          </p>
          <GenreSelector selected={genre} onSelect={setGenre} />
        </div>

        {/* Story Length */}
        <div className="w-full space-y-3">
          <p className="text-center text-xs text-zinc-400 tracking-widest">
            {t('lobby.storyLength', language)}
          </p>
          <div className="flex justify-center gap-3">
            {(['short', 'medium', 'long'] as StoryLength[]).map((len) => (
              <button
                key={len}
                onClick={() => setStoryLength(len)}
                className={`px-5 py-2 text-xs tracking-wider transition-all duration-200 rounded-sm ${
                  storyLength === len
                    ? 'bg-zinc-800 text-white'
                    : 'text-zinc-500 border border-zinc-200 hover:border-zinc-400'
                }`}
              >
                {LENGTH_LABELS[len]}
              </button>
            ))}
          </div>
        </div>

        {/* Premise Input */}
        <div className="w-full space-y-3">
          <p className="text-center text-xs text-zinc-400 tracking-widest">
            {t('lobby.orPremise', language)}
          </p>
          <input
            type="text"
            value={premise}
            onChange={(e) => setPremise(e.target.value)}
            placeholder={t('lobby.premisePlaceholder', language)}
            className="w-full text-center text-sm text-zinc-600 placeholder-zinc-300 bg-transparent border-b border-zinc-200 pb-2 focus:outline-none focus:border-zinc-600 transition-colors"
          />
        </div>

        {/* Start Button */}
        <button
          onClick={handleStart}
          disabled={!genre || loading}
          className="w-full py-3.5 text-sm tracking-widest border border-zinc-300
            text-zinc-600 hover:text-zinc-900 hover:border-zinc-800
            disabled:opacity-30 disabled:cursor-not-allowed
            transition-all duration-200 rounded-none"
        >
          {loading ? t('lobby.initializing', language) : genre ? t('lobby.begin', language) : t('lobby.selectAGenre', language)}
        </button>

        {/* Multiplayer section */}
        <div className="w-full pt-4 border-t border-zinc-100">
          <p className="text-center text-xs text-zinc-300 tracking-widest mb-4">
            {t('lobby.orPlayTogether', language)}
          </p>
          <button
            onClick={() => router.push('/multiplayer')}
            className="w-full py-3 text-sm tracking-widest border border-zinc-200
              text-zinc-400 hover:text-zinc-800 hover:border-zinc-600
              transition-all duration-200 rounded-none"
          >
            {t('lobby.multiplayer', language)}
          </button>
        </div>

        {/* Credits / Recharge */}
        <div className="w-full border-t border-zinc-100 pt-4">
          <p className="text-center text-xs text-zinc-400 tracking-widest mb-3">
            {t('lobby.credits', language)}
          </p>
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-zinc-700">¥{balance}</span>
            <div className="flex gap-2 flex-wrap justify-end">
              {[5, 10, 30].map((amount) => (
                <button
                  key={amount}
                  onClick={() => handleStartRecharge(amount)}
                  className="px-3 py-1.5 text-xs border border-zinc-300 text-zinc-600 hover:text-zinc-900 hover:border-zinc-800 rounded transition-colors"
                >
                  +¥{amount}
                </button>
              ))}
              <button
                onClick={() => setCustomAmountMode(!customAmountMode)}
                className={`px-3 py-1.5 text-xs border rounded transition-colors ${
                  customAmountMode
                    ? 'bg-zinc-800 text-white border-zinc-800'
                    : 'border-zinc-300 text-zinc-500 hover:text-zinc-900 hover:border-zinc-800'
                }`}
              >
                {t('lobby.customRecharge', language)}
              </button>
            </div>
          </div>

          {customAmountMode && (
            <div className="flex items-center gap-2 mb-3">
              <input
                type="number"
                min="1"
                value={customAmount}
                onChange={(e) => setCustomAmount(e.target.value)}
                placeholder={t('lobby.customRechargePlaceholder', language)}
                className="flex-1 px-3 py-1.5 text-xs border border-zinc-300 rounded focus:outline-none focus:border-zinc-500 transition-colors bg-transparent text-zinc-700 placeholder-zinc-300"
                onKeyDown={(e) => { if (e.key === 'Enter') handleCustomRecharge() }}
              />
              <button
                onClick={handleCustomRecharge}
                disabled={!customAmount || parseInt(customAmount) <= 0}
                className="px-3 py-1.5 text-xs border border-zinc-300 text-zinc-600 hover:text-zinc-900 hover:border-zinc-800 rounded transition-colors disabled:opacity-40"
              >
                +¥{customAmount || '?'}
              </button>
            </div>
          )}

          {paymentPhase.phase === 'new' && (
            <div className="p-4 bg-zinc-50 rounded-md border border-zinc-100 text-center">
              <p className="text-xs text-zinc-500 mb-3">
                {t('payment.wechatHint', language)}
              </p>
              <img
                src="/wechatpay.png"
                alt="微信收款码"
                className="mx-auto w-44 h-44 object-contain mb-3"
              />
              <div className="bg-white border border-zinc-200 rounded px-3 py-2 mb-3">
                <p className="text-[9px] text-zinc-400 tracking-wider mb-0.5">{t('payment.remarkLabel', language)}</p>
                <p className="text-sm font-mono text-zinc-800 tracking-wider select-all">
                  {paymentPhase.outTradeNo}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleConfirmPayment}
                  className="flex-1 px-3 py-2 text-xs border border-zinc-300 text-zinc-600 hover:text-zinc-900 hover:border-zinc-800 rounded transition-colors"
                >
                  {t('payment.confirmBtn', language)}
                </button>
                <button
                  onClick={() => setPaymentPhase({ phase: 'idle' })}
                  className="px-3 py-2 text-xs text-zinc-400 hover:text-zinc-600 transition-colors"
                >
                  {t('payment.cancelBtn', language)}
                </button>
              </div>
            </div>
          )}

          {paymentPhase.phase === 'submitting' && (
            <div className="p-4 bg-zinc-50 rounded-md border border-zinc-100 text-center">
              <div className="flex flex-col items-center gap-2 py-4">
                <div className="w-5 h-5 border-2 border-zinc-300 border-t-zinc-600 rounded-full animate-spin" />
                <p className="text-xs text-zinc-500">{t('payment.submitting', language)}</p>
              </div>
            </div>
          )}

          {paymentPhase.phase === 'submitted' && (
            <div className="p-4 bg-zinc-50 rounded-md border border-zinc-100 text-center">
              <p className="text-xs text-amber-600 mb-1">{t('payment.submitted', language)}</p>
              <p className="text-[10px] text-zinc-400">{t('payment.submittedHint', language)}</p>
              <button
                onClick={() => setPaymentPhase({ phase: 'idle' })}
                className="mt-2 text-xs text-zinc-500 underline"
              >
                {t('payment.closeBtn', language)}
              </button>
            </div>
          )}

          {paymentPhase.phase === 'error' && (
            <div className="p-4 bg-zinc-50 rounded-md border border-zinc-100 text-center">
              <p className="text-xs text-red-500 mb-2">{paymentPhase.message}</p>
              <button
                onClick={() => setPaymentPhase({ phase: 'idle' })}
                className="text-xs text-zinc-500 underline"
              >
                {t('payment.closeBtn', language)}
              </button>
            </div>
          )}
        </div>

        {/* Bottom Links */}
        <div className="flex items-center gap-8 text-xs text-zinc-400">
          <button
            onClick={() => {
              refreshSavedGames()
              router.push('/games')
            }}
            className="hover:text-zinc-800 transition-colors tracking-wider"
          >
            {savedGames.length > 0 ? `${t('lobby.history', language)} (${savedGames.length})` : t('lobby.history', language)}
          </button>
          <SettingsDialog />
        </div>
      </div>
      {/* Bottom bar */}
      <div className="fixed bottom-0 left-0 right-0 border-t border-zinc-100 bg-white/80 backdrop-blur-sm">
        <div className="max-w-lg mx-auto flex items-center justify-between px-6 py-2">
          <button
            onClick={() => router.push('/admin')}
            className="text-[10px] text-zinc-300 hover:text-zinc-600 transition-colors tracking-wider"
          >
            {t('lobby.admin', language)}
          </button>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setLanguage(language === 'en' ? 'zh' : 'en')}
              className="text-[10px] text-zinc-300 hover:text-zinc-600 transition-colors tracking-wider"
            >
              {language === 'en' ? '中文' : 'En'}
            </button>
            {pendingCount > 0 && (
            <span className="text-[10px] text-amber-500 tracking-wider">
              {t('lobby.pendingCount', language, { n: pendingCount })}
            </span>
          )}
        </div>
      </div>
    </div>
    </div>
  )
}
