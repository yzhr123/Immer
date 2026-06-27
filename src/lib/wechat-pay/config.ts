/**
 * WeChat Pay v3 Configuration
 *
 * Loads merchant credentials from environment variables.
 * All config is validated on first access — missing vars throw.
 *
 * Required env vars:
 *   WECHAT_APP_ID            — 微信开放平台 AppID (服务商或普通商户)
 *   WECHAT_MCHID             — 商户号
 *   WECHAT_CERT_SERIAL_NO    — 商户 API 证书序列号
 *   WECHAT_PRIVATE_KEY       — 商户 API 证书私钥 (PEM)
 *   WECHAT_API_V3_KEY        — APIv3 密钥 (32 字节 hex/string)
 *   WECHAT_PUB_KEY_ID        — 微信支付公钥 ID
 *   WECHAT_PUB_KEY           — 微信支付公钥 (PEM)
 *   WECHAT_NOTIFY_URL        — 支付回调 URL (需公网可达)
 */

export interface WechatPayConfig {
  appId: string
  mchid: string
  certificateSerialNo: string
  privateKeyPem: string
  apiV3Key: string
  wechatPayPublicKeyId: string
  wechatPayPublicKeyPem: string
  notifyUrl: string
}

let cached: WechatPayConfig | null = null
let loadError: Error | null = null

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value || value.trim() === '') {
    throw new Error(
      `[wechat-pay] Missing required env var: ${name}. ` +
        'Set it in .env.local or deployment secrets.',
    )
  }
  return value.trim()
}

/**
 * Load (or return cached) WeChat Pay configuration from environment.
 * Throws on first call if any required var is missing.
 */
export function getWechatPayConfig(): WechatPayConfig {
  if (cached) return cached
  if (loadError) throw loadError

  try {
    cached = {
      appId: requireEnv('WECHAT_APP_ID'),
      mchid: requireEnv('WECHAT_MCHID'),
      certificateSerialNo: requireEnv('WECHAT_CERT_SERIAL_NO'),
      privateKeyPem: requireEnv('WECHAT_PRIVATE_KEY'),
      apiV3Key: requireEnv('WECHAT_API_V3_KEY'),
      wechatPayPublicKeyId: requireEnv('WECHAT_PUB_KEY_ID'),
      wechatPayPublicKeyPem: requireEnv('WECHAT_PUB_KEY'),
      notifyUrl: requireEnv('WECHAT_NOTIFY_URL'),
    }
    return cached
  } catch (err) {
    loadError = err instanceof Error ? err : new Error(String(err))
    throw loadError
  }
}

/**
 * Check whether WeChat Pay is configured (non-throwing).
 * Components can call this to hide payment UI when not configured.
 */
export function isWechatPayConfigured(): boolean {
  try {
    getWechatPayConfig()
    return true
  } catch {
    return false
  }
}

/**
 * Reset cached config (useful for testing).
 */
export function resetWechatPayConfig(): void {
  cached = null
  loadError = null
}
