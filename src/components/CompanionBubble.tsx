'use client'

interface CompanionBubbleProps {
  thought: string
  role: string
  enabled: boolean
  themeBorder: string
  themeBgCard: string
  themeText: string
  themeTextMuted: string
  bottomNav?: boolean
}

export default function CompanionBubble({
  thought,
  role,
  enabled,
  themeBorder,
  themeBgCard,
  themeText,
  themeTextMuted,
  bottomNav,
}: CompanionBubbleProps) {
  if (!enabled || !thought) return null

  return (
    <div
      className={`fixed left-6 z-30 max-w-xs px-4 py-3 rounded-sm shadow-lg animate-fade-in-up ${bottomNav ? 'bottom-20' : 'bottom-6'}`}
      style={{
        backgroundColor: themeBgCard,
        border: `1px solid ${themeBorder}`,
        color: themeText,
      }}
    >
      <div className="text-xs tracking-wider mb-1" style={{ color: themeTextMuted }}>
        「{role}」
      </div>
      <div className="text-sm leading-relaxed">
        {thought}
      </div>
    </div>
  )
}
