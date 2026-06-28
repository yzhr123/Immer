'use client'

import { useState } from 'react'
import { useStore } from '@/lib/store'
import { useCredits } from '@/lib/credit/client'
import { t } from '@/lib/i18n'

const DEFAULT_API_URL = 'https://api.deepseek.com/'
const DEFAULT_MODEL = 'deepseek-v4-flash'

export default function SettingsDialog() {
  const { llmSettings, setLLMSettings, language } = useStore()
  const { balance, loading } = useCredits()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ ...llmSettings })

  function handleSave() {
    setLLMSettings({
      apiUrl: form.apiUrl || DEFAULT_API_URL,
      model: form.model || DEFAULT_MODEL,
      apiKey: form.apiKey,
    })
    setOpen(false)
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-xs text-zinc-400 hover:text-zinc-800 transition-colors tracking-wider uppercase"
      >
        {t('settings.title', language)}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-md mx-4 bg-white rounded-lg shadow-xl border border-zinc-100 p-8"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-sm font-medium text-zinc-800 tracking-wide mb-6">
              {t('settings.llmConfig', language)}
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-xs text-zinc-500 mb-1.5 tracking-wide">
                  {t('settings.apiUrl', language)}
                </label>
                <input
                  type="text"
                  value={form.apiUrl}
                  onChange={(e) => setForm({ ...form, apiUrl: e.target.value })}
                  placeholder="https://api.deepseek.com/"
                  className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-md focus:outline-none focus:border-zinc-400 transition-colors bg-white text-zinc-800 placeholder-zinc-300"
                />
              </div>

              <div>
                <label className="block text-xs text-zinc-500 mb-1.5 tracking-wide">
                  {t('settings.model', language)}
                </label>
                <input
                  type="text"
                  value={form.model}
                  onChange={(e) => setForm({ ...form, model: e.target.value })}
                  placeholder="deepseek-v4-flash"
                  className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-md focus:outline-none focus:border-zinc-400 transition-colors bg-white text-zinc-800 placeholder-zinc-300"
                />
              </div>

              <div>
                <label className="block text-xs text-zinc-500 mb-1.5 tracking-wide">
                  {t('settings.apiKey', language)}
                </label>
                <input
                  type="password"
                  value={form.apiKey}
                  onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
                  placeholder="sk-..."
                  className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-md focus:outline-none focus:border-zinc-400 transition-colors bg-white text-zinc-800 placeholder-zinc-300"
                />
              </div>

              <div className="border-t border-zinc-100 pt-4 mt-4">
                <label className="block text-xs text-zinc-500 mb-1.5 tracking-wide">
                  {t('settings.imageModelId', language)}
                </label>
                <input
                  type="text"
                  value={form.imageModelId || ''}
                  onChange={(e) => setForm({ ...form, imageModelId: e.target.value })}
                  placeholder="gpt-image-2"
                  className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-md focus:outline-none focus:border-zinc-400 transition-colors bg-white text-zinc-800 placeholder-zinc-300"
                />
                <div className="flex flex-wrap gap-2 mt-2">
                  {['gpt-image-2', 'doubao-seedream-4-0-250828', 'doubao-seedream-5-0-260128'].map((id) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setForm({ ...form, imageModelId: id })}
                      className={`px-2 py-0.5 text-[10px] tracking-wider rounded-sm transition-colors ${
                        form.imageModelId === id
                          ? 'bg-zinc-800 text-white'
                          : 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200'
                      }`}
                    >
                      {id === 'gpt-image-2' ? '中转站' : id.replace('doubao-seedream-', '豆包 ')}
                    </button>
                  ))}
                </div>
              </div>

              <div className="border-t border-zinc-100 pt-4 mt-4">
                <label className="block text-xs text-zinc-500 mb-3 tracking-wide">
{t('settings.credits', language)}
                </label>
                <div className="flex items-center">
                  <span className="text-sm text-zinc-700">
                    {t('settings.balance', language, { balance: loading ? '...' : balance })}
                  </span>
                </div>
                <p className="text-xs text-zinc-400 mt-3">{t('payment.rechargeHint', language)}</p>
                <p className="text-xs text-zinc-400 mt-1">
                  {t('settings.rechargeInLobby', language)}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between mt-8">
              <span className="text-xs text-zinc-400">
                {llmSettings.apiUrl ? t('settings.llmConfigured', language) : t('settings.llmNotConfigured', language)}
              </span>
              <div className="flex gap-3">
                <button
                  onClick={() => setOpen(false)}
                  className="px-4 py-2 text-xs text-zinc-500 hover:text-zinc-800 transition-colors"
                >
                  {t('settings.cancelBtn', language)}
                </button>
                <button
                  onClick={handleSave}
                  className="px-5 py-2 text-xs text-white bg-zinc-800 hover:bg-zinc-700 rounded-md transition-colors"
                >
{t('settings.saveBtn', language)}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
