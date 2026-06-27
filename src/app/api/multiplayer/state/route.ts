import { NextRequest, NextResponse } from 'next/server'
import { getStore } from '@/lib/multiplayer/store'

export async function GET(request: NextRequest) {
  try {
    const roomCode = request.nextUrl.searchParams.get('roomCode')
    if (!roomCode) {
      return NextResponse.json({ error: 'Missing roomCode' }, { status: 400 })
    }

    const store = getStore()
    const room = await store.getRoom(roomCode.toUpperCase())
    if (!room) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 })
    }

    return NextResponse.json({ room, ts: Date.now() })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('State poll error:', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
