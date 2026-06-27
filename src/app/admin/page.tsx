'use client'

import { useState, useEffect, useCallback } from 'react'

const SECRET_STORAGE_KEY = 'immer_admin_secret'

type View = 'login' | 'dashboard'

interface PendingOrder {
  outTradeNo: string
  userId: string
  amount: number
  description: string
  createdAt: number
}

interface AdminData {
  count: number
  orders: PendingOrder[]
}

function getStoredSecret(): string {
  if (typeof window === 'undefined') return ''
  return sessionStorage.getItem(SECRET_STORAGE_KEY) || ''
}

function storeSecret(secret: string) {
  sessionStorage.setItem(SECRET_STORAGE_KEY, secret)
}

export default function AdminPage() {
  const [view, setView] = useState<View>(() => (getStoredSecret() ? 'dashboard' : 'login'))
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState(false)
  const [data, setData] = useState<AdminData | null>(null)
  const [error, setError] = useState('')
  const [confirming, setConfirming] = useState<string | null>(null)

  const secret = getStoredSecret()

  const fetchPending = useCallback(async () => {
    const s = getStoredSecret()
    if (!s) return
    try {
      const res = await fetch('/api/admin/pending', {
        headers: { 'x-admin-secret': s },
      })
      if (res.status === 401) {
        sessionStorage.removeItem(SECRET_STORAGE_KEY)
        setView('login')
        return
      }
      const json: AdminData = await res.json()
      setData(json)
      setError('')
    } catch {
      setError('加载失败')
    }
  }, [])

  useEffect(() => {
    if (view === 'dashboard') fetchPending()
  }, [view, fetchPending])

  // Auto-refresh every 10 seconds
  useEffect(() => {
    if (view !== 'dashboard') return
    const interval = setInterval(fetchPending, 10_000)
    return () => clearInterval(interval)
  }, [view, fetchPending])

  function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    storeSecret(password)
    setLoginError(false)
    setView('dashboard')
  }

  function handleLogout() {
    sessionStorage.removeItem(SECRET_STORAGE_KEY)
    setView('login')
    setPassword('')
    setData(null)
  }

  async function handleConfirm(outTradeNo: string) {
    setConfirming(outTradeNo)
    try {
      const res = await fetch('/api/admin/confirm', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-secret': secret,
        },
        body: JSON.stringify({ outTradeNo }),
      })
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        setError((errData as any).error || '确认失败')
        setConfirming(null)
        return
      }
      await fetchPending()
    } catch {
      setError('确认失败')
    } finally {
      setConfirming(null)
    }
  }

  if (view === 'login') {
    return (
      <div className="flex flex-col flex-1 items-center justify-center px-6">
        <form
          onSubmit={handleLogin}
          className="w-full max-w-sm flex flex-col gap-4"
        >
          <h1 className="text-lg font-light tracking-[0.15em] text-zinc-800 text-center mb-4">
            Admin
          </h1>
          <input
            type="password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value)
              setLoginError(false)
            }}
            placeholder="Admin Password"
            className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-md focus:outline-none focus:border-zinc-400 transition-colors bg-white text-zinc-800"
          />
          {loginError && (
            <p className="text-xs text-red-500 text-center">密码错误</p>
          )}
          <button
            type="submit"
            className="w-full py-2.5 text-sm tracking-widest border border-zinc-300 text-zinc-600 hover:text-zinc-900 hover:border-zinc-800 transition-all duration-200"
          >
            ENTER
          </button>
        </form>
      </div>
    )
  }

  return (
    <div className="flex flex-col flex-1 items-center px-6 py-12">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-lg font-light tracking-[0.15em] text-zinc-800">
              Admin
            </h1>
            <p className="text-xs text-zinc-400 tracking-wider mt-1">
              {data ? `待确认 ${data.count} 笔` : '加载中...'}
            </p>
          </div>
          <button
            onClick={handleLogout}
            className="text-xs text-zinc-400 hover:text-zinc-800 transition-colors tracking-wider"
          >
            Logout
          </button>
        </div>

        {/* Error */}
        {error && (
          <p className="text-xs text-red-500 mb-4 bg-red-50 px-3 py-2 rounded">{error}</p>
        )}

        {/* Table */}
        {data && data.orders.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-sm text-zinc-300 tracking-wider">暂无待确认付款</p>
          </div>
        ) : (
          <div className="space-y-2">
            {/* Header row */}
            <div className="flex items-center gap-3 px-4 py-2 text-[10px] text-zinc-400 tracking-widest uppercase">
              <span className="w-48">Order</span>
              <span className="w-16 text-right">Amount</span>
              <span className="w-32">User</span>
              <span className="flex-1 text-right">Time</span>
              <span className="w-20 text-center"></span>
            </div>

            {data?.orders.map((order) => (
              <div
                key={order.outTradeNo}
                className="flex items-center gap-3 px-4 py-3 bg-white border border-zinc-100 rounded-sm text-xs"
              >
                <span className="w-48 text-zinc-500 font-mono tracking-wider truncate">
                  {order.outTradeNo}
                </span>
                <span className="w-16 text-right text-zinc-800 font-medium">
                  ¥{order.amount}
                </span>
                <span className="w-32 text-zinc-400 font-mono truncate">
                  {order.userId.slice(0, 8)}...
                </span>
                <span className="flex-1 text-right text-zinc-400">
                  {new Date(order.createdAt).toLocaleTimeString('zh-CN', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
                <span className="w-20 text-center">
                  <button
                    onClick={() => handleConfirm(order.outTradeNo)}
                    disabled={confirming === order.outTradeNo}
                    className="px-3 py-1.5 text-[10px] tracking-wider border border-zinc-300 
                      text-zinc-600 hover:text-zinc-900 hover:border-zinc-800 
                      disabled:opacity-30 transition-all rounded-sm"
                  >
                    {confirming === order.outTradeNo ? '...' : '确认到账'}
                  </button>
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Back link */}
        <div className="mt-8 text-center">
          <button
            onClick={() => (window.location.href = '/')}
            className="text-xs text-zinc-400 hover:text-zinc-800 transition-colors tracking-wider"
          >
            ← Back
          </button>
        </div>
      </div>
    </div>
  )
}
