import { NextRequest, NextResponse } from 'next/server'
import { getStore } from '@/lib/multiplayer/store'
import type { JoinRoomRequest } from '@/lib/multiplayer/types'

export async function POST(request: NextRequest) {
  try {
    const body: JoinRoomRequest = await request.json()

    if (!body.roomCode?.trim()) {
      return NextResponse.json({ error: '请输入房间号' }, { status: 400 })
    }
    if (!body.playerName?.trim()) {
      return NextResponse.json({ error: '请输入玩家名称' }, { status: 400 })
    }

    const code = body.roomCode.trim().toUpperCase()
    const store = getStore()

    // Check room exists
    const room = await store.getRoom(code)
    if (!room) {
      return NextResponse.json({ error: '房间不存在' }, { status: 404 })
    }
    if (room.status !== 'waiting') {
      return NextResponse.json({ error: '游戏已经开始，无法加入' }, { status: 400 })
    }

    const result = await store.joinRoom(code, body.playerName.trim())
    return NextResponse.json(result)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('Join room error:', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
