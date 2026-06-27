/**
 * Minimal admin authentication using ADMIN_SECRET env var.
 *
 * The admin page asks for a password on first visit, stores it in sessionStorage,
 * and sends it as the `x-admin-secret` header with every API call.
 * The server checks this against the ADMIN_SECRET environment variable.
 */

const ADMIN_SECRET_VAR = 'ADMIN_SECRET'

export function getAdminSecret(): string {
  return process.env[ADMIN_SECRET_VAR]?.trim() || ''
}

export function isAdminSecretConfigured(): boolean {
  return getAdminSecret().length > 0
}

export function verifyAdminSecret(secret: string): boolean {
  const configured = getAdminSecret()
  if (!configured) return false
  // Constant-time-ish comparison to avoid leaking length info
  if (secret.length !== configured.length) return false
  return secret === configured
}
