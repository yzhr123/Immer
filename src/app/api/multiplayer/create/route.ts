import { NextRequest, NextResponse } from 'next/server'
import { getStore } from '@/lib/multiplayer/store'
import type { CreateRoomRequest } from '@/lib/multiplayer/types'

export async function POST(request: NextRequest) {
  try {
    const body: CreateRoomRequest = await request.json()

    if (!body.playerName?.trim()) {
      return NextResponse.json({ error: '请输入玩家名称' }, { status: 400 })
    }
    if (!body.genre) {
      return NextResponse.json({ error: '请选择故事类型' }, { status: 400 })
    }

    const store = getStore()
    const result = await store.createRoom(body)

    return NextResponse.json(result)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('Create room error:', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
