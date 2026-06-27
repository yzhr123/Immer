/**
 * Native Pay — Create Order
 *
 * POST /api/wechat-pay/native
 *
 * Calls WeChat Pay v3 `POST /v3/pay/transactions/native` to get a `code_url`,
 * stores the pending order, and returns the URL for QR code generation.
 *
 * Request:  { userId: string; amount: number }
 * Response: { codeUrl: string; outTradeNo: string }
 */

import { NextRequest, NextResponse } from 'next/server'
import { getWechatPayConfig } from '@/lib/wechat-pay/config'
import {
  buildAuthorization,
  generateOutTradeNo,
} from '@/lib/wechat-pay/utils'
import {
  getPendingOrderStore,
  type PendingOrder,
} from '@/lib/wechat-pay/store'

const WECHAT_API_HOST = 'https://api.mch.weixin.qq.com'
const NATIVE_PATH = '/v3/pay/transactions/native'

/**
 * Acceptable credit recharge amounts (¥).
 */
const VALID_AMOUNTS = [10, 30, 50] as const

export async function POST(request: NextRequest) {
  try {
    const body: { userId?: string; amount?: number } = await request.json()
    const { userId, amount } = body

    // --- Validation ---
    if (!userId || typeof userId !== 'string') {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 })
    }
    if (!amount || !VALID_AMOUNTS.includes(amount as (typeof VALID_AMOUNTS)[number])) {
      return NextResponse.json(
        { error: `amount must be one of [${VALID_AMOUNTS.join(', ')}]` },
        { status: 400 },
      )
    }

    // --- Load config ---
    const cfg = getWechatPayConfig()

    // --- Build request body ---
    const outTradeNo = generateOutTradeNo()
    const description = `图片生成充值 ¥${amount}`
    const totalFen = amount * 100 // ¥ → 分

    const requestBody = JSON.stringify({
      appid: cfg.appId,
      mchid: cfg.mchid,
      description,
      out_trade_no: outTradeNo,
      notify_url: cfg.notifyUrl,
      attach: userId, // pass userId through attach so callback knows who to credit
      amount: {
        total: totalFen,
        currency: 'CNY',
      },
    })

    // --- Sign & send to WeChat Pay ---
    const authorization = buildAuthorization(
      cfg.mchid,
      cfg.certificateSerialNo,
      cfg.privateKeyPem,
      'POST',
      NATIVE_PATH,
      requestBody,
    )

    const wxRes = await fetch(`${WECHAT_API_HOST}${NATIVE_PATH}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: authorization,
        Accept: 'application/json',
        'Wechatpay-Serial': cfg.wechatPayPublicKeyId,
      },
      body: requestBody,
    })

    const wxResponseBody = await wxRes.text()

    if (!wxRes.ok) {
      return NextResponse.json(
        {
          error: 'WeChat Pay order creation failed',
          wxStatus: wxRes.status,
          wxBody: wxResponseBody,
        },
        { status: 502 },
      )
    }

    // --- Parse code_url ---
    let codeUrl: string
    try {
      const parsed = JSON.parse(wxResponseBody)
      codeUrl = parsed.code_url
      if (!codeUrl) {
        throw new Error('code_url missing from response')
      }
    } catch {
      return NextResponse.json(
        { error: 'Failed to parse WeChat Pay response' },
        { status: 502 },
      )
    }

    // --- Store pending order ---
    const order: PendingOrder = {
      outTradeNo,
      userId,
      amount,
      description,
      codeUrl,
      status: 'pending',
      createdAt: Date.now(),
      paidAt: null,
    }
    await getPendingOrderStore().create(order)

    return NextResponse.json({
      codeUrl,
      outTradeNo,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    // Don't leak config details to the client
    if (message.includes('[wechat-pay]') || message.includes('Missing required env')) {
      return NextResponse.json(
        { error: 'WeChat Pay is not configured' },
        { status: 501 },
      )
    }
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
