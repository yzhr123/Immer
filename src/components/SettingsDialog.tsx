'use client'

import { useState } from 'react'
import { useStore } from '@/lib/store'

export default function SettingsDialog() {
  const { llmSettings, setLLMSettings } = useStore()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ ...llmSettings })

  function handleSave() {
    setLLMSettings(form)
    setOpen(false)
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-xs text-zinc-400 hover:text-zinc-800 transition-colors tracking-wider uppercase"
      >
        Settings
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
              LLM Configuration
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-xs text-zinc-500 mb-1.5 tracking-wide">
                  API URL
                </label>
                <input
                  type="text"
                  value={form.apiUrl}
                  onChange={(e) => setForm({ ...form, apiUrl: e.target.value })}
                  placeholder="https://api.deepseek.com/v1"
                  className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-md focus:outline-none focus:border-zinc-400 transition-colors bg-white text-zinc-800 placeholder-zinc-300"
                />
              </div>

              <div>
                <label className="block text-xs text-zinc-500 mb-1.5 tracking-wide">
                  LLM Model
                </label>
                <input
                  type="text"
                  value={form.model}
                  onChange={(e) => setForm({ ...form, model: e.target.value })}
                  placeholder="deepseek-chat"
                  className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-md focus:outline-none focus:border-zinc-400 transition-colors bg-white text-zinc-800 placeholder-zinc-300"
                />
              </div>

              <div>
                <label className="block text-xs text-zinc-500 mb-1.5 tracking-wide">
                  LLM API Key
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
                  Image Model ID (optional)
                </label>
                <input
                  type="text"
                  value={form.imageModelId || ''}
                  onChange={(e) => setForm({ ...form, imageModelId: e.target.value })}
                  placeholder="doubao-seedream-5-0-260128"
                  className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-md focus:outline-none focus:border-zinc-400 transition-colors bg-white text-zinc-800 placeholder-zinc-300"
                />
              </div>
            </div>

            <div className="flex items-center justify-between mt-8">
              <span className="text-xs text-zinc-400">
                {llmSettings.apiUrl ? 'LLM configured' : 'LLM not configured'}
              </span>
              <div className="flex gap-3">
                <button
                  onClick={() => setOpen(false)}
                  className="px-4 py-2 text-xs text-zinc-500 hover:text-zinc-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  className="px-5 py-2 text-xs text-white bg-zinc-800 hover:bg-zinc-700 rounded-md transition-colors"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
