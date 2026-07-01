'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import GenreSelector from '@/components/GenreSelector'
import SettingsDialog from '@/components/SettingsDialog'
import ImageModeSelector from '@/components/ImageModeSelector'
import StoryClubPanel from '@/components/StoryClubPanel'
import { useStore } from '@/lib/store'
import { generateId } from '@/lib/utils'
import { GENRE_TITLES, StoryLength, LENGTH_LABELS } from '@/lib/ai/types'
import { useCredits, redeemCode, generateOutTradeNo } from '@/lib/credit/client'
import { getSessionPrice, LENGTH_MULTIPLIERS } from '@/lib/credit/store'
import { t, Lang } from '@/lib/i18n'

function LobbyContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { llmSettings, initGame, savedGames, refreshSavedGames, language, setLanguage, imageMode, setImageMode } = useStore()
  const [genre, setGenre] = useState<string | null>(null)
  const [premise, setPremise] = useState('')
  const [storyLength, setStoryLength] = useState<StoryLength>('medium')
  const [loading, setLoading] = useState(false)
  const [storyClubOpen, setStoryClubOpen] = useState(false)

  const { userId, balance, refresh: refreshBalance } = useCredits()
  const [paymentPhase, setPaymentPhase] = useState<
    { phase: 'idle' } |
    { phase: 'show'; outTradeNo: string; amount: number }
  >({ phase: 'idle' })
  const [redeemCodeInput, setRedeemCodeInput] = useState('')
  const [redeemStatus, setRedeemStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [customAmountMode, setCustomAmountMode] = useState(false)
  const [customAmount, setCustomAmount] = useState('')

  // Auto-select genre from URL query param ?genre=
  useEffect(() => {
    const g = searchParams.get('genre')
    if (g) setGenre(g)
  }, [searchParams])

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
      const required = getSessionPrice(imageMode, storyLength)
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

  function handleBetaStart() {
    if (!genre) return
    if (!llmSettings.apiUrl || !llmSettings.apiKey) {
      alert('请在 Settings 中配置 LLM API')
      return
    }
    if (imageMode === 'full' || imageMode === 'lazy') {
      alert(language === 'zh'
        ? 'Beta 测试版暂不支持图片模式，请将图片模式切换为「关闭」后再试。'
        : 'Image mode is not supported in Beta. Please switch to "None" mode first.')
      return
    }

    setLoading(true)
    const sessionId = generateId()

    initGame({
      sessionId,
      genre,
      title: GENRE_TITLES[genre] || genre,
      premise,
      storyLength,
      isBeta: true,
    })

    router.push(`/beta/game/${sessionId}`)
  }

  function handleStartRecharge(amount: number) {
    if (!userId) return
    const outTradeNo = generateOutTradeNo()
    setPaymentPhase({ phase: 'show', outTradeNo, amount })
  }

  function handleCustomRecharge() {
    const amount = parseInt(customAmount)
    if (!amount || amount <= 0) return
    handleStartRecharge(amount)
    setCustomAmount('')
    setCustomAmountMode(false)
  }

  async function handleRedeemCode() {
    const code = redeemCodeInput.trim()
    if (!code || !userId) return
    try {
      const result = await redeemCode(userId, code)
      setRedeemStatus({ type: 'success', message: language === 'zh' ? `充值成功，当前余额 ¥${result.balance}` : `Redeemed! Balance: ¥${result.balance}` })
      setRedeemCodeInput('')
      refreshBalance()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '兑换失败'
      setRedeemStatus({ type: 'error', message: msg })
    }
  }

  useEffect(() => {
    if (!redeemStatus) return
    const t = setTimeout(() => setRedeemStatus(null), 5000)
    return () => clearTimeout(t)
  }, [redeemStatus])

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
                <span className="ml-1 opacity-60">×{LENGTH_MULTIPLIERS[len]}</span>
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

        {/* Story Club — premium entry */}
        <button
          onClick={() => setStoryClubOpen(true)}
          className="group relative w-full text-left overflow-hidden transition-all duration-500"
          style={{
            padding: '1.2rem 1.5rem',
            borderRadius: '16px',
            background: 'rgba(255,255,255,0.6)',
            backdropFilter: 'blur(20px) saturate(150%)',
            WebkitBackdropFilter: 'blur(20px) saturate(150%)',
            border: '1px solid rgba(0,0,0,0.04)',
            boxShadow: '0 1px 3px rgba(0,0,0,0.02), 0 0 0 1px rgba(0,0,0,0.01)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.04), 0 0 0 1px rgba(0,0,0,0.06)'
            e.currentTarget.style.borderColor = 'rgba(0,0,0,0.08)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.02), 0 0 0 1px rgba(0,0,0,0.01)'
            e.currentTarget.style.borderColor = 'rgba(0,0,0,0.04)'
          }}
        >
          {/* left accent bar */}
          <span
            className="absolute left-0 top-2 bottom-2 w-0.5 rounded-full transition-all duration-500 group-hover:opacity-100"
            style={{
              background: 'linear-gradient(to bottom, #d4d4d4, #a3a3a3)',
              opacity: 0.5,
            }}
          />
          {/* hover glow overlay */}
          <span
            className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
            style={{
              borderRadius: '16px',
              background: 'radial-gradient(280px circle at 30% 50%, rgba(0,0,0,0.02), transparent 70%)',
            }}
          />
          {/* content */}
          <div className="relative flex items-center justify-between gap-4">
            <div className="flex flex-col gap-0.5">
              <span
                className="text-sm font-medium tracking-wider transition-colors duration-300"
                style={{ color: '#27272a', letterSpacing: '0.15em' }}
              >
                {t('storyclub.triggerBtn', language)}
              </span>
              <span
                className="text-[11px] tracking-wider transition-colors duration-300"
                style={{ color: '#a1a1aa' }}
              >
                {language === 'zh' ? '浏览社区故事 · 一键续写你的篇章' : 'Browse community stories · Continue where you left'}
              </span>
            </div>
            <span
              className="text-sm transition-all duration-300 group-hover:translate-x-0.5"
              style={{ color: '#a1a1aa' }}
            >
              →
            </span>
          </div>
        </button>

        {/* Story Club Panel */}
        <StoryClubPanel
          open={storyClubOpen}
          onClose={() => setStoryClubOpen(false)}
          onSelect={(premiseText, genreId) => {
            setPremise(premiseText)
            setGenre(genreId)
          }}
          language={language}
        />

        {/* Cost Hint */}
        {genre && imageMode !== 'none' && (
          <div className="text-center">
            <span className="text-xs text-zinc-400 tracking-wider">
              {t('lobby.sessionCost', language, { total: getSessionPrice(imageMode, storyLength) })}
            </span>
            <span className="text-[10px] text-zinc-300 ml-2">
              {t(imageMode === 'full' ? 'settings.full' : 'settings.lazy', language)} ×{LENGTH_MULTIPLIERS[storyLength]}
            </span>
          </div>
        )}

        {/* Start + Beta Buttons */}
        <div className="w-full flex gap-3 items-stretch">
          <button
            onClick={handleStart}
            disabled={!genre || loading}
            className="flex-1 py-3.5 text-sm tracking-widest border border-zinc-300
              text-zinc-600 hover:text-zinc-900 hover:border-zinc-800
              disabled:opacity-30 disabled:cursor-not-allowed
              transition-all duration-200 rounded-none"
          >
            {loading ? t('lobby.initializing', language) : genre ? t('lobby.begin', language) : t('lobby.selectAGenre', language)}
          </button>
          <button
            onClick={handleBetaStart}
            disabled={!genre || loading}
            className="group relative px-5 py-3.5 text-sm tracking-widest overflow-hidden
              transition-all duration-200 rounded-none"
            style={{
              color: '#a78bfa',
              border: '1px solid #a78bfa',
            }}
          >
            <span className="relative z-10 flex items-center gap-1.5">
              <span className="text-[10px] font-semibold tracking-[0.15em]">BETA</span>
              <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 text-xs">
                新体验
              </span>
              <span className="inline-block transition-transform duration-300 group-hover:translate-x-0.5">→</span>
            </span>
            <span
              className="absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity duration-300"
              style={{ backgroundColor: '#a78bfa' }}
            />
          </button>
        </div>

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

          {paymentPhase.phase === 'show' && (
            <div className="p-4 bg-zinc-50 rounded-md border border-zinc-100 text-center mb-3">
              <p className="text-sm font-medium text-zinc-700 mb-3">
                {language === 'zh' ? `需付款 ¥${paymentPhase.amount}` : `Pay ¥${paymentPhase.amount}`}
              </p>
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
              <p className="text-[10px] text-zinc-400 mb-3">
                {language === 'zh' ? '付款后联系管理员获取充值码' : 'After payment, contact admin for redeem code'}
              </p>
              <button
                onClick={() => setPaymentPhase({ phase: 'idle' })}
                className="px-4 py-1.5 text-xs text-zinc-400 hover:text-zinc-600 transition-colors"
              >
                {language === 'zh' ? '取消付款' : 'Cancel'}
              </button>
            </div>
          )}

          <p className="text-center text-[10px] text-zinc-400 tracking-wider mb-2">
            {language === 'zh' ? '有充值码？输入兑换' : 'Have a redeem code?'}
          </p>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={redeemCodeInput}
              onChange={(e) => setRedeemCodeInput(e.target.value.toUpperCase())}
              placeholder={language === 'zh' ? '输入充值码' : 'Enter redeem code'}
              className="flex-1 px-3 py-1.5 text-xs border border-zinc-300 rounded focus:outline-none focus:border-zinc-500 transition-colors bg-transparent text-zinc-700 placeholder-zinc-300 uppercase"
              onKeyDown={(e) => { if (e.key === 'Enter') handleRedeemCode() }}
              maxLength={20}
            />
            <button
              onClick={handleRedeemCode}
              disabled={!redeemCodeInput.trim()}
              className="px-4 py-1.5 text-xs border border-zinc-300 text-zinc-600 hover:text-zinc-900 hover:border-zinc-800 rounded transition-colors disabled:opacity-40"
            >
              {language === 'zh' ? '兑换' : 'Redeem'}
            </button>
          </div>

          {redeemStatus && (
            <p className={`text-xs mt-2 ${redeemStatus.type === 'success' ? 'text-emerald-600' : 'text-red-500'}`}>
              {redeemStatus.message}
            </p>
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
        <div className="max-w-lg mx-auto flex items-center justify-center px-6 py-2">
          <button
            onClick={() => setLanguage(language === 'en' ? 'zh' : 'en')}
            className="text-[10px] text-zinc-300 hover:text-zinc-600 transition-colors tracking-wider"
          >
            {language === 'en' ? '中文' : 'En'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function LobbyPageOld() {
  return (
    <Suspense fallback={null}>
      <LobbyContent />
    </Suspense>
  )
}
