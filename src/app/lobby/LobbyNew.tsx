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

/* ────────────── steps ────────────── */
type Step = 1 | 2 | 3 | 4
const STEPS: { id: Step; labelZh: string; labelEn: string }[] = [
  { id: 1, labelZh: '题材', labelEn: 'Genre' },
  { id: 2, labelZh: '故事', labelEn: 'Story' },
  { id: 3, labelZh: '配置', labelEn: 'Config' },
  { id: 4, labelZh: '出发', labelEn: 'Begin' },
]

function currentStep(genre: string | null, premise: string): Step {
  if (!genre) return 1
  if (!premise) return 2
  return 4 // all good, ready to go
}

/* ────────────── glass card wrapper ────────────── */
function GlassCard({
  children,
  className = '',
  accent = false,
}: {
  children: React.ReactNode
  className?: string
  accent?: boolean
}) {
  return (
    <div
      className={`relative w-full overflow-hidden transition-all duration-500 ${className}`}
      style={{
        padding: '1.5rem 1.75rem',
        borderRadius: '20px',
        background: 'rgba(255,255,255,0.65)',
        backdropFilter: 'blur(24px) saturate(160%)',
        WebkitBackdropFilter: 'blur(24px) saturate(160%)',
        border: '1px solid rgba(0,0,0,0.04)',
        boxShadow: '0 2px 8px rgba(0,0,0,0.02), 0 0 0 1px rgba(0,0,0,0.01)',
      }}
    >
      {accent && (
        <span
          className="absolute left-0 top-3 bottom-3 w-0.5 rounded-full"
          style={{ background: 'linear-gradient(to bottom, #c7c7cc, #8e8e93)', opacity: 0.4 }}
        />
      )}
      <div className="relative">{children}</div>
    </div>
  )
}

/* ────────────── main content ────────────── */
function LobbyNewContent() {
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

  const step = currentStep(genre, premise)

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
    <div className="flex flex-col flex-1 items-center px-6"
      style={{ background: '#faf8f5', minHeight: '100vh' }}
    >
      <div className="w-full max-w-lg flex flex-col items-center py-20 gap-10">

        {/* ─── Header ─── */}
        <div className="text-center space-y-2">
          <h1 className="text-5xl font-light tracking-[0.15em]"
            style={{ color: '#1c1c1e', fontFamily: "'Noto Serif SC', 'Georgia', serif" }}
          >
            Immer
          </h1>
          <p className="text-xs tracking-[0.25em]" style={{ color: '#8e8e93' }}>
            AI 互动故事
          </p>
        </div>

        {/* ─── Step Progress ─── */}
        <div className="w-full flex items-center justify-center gap-1">
          {STEPS.map((s, idx) => {
            const done = step > s.id
            const active = step === s.id
            return (
              <div key={s.id} className="flex items-center gap-1">
                <span
                  className={`
                    text-[10px] tracking-[0.2em] font-medium transition-all duration-300
                    ${done ? 'opacity-40' : ''}
                    ${active ? 'opacity-90' : ''}
                    ${!done && !active ? 'opacity-20' : ''}
                  `}
                  style={{ color: '#1c1c1e' }}
                >
                  {language === 'zh' ? s.labelZh : s.labelEn}
                </span>
                {idx < STEPS.length - 1 && (
                  <span
                    className={`inline-block w-6 h-px mx-1 transition-all duration-300 ${
                      done ? 'opacity-30' : 'opacity-10'
                    }`}
                    style={{ background: '#1c1c1e' }}
                  />
                )}
              </div>
            )
          })}
        </div>

        {/* ─── Step 1: Genre ─── */}
        <GlassCard accent>
          <div className="flex items-center gap-3 mb-5">
            <span className="text-[10px] font-medium tracking-[0.15em] uppercase"
              style={{ color: '#8e8e93' }}>
              {language === 'zh' ? '第一步' : 'Step 1'}
            </span>
            <span className="h-px flex-1" style={{ background: 'rgba(0,0,0,0.04)' }} />
          </div>
          <p className="text-[11px] tracking-[0.2em] mb-4" style={{ color: '#8e8e93' }}>
            {t('lobby.selectGenre', language)}
          </p>
          <GenreSelector selected={genre} onSelect={setGenre} />
        </GlassCard>

        {/* ─── Step 2: Story ─── */}
        <GlassCard accent>
          <div className="flex items-center gap-3 mb-5">
            <span className="text-[10px] font-medium tracking-[0.15em] uppercase"
              style={{ color: '#8e8e93' }}>
              {language === 'zh' ? '第二步' : 'Step 2'}
            </span>
            <span className="h-px flex-1" style={{ background: 'rgba(0,0,0,0.04)' }} />
          </div>

          {/* Story Length */}
          <p className="text-[11px] tracking-[0.2em] mb-3" style={{ color: '#8e8e93' }}>
            {t('lobby.storyLength', language)}
          </p>
          <div className="flex gap-2 mb-6">
            {(['short', 'medium', 'long'] as StoryLength[]).map((len) => (
              <button
                key={len}
                onClick={() => setStoryLength(len)}
                className={`
                  flex-1 py-2.5 text-[11px] tracking-[0.15em] transition-all duration-300
                  ${storyLength === len
                    ? 'text-white'
                    : 'opacity-50 hover:opacity-80'
                  }
                `}
                style={{
                  borderRadius: '12px',
                  background: storyLength === len ? '#1c1c1e' : 'rgba(0,0,0,0.02)',
                  border: storyLength === len ? 'none' : '1px solid rgba(0,0,0,0.06)',
                }}
              >
                {LENGTH_LABELS[len]}
                <span className="ml-1 opacity-50">×{LENGTH_MULTIPLIERS[len]}</span>
              </button>
            ))}
          </div>

          {/* Premise */}
          <p className="text-[11px] tracking-[0.2em] mb-3" style={{ color: '#8e8e93' }}>
            {t('lobby.orPremise', language)}
          </p>
          <input
            type="text"
            value={premise}
            onChange={(e) => setPremise(e.target.value)}
            placeholder={t('lobby.premisePlaceholder', language)}
            className="w-full text-center text-sm py-2.5 bg-transparent transition-all duration-300"
            style={{
              color: '#1c1c1e',
              border: 'none',
              borderBottom: '1px solid rgba(0,0,0,0.06)',
              borderRadius: 0,
              outline: 'none',
            }}
            onFocus={(e) => { e.currentTarget.style.borderBottomColor = 'rgba(0,0,0,0.3)' }}
            onBlur={(e) => { e.currentTarget.style.borderBottomColor = 'rgba(0,0,0,0.06)' }}
          />

          {/* Story Club */}
          <div className="mt-5 pt-4" style={{ borderTop: '1px solid rgba(0,0,0,0.04)' }}>
            <button
              onClick={() => setStoryClubOpen(true)}
              className="group w-full text-left transition-all duration-300"
              style={{ opacity: 0.6 }}
              onMouseEnter={(e) => { e.currentTarget.style.opacity = '1' }}
              onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.6' }}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-[11px] tracking-[0.2em]" style={{ color: '#1c1c1e' }}>
                  {t('storyclub.triggerBtn', language)}
                </span>
                <span className="text-xs transition-transform duration-300 group-hover:translate-x-0.5"
                  style={{ color: '#8e8e93' }}>
                  →
                </span>
              </div>
              <p className="text-[10px] tracking-wider mt-0.5" style={{ color: '#8e8e93' }}>
                {language === 'zh' ? '浏览社区故事 · 一键续写' : 'Browse community stories'}
              </p>
            </button>
          </div>
        </GlassCard>

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

        {/* ─── Step 3: Config ─── */}
        <GlassCard accent>
          <div className="flex items-center gap-3 mb-5">
            <span className="text-[10px] font-medium tracking-[0.15em] uppercase"
              style={{ color: '#8e8e93' }}>
              {language === 'zh' ? '第三步' : 'Step 3'}
            </span>
            <span className="h-px flex-1" style={{ background: 'rgba(0,0,0,0.04)' }} />
          </div>
          <ImageModeSelector />
        </GlassCard>

        {/* ─── Step 4: Go ─── */}
        <GlassCard accent>
          <div className="flex items-center gap-3 mb-5">
            <span className="text-[10px] font-medium tracking-[0.15em] uppercase"
              style={{ color: '#8e8e93' }}>
              {language === 'zh' ? '第四步' : 'Step 4'}
            </span>
            <span className="h-px flex-1" style={{ background: 'rgba(0,0,0,0.04)' }} />
          </div>

          {/* Cost hint */}
          {genre && imageMode !== 'none' && (
            <div className="text-center mb-5">
              <span className="text-[11px] tracking-wider" style={{ color: '#8e8e93' }}>
                {t('lobby.sessionCost', language, { total: getSessionPrice(imageMode, storyLength) })}
              </span>
              <span className="text-[10px] ml-2" style={{ color: '#aeaeb2' }}>
                {t(imageMode === 'full' ? 'settings.full' : 'settings.lazy', language)} ×{LENGTH_MULTIPLIERS[storyLength]}
              </span>
            </div>
          )}

          {/* Start + Beta */}
          <div className="flex gap-2 items-stretch mb-5">
            <button
              onClick={handleStart}
              disabled={!genre || loading}
              className="flex-1 py-3.5 text-sm tracking-[0.15em] transition-all duration-300"
              style={{
                borderRadius: '14px',
                background: !genre || loading ? 'rgba(0,0,0,0.03)' : '#1c1c1e',
                color: !genre || loading ? '#aeaeb2' : '#fff',
                cursor: !genre || loading ? 'not-allowed' : 'pointer',
                border: 'none',
              }}
              onMouseEnter={(e) => {
                if (genre && !loading) {
                  e.currentTarget.style.background = '#000'
                }
              }}
              onMouseLeave={(e) => {
                if (genre && !loading) {
                  e.currentTarget.style.background = '#1c1c1e'
                }
              }}
            >
              {loading
                ? t('lobby.initializing', language)
                : genre
                  ? t('lobby.begin', language)
                  : t('lobby.selectAGenre', language)
              }
            </button>
            <button
              onClick={handleBetaStart}
              disabled={!genre || loading}
              className="px-5 py-3.5 text-sm tracking-[0.15em] transition-all duration-300"
              style={{
                borderRadius: '14px',
                background: 'rgba(167,139,250,0.06)',
                color: '#a78bfa',
                border: '1px solid rgba(167,139,250,0.15)',
                cursor: !genre || loading ? 'not-allowed' : 'pointer',
                opacity: !genre || loading ? 0.4 : 1,
              }}
              onMouseEnter={(e) => {
                if (genre && !loading) {
                  e.currentTarget.style.background = 'rgba(167,139,250,0.1)'
                }
              }}
              onMouseLeave={(e) => {
                if (genre && !loading) {
                  e.currentTarget.style.background = 'rgba(167,139,250,0.06)'
                }
              }}
            >
              <span className="text-[10px] font-semibold tracking-[0.15em]">BETA</span>
              <span className="ml-1.5 text-xs opacity-0 group-hover:opacity-100 transition-opacity">→</span>
            </button>
          </div>

          {/* Multiplayer */}
          <div className="pt-4" style={{ borderTop: '1px solid rgba(0,0,0,0.04)' }}>
            <p className="text-[10px] tracking-[0.2em] mb-3 text-center" style={{ color: '#aeaeb2' }}>
              {t('lobby.orPlayTogether', language)}
            </p>
            <button
              onClick={() => router.push('/multiplayer')}
              className="w-full py-2.5 text-xs tracking-[0.15em] transition-all duration-300"
              style={{
                borderRadius: '12px',
                border: '1px solid rgba(0,0,0,0.06)',
                color: '#8e8e93',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'rgba(0,0,0,0.2)'
                e.currentTarget.style.color = '#1c1c1e'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'rgba(0,0,0,0.06)'
                e.currentTarget.style.color = '#8e8e93'
              }}
            >
              {t('lobby.multiplayer', language)}
            </button>
          </div>
        </GlassCard>

        {/* ─── Credits Section ─── */}
        <GlassCard>
          <p className="text-[10px] tracking-[0.2em] mb-4" style={{ color: '#8e8e93' }}>
            {t('lobby.credits', language)}
          </p>

          <div className="flex items-center justify-between mb-4">
            <span className="text-sm tracking-wider" style={{ color: '#1c1c1e', fontWeight: 500 }}>
              ¥{balance}
            </span>
            <div className="flex gap-2 flex-wrap justify-end">
              {[5, 10, 30].map((amount) => (
                <button
                  key={amount}
                  onClick={() => handleStartRecharge(amount)}
                  className="px-3 py-1.5 text-[10px] tracking-wider transition-all duration-200"
                  style={{
                    borderRadius: '10px',
                    border: '1px solid rgba(0,0,0,0.06)',
                    color: '#636366',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(0,0,0,0.2)'
                    e.currentTarget.style.color = '#1c1c1e'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(0,0,0,0.06)'
                    e.currentTarget.style.color = '#636366'
                  }}
                >
                  +¥{amount}
                </button>
              ))}
              <button
                onClick={() => setCustomAmountMode(!customAmountMode)}
                className={`px-3 py-1.5 text-[10px] tracking-wider transition-all duration-200`}
                style={{
                  borderRadius: '10px',
                  border: '1px solid rgba(0,0,0,0.06)',
                  color: customAmountMode ? '#1c1c1e' : '#636366',
                  background: customAmountMode ? 'rgba(0,0,0,0.03)' : 'transparent',
                }}
              >
                {t('lobby.customRecharge', language)}
              </button>
            </div>
          </div>

          {customAmountMode && (
            <div className="flex items-center gap-2 mb-4">
              <input
                type="number"
                min="1"
                value={customAmount}
                onChange={(e) => setCustomAmount(e.target.value)}
                placeholder={t('lobby.customRechargePlaceholder', language)}
                className="flex-1 px-3 py-1.5 text-xs transition-all duration-200 bg-transparent"
                style={{
                  border: '1px solid rgba(0,0,0,0.06)',
                  borderRadius: '10px',
                  color: '#1c1c1e',
                  outline: 'none',
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(0,0,0,0.2)' }}
                onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(0,0,0,0.06)' }}
                onKeyDown={(e) => { if (e.key === 'Enter') handleCustomRecharge() }}
              />
              <button
                onClick={handleCustomRecharge}
                disabled={!customAmount || parseInt(customAmount) <= 0}
                className="px-3 py-1.5 text-[10px] tracking-wider transition-all duration-200"
                style={{
                  borderRadius: '10px',
                  border: '1px solid rgba(0,0,0,0.06)',
                  color: '#636366',
                }}
              >
                +¥{customAmount || '?'}
              </button>
            </div>
          )}

          {paymentPhase.phase === 'show' && (
            <div
              className="p-5 mb-4 text-center"
              style={{
                borderRadius: '16px',
                background: 'rgba(255,255,255,0.5)',
                border: '1px solid rgba(0,0,0,0.04)',
              }}
            >
              <p className="text-sm font-medium mb-3" style={{ color: '#1c1c1e' }}>
                {language === 'zh' ? `需付款 ¥${paymentPhase.amount}` : `Pay ¥${paymentPhase.amount}`}
              </p>
              <p className="text-[10px] mb-3" style={{ color: '#8e8e93' }}>
                {t('payment.wechatHint', language)}
              </p>
              <img
                src="/wechatpay.png"
                alt="微信收款码"
                className="mx-auto w-40 h-40 object-contain mb-3"
              />
              <div className="px-3 py-2 mb-3" style={{
                borderRadius: '10px',
                background: 'rgba(255,255,255,0.7)',
                border: '1px solid rgba(0,0,0,0.04)',
              }}>
                <p className="text-[8px] tracking-wider mb-0.5" style={{ color: '#aeaeb2' }}>{t('payment.remarkLabel', language)}</p>
                <p className="text-sm font-mono tracking-wider select-all" style={{ color: '#1c1c1e' }}>
                  {paymentPhase.outTradeNo}
                </p>
              </div>
              <p className="text-[9px] mb-3" style={{ color: '#aeaeb2' }}>
                {language === 'zh' ? '付款后联系管理员获取充值码' : 'After payment, contact admin for redeem code'}
              </p>
              <button
                onClick={() => setPaymentPhase({ phase: 'idle' })}
                className="text-[10px] transition-colors"
                style={{ color: '#aeaeb2' }}
                onMouseEnter={(e) => { e.currentTarget.style.color = '#636366' }}
                onMouseLeave={(e) => { e.currentTarget.style.color = '#aeaeb2' }}
              >
                {language === 'zh' ? '取消付款' : 'Cancel'}
              </button>
            </div>
          )}

          {/* Redeem */}
          <div className="pt-4" style={{ borderTop: '1px solid rgba(0,0,0,0.04)' }}>
            <p className="text-[9px] tracking-[0.15em] mb-2 text-center" style={{ color: '#aeaeb2' }}>
              {language === 'zh' ? '有充值码？输入兑换' : 'Have a redeem code?'}
            </p>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={redeemCodeInput}
                onChange={(e) => setRedeemCodeInput(e.target.value.toUpperCase())}
                placeholder={language === 'zh' ? '输入充值码' : 'Enter redeem code'}
                className="flex-1 px-3 py-1.5 text-xs transition-all duration-200 bg-transparent uppercase"
                style={{
                  border: '1px solid rgba(0,0,0,0.06)',
                  borderRadius: '10px',
                  color: '#1c1c1e',
                  outline: 'none',
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(0,0,0,0.2)' }}
                onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(0,0,0,0.06)' }}
                onKeyDown={(e) => { if (e.key === 'Enter') handleRedeemCode() }}
                maxLength={20}
              />
              <button
                onClick={handleRedeemCode}
                disabled={!redeemCodeInput.trim()}
                className="px-4 py-1.5 text-[10px] tracking-wider transition-all duration-200"
                style={{
                  borderRadius: '10px',
                  border: '1px solid rgba(0,0,0,0.06)',
                  color: '#636366',
                }}
              >
                {language === 'zh' ? '兑换' : 'Redeem'}
              </button>
            </div>
            {redeemStatus && (
              <p
                className={`text-[10px] mt-2 transition-all ${
                  redeemStatus.type === 'success' ? 'opacity-60' : 'opacity-80'
                }`}
                style={{ color: redeemStatus.type === 'success' ? '#2c6e49' : '#c41e3a' }}
              >
                {redeemStatus.message}
              </p>
            )}
          </div>
        </GlassCard>

        {/* ─── Bottom Links ─── */}
        <div className="flex items-center gap-10 text-[11px]" style={{ color: '#aeaeb2' }}>
          <button
            onClick={() => {
              refreshSavedGames()
              router.push('/games')
            }}
            className="hover:opacity-60 transition-opacity tracking-wider"
            style={{ color: 'inherit' }}
          >
            {savedGames.length > 0
              ? `${t('lobby.history', language)} (${savedGames.length})`
              : t('lobby.history', language)
            }
          </button>
          <SettingsDialog />
        </div>
      </div>

      {/* ─── Bottom Bar ─── */}
      <div
        className="fixed bottom-0 left-0 right-0"
        style={{
          borderTop: '1px solid rgba(0,0,0,0.04)',
          background: 'rgba(250,248,245,0.8)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
        }}
      >
        <div className="max-w-lg mx-auto flex items-center justify-center px-6 py-2.5">
          <button
            onClick={() => setLanguage(language === 'en' ? 'zh' : 'en')}
            className="text-[9px] tracking-[0.2em] transition-colors"
            style={{ color: '#aeaeb2' }}
            onMouseEnter={(e) => { e.currentTarget.style.color = '#636366' }}
            onMouseLeave={(e) => { e.currentTarget.style.color = '#aeaeb2' }}
          >
            {language === 'en' ? '中文' : 'En'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function LobbyPageNew() {
  return (
    <Suspense fallback={null}>
      <LobbyNewContent />
    </Suspense>
  )
}
