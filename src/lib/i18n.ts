'use client'

export type Lang = 'en' | 'zh'

const dict: Record<string, Record<Lang, string>> = {
  // Lobby
  'lobby.subtitle': { en: 'AI Interactive Story', zh: 'AI 互动故事' },
  'lobby.selectGenre': { en: 'SELECT GENRE', zh: '选择题材' },
  'lobby.storyLength': { en: 'STORY LENGTH', zh: '故事长度' },
  'lobby.orPremise': { en: 'OR ENTER A PREMISE', zh: '或输入故事前提' },
  'lobby.premisePlaceholder': {
    en: 'A lone detective in a city that never sleeps...',
    zh: '一个在不眠都市中的孤独侦探...',
  },
  'lobby.begin': { en: 'BEGIN', zh: '开始' },
  'lobby.selectAGenre': { en: 'SELECT A GENRE', zh: '选择一个题材' },
  'lobby.initializing': { en: 'INITIALIZING...', zh: '初始化中...' },
  'lobby.orPlayTogether': { en: 'OR PLAY TOGETHER', zh: '或一起游戏' },
  'lobby.multiplayer': { en: 'MULTIPLAYER', zh: '多人模式' },
  'lobby.credits': { en: 'CREDITS', zh: '信用分' },
  'lobby.history': { en: 'HISTORY', zh: '历史记录' },
  'lobby.admin': { en: 'Admin', zh: '管理' },
  'lobby.pendingCount': { en: 'Pending {n}', zh: '待确认 {n} 笔' },

  // Payment flow (lobby)
  'payment.wechatHint': {
    en: 'Scan the QR code with WeChat',
    zh: '微信扫码付款',
  },
  'payment.remarkLabel': { en: 'Remark your email/phone number to get redeem code', zh: '付款备注邮箱/手机号获取充值码' },
  'payment.confirmBtn': { en: 'I have paid, confirm', zh: '我已付款确认' },
  'payment.cancelBtn': { en: 'Cancel', zh: '取消' },
  'payment.submitting': { en: 'Submitting...', zh: '提交中...' },
  'payment.submitted': { en: 'Submitted, awaiting merchant confirmation', zh: '已提交，等待商家确认' },
  'payment.submittedHint': {
    en: 'Balance will update once confirmed',
    zh: '确认后余额将自动更新',
  },
  'payment.closeBtn': { en: 'Close', zh: '关闭' },
  'payment.rechargeHint': {
    en: 'If balance is insufficient, Full/Lazy mode will not start the game',
    zh: '余额不足时 Full/Lazy 模式无法开始游戏',
  },

  // Settings dialog
  'settings.title': { en: 'Settings', zh: '设置' },
  'settings.llmConfig': { en: 'LLM Configuration', zh: 'LLM 配置' },
  'settings.apiUrl': { en: 'API URL', zh: 'API 地址' },
  'settings.model': { en: 'LLM Model', zh: 'LLM 模型' },
  'settings.apiKey': { en: 'LLM API Key', zh: 'LLM API 密钥' },
  'settings.imageModelId': { en: 'Image Model ID (optional)', zh: '图片模型 ID (可选)' },
  'settings.imageMode': { en: 'Image Mode', zh: '图片模式' },
  'settings.full': { en: 'Full', zh: '完整' },
  'settings.lazy': { en: 'Lazy', zh: '精简' },
  'settings.none': { en: 'None', zh: '关闭' },
  'settings.priceFull': { en: '\u00a510/times', zh: '\u00a510/\u6b21' },
  'settings.priceLazy': { en: '\u00a55/times', zh: '\u00a55/\u6b21' },
  'settings.priceNone': { en: 'Free', zh: '免费' },
  'settings.credits': { en: 'Credits', zh: '信用分' },
  'settings.balance': { en: 'Balance: \u00a5{balance}', zh: '余额: \u00a5{balance}' },
  'settings.rechargeInLobby': {
    en: 'Recharge in the lobby',
    zh: '充值请在 lobby 页面操作',
  },
  'settings.llmConfigured': { en: 'LLM configured', zh: 'LLM 已配置' },
  'settings.llmNotConfigured': { en: 'LLM not configured', zh: 'LLM 未配置' },
  'settings.cancelBtn': { en: 'Cancel', zh: '取消' },
  'settings.saveBtn': { en: 'Save', zh: '保存' },
  'settings.langEn': { en: 'En', zh: 'En' },
  'settings.langZh': { en: 'Zh', zh: '中文' },

  'genre.custom': { en: 'CUSTOM', zh: '点击此处自定义题材' },
  'genre.backToPresets': { en: 'BACK TO PRESETS', zh: '返回预设' },
  'genre.customPlaceholder': { en: 'Enter a custom genre...', zh: '输入自定义类型...' },

  'lobby.insufficientCredits': {
    en: 'Insufficient balance! Current: ¥{balance}. {mode} mode costs ¥{price} per image. Please recharge first.',
    zh: '余额不足！当前 ¥{balance}，{mode} 模式每次 ¥{price}。请先充值。',
  },
  'lobby.customRecharge': { en: 'Custom', zh: '自定义' },
  'lobby.customRechargePlaceholder': { en: 'Enter amount', zh: '输入金额' },
}

export function t(key: string, lang: Lang, params?: Record<string, string | number>): string {
  const entry = dict[key]
  if (!entry) return key
  let text = entry[lang]
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      text = text.replace(`{${k}}`, String(v))
    }
  }
  return text
}

export function useLang(): Lang {
  if (typeof window === 'undefined') return 'en'
  try {
    const raw = localStorage.getItem('immer_language')
    if (raw === 'en' || raw === 'zh') return raw
  } catch { /* ignore */ }
  return 'zh'
}
