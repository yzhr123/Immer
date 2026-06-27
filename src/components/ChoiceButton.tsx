'use client'

interface ChoiceButtonProps {
  text: string
  index: number
  onClick: () => void
  disabled?: boolean
  themeBorder?: string
  themeText?: string
  themeTextSecondary?: string
  themeHoverBorder?: string
}

export default function ChoiceButton({
  text, index, onClick, disabled,
  themeBorder = '#e5e7eb',
  themeText = '#111111',
  themeTextSecondary = '#6b7280',
  themeHoverBorder = '#111111',
}: ChoiceButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="group w-full text-left px-5 py-3.5 border rounded-sm transition-all duration-200 ease-out"
      style={{
        borderColor: themeBorder,
        opacity: disabled ? 0.4 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
      onMouseEnter={(e) => {
        if (!disabled) {
          e.currentTarget.style.borderColor = themeHoverBorder
          e.currentTarget.style.transform = 'translateX(4px)'
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = themeBorder
        e.currentTarget.style.transform = 'translateX(0)'
      }}
    >
      <span
        className="text-xs mr-3 tracking-widest transition-colors duration-200"
        style={{ color: themeTextSecondary }}
      >
        {String(index + 1).padStart(2, '0')}
      </span>
      <span
        className="text-sm transition-colors duration-200"
        style={{ color: themeText }}
      >
        {text}
      </span>
    </button>
  )
}
