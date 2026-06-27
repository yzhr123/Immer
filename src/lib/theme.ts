import { Mood } from './ai/types'

export interface Theme {
  bg: string
  bgCard: string
  text: string
  textSecondary: string
  textMuted: string
  border: string
  accent: string
  overlayClass: string
  imageGradient: string
  choiceBorderHover: string
}

export const THEMES: Record<Mood, Theme> = {
  dark: {
    bg: '#0a0a0a',
    bgCard: '#141414',
    text: '#e5e5e5',
    textSecondary: '#aaaaaa',
    textMuted: '#777777',
    border: '#222222',
    accent: '#888888',
    overlayClass: 'bg-gradient-to-b from-transparent via-black/10 to-black/60',
    imageGradient: 'from-black/40 via-transparent to-black/40',
    choiceBorderHover: '#888888',
  },
  mysterious: {
    bg: '#0f0e17',
    bgCard: '#1a1930',
    text: '#d4d4f5',
    textSecondary: '#a8a8d0',
    textMuted: '#7a79a0',
    border: '#2a2945',
    accent: '#7c6cf0',
    overlayClass: 'bg-gradient-to-b from-transparent via-indigo-950/10 to-indigo-950/50',
    imageGradient: 'from-indigo-950/40 via-transparent to-indigo-950/40',
    choiceBorderHover: '#7c6cf0',
  },
  tense: {
    bg: '#0d0d0d',
    bgCard: '#1a0a0a',
    text: '#f0d8d8',
    textSecondary: '#cc9999',
    textMuted: '#886666',
    border: '#331a1a',
    accent: '#cc3333',
    overlayClass: 'bg-gradient-to-b from-transparent via-red-950/10 to-red-950/50',
    imageGradient: 'from-red-950/40 via-transparent to-red-950/40',
    choiceBorderHover: '#cc3333',
  },
  peaceful: {
    bg: '#f8f6f0',
    bgCard: '#ffffff',
    text: '#2d2a24',
    textSecondary: '#8a857c',
    textMuted: '#c5c0b5',
    border: '#e5e0d8',
    accent: '#8a9a6a',
    overlayClass: 'bg-gradient-to-b from-transparent via-black/5 to-black/20',
    imageGradient: 'from-black/20 via-transparent to-black/20',
    choiceBorderHover: '#8a9a6a',
  },
  epic: {
    bg: '#0c0f1a',
    bgCard: '#161b30',
    text: '#e8dcc8',
    textSecondary: '#b8aa90',
    textMuted: '#7a6d58',
    border: '#2a2535',
    accent: '#d4a030',
    overlayClass: 'bg-gradient-to-b from-transparent via-yellow-950/10 to-yellow-950/40',
    imageGradient: 'from-yellow-950/30 via-transparent to-yellow-950/30',
    choiceBorderHover: '#d4a030',
  },
  sad: {
    bg: '#121218',
    bgCard: '#1c1c28',
    text: '#c8c8d8',
    textSecondary: '#9898a8',
    textMuted: '#686878',
    border: '#282838',
    accent: '#6a7a9a',
    overlayClass: 'bg-gradient-to-b from-transparent via-blue-950/10 to-blue-950/40',
    imageGradient: 'from-blue-950/30 via-transparent to-blue-950/30',
    choiceBorderHover: '#6a7a9a',
  },
  joyful: {
    bg: '#faf8f0',
    bgCard: '#ffffff',
    text: '#2a2820',
    textSecondary: '#807a6a',
    textMuted: '#c0baa8',
    border: '#e0dcc8',
    accent: '#e8a040',
    overlayClass: 'bg-gradient-to-b from-transparent via-amber-100/20 to-amber-200/30',
    imageGradient: 'from-amber-200/30 via-transparent to-amber-200/30',
    choiceBorderHover: '#e8a040',
  },
  scary: {
    bg: '#050505',
    bgCard: '#0f0505',
    text: '#e8a0a0',
    textSecondary: '#bb6666',
    textMuted: '#884444',
    border: '#220a0a',
    accent: '#cc0000',
    overlayClass: 'bg-gradient-to-b from-transparent via-red-950/20 to-black/70',
    imageGradient: 'from-black/60 via-red-950/30 to-black/60',
    choiceBorderHover: '#cc0000',
  },
  calm: {
    bg: '#f0f2f5',
    bgCard: '#ffffff',
    text: '#2a3038',
    textSecondary: '#808890',
    textMuted: '#b8c0c8',
    border: '#d8dce0',
    accent: '#5090a8',
    overlayClass: 'bg-gradient-to-b from-transparent via-blue-50/20 to-blue-100/30',
    imageGradient: 'from-blue-100/30 via-transparent to-blue-100/30',
    choiceBorderHover: '#5090a8',
  },
}

export function getTheme(mood: Mood): Theme {
  return THEMES[mood] || THEMES.calm
}
