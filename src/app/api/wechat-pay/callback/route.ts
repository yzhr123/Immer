/**
 * WeChat Pay Payment Callback
 *
 * POST /api/wechat-pay/callback
 *
 * Receives payment notifications from WeChat Pay after user scans the QR code
 * and completes payment.
 *
 * Flow:
 * 1. Validate notification signature (RSA-SHA256)
 * 2. Decrypt resource.ciphertext (AEAD_AES_256_GCM)
 * 3. Extract out_trade_no + userId (from attach)
 * 4. Mark order as paid + add credits to user
 * 5. Return 200 SUCCESS to acknowledge receipt
 */

import { NextRequest, NextResponse } from 'next/server'
import { getWechatPayConfig } from '@/lib/wechat-pay/config'
import {
  parseNotification,
  pickWechatpayHeaders,
} from '@/lib/wechat-pay/utils'
import { getPendingOrderStore } from '@/lib/wechat-pay/store'
import { getCreditStore } from '@/lib/credit/store-server'

export async function POST(request: NextRequest) {
  try {
    // --- Read raw body ---
    const body = await request.text()

    // --- Pick WeChat Pay headers ---
    const headers = pickWechatpayHeaders(
      Object.fromEntries(request.headers.entries()),
    )

    // --- Load config ---
    const cfg = getWechatPayConfig()

    // --- Validate signature & decrypt ---
    const transaction = parseNotification(
      cfg.apiV3Key,
      cfg.wechatPayPublicKeyId,
      cfg.wechatPayPublicKeyPem,
      headers,
      body,
    )

    // --- Only process SUCCESS transactions ---
    if (transaction.trade_state !== 'SUCCESS') {
      console.warn(
        `[wechat-pay] callback received non-SUCCESS state: ${transaction.trade_state}`,
      )
      return acknowledge()
    }

    // --- Deduplicate: check if already processed ---
    const existingOrder = await getPendingOrderStore().findByOutTradeNo(
      transaction.out_trade_no,
    )
    if (!existingOrder) {
      // Order not found locally — might be a test or replay
      console.warn(
        `[wechat-pay] callback for unknown order: ${transaction.out_trade_no}`,
      )
      return acknowledge()
    }

    if (existingOrder.status === 'paid') {
      // Idempotent: already processed, just acknowledge
      return acknowledge()
    }

    // --- Extract userId from attach (we put it there when creating the order) ---
    const userId = transaction.attach || existingOrder.userId
    if (!userId) {
      console.error(
        `[wechat-pay] callback missing userId for order ${transaction.out_trade_no}`,
      )
      return acknowledge() // still ack to avoid retry loops
    }

    // --- Credit the user ---
    const amountInYuan = transaction.amount.total / 100
    const creditStore = getCreditStore()
    await creditStore.addCredits(
      userId,
      amountInYuan,
      transaction.transaction_id,
    )

    // --- Mark order as paid ---
    await getPendingOrderStore().markPaid(transaction.out_trade_no)

    console.log(
      `[wechat-pay] payment success: order=${transaction.out_trade_no}, ` +
        `user=${userId}, amount=¥${amountInYuan}`,
    )

    return acknowledge()
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error(`[wechat-pay] callback error: ${message}`)
    // Return 200 even on error to prevent WeChat Pay from retrying indefinitely
    // (but log the error so we can manually reconcile)
    return acknowledge()
  }
}

/**
 * Response indicating successful receipt of notification.
 * WeChat Pay expects HTTP 200 + JSON with "SUCCESS" code.
 */
function acknowledge() {
  return NextResponse.json(
    { code: 'SUCCESS', message: '成功' },
    { status: 200 },
  )
}
