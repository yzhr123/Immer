import { NextRequest, NextResponse } from 'next/server'
import { getStore } from '@/lib/multiplayer/store'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const roomCode = body.roomCode as string | undefined
    const playerId = body.playerId as string | undefined

    if (!roomCode?.trim()) {
      return NextResponse.json({ error: 'Missing roomCode' }, { status: 400 })
    }
    if (!playerId?.trim()) {
      return NextResponse.json({ error: 'Missing playerId' }, { status: 400 })
    }

    const store = getStore()
    await store.removePlayer(roomCode.trim().toUpperCase(), playerId)

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('Leave room error:', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
