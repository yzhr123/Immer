import { NextRequest, NextResponse } from 'next/server'
import {
  getStoryClubStore,
} from '@/lib/storyclub/store-server'

export async function GET() {
  try {
    const store = getStoryClubStore()
    const stories = await store.list()
    return NextResponse.json({ stories })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    const isBlobError =
      message.includes('Netlify Blob') || message.includes('MissingBlobsEnvironmentError')
    return NextResponse.json(
      {
        error: isBlobError
          ? '存储服务未配置：请在 Netlify 后台启用 Blob 存储（Site Settings → Functions → Netlify Blobs）'
          : message,
      },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { genre, title, content, author, userId } = body

    if (!genre || !title || !content || !author) {
      return NextResponse.json(
        { error: '参数不完整：需要 genre, title, content, author' },
        { status: 400 },
      )
    }

    const store = getStoryClubStore()
    const entry = await store.add({ genre, title, content, author, userId })
    return NextResponse.json({ story: entry }, { status: 201 })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    const isBlobError =
      message.includes('Netlify Blob') || message.includes('writeBlob failed')
    return NextResponse.json(
      {
        error: isBlobError
          ? '保存失败：Netlify Blob 存储未正确配置，请在 Netlify 后台启用 Blob 存储'
          : message,
      },
      { status: 500 },
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const userId = searchParams.get('userId')

    if (!id) {
      return NextResponse.json({ error: '缺少 story id' }, { status: 400 })
    }
    if (!userId) {
      return NextResponse.json({ error: '缺少 userId' }, { status: 400 })
    }

    const store = getStoryClubStore()
    const removed = await store.remove(id, userId)
    if (!removed) {
      return NextResponse.json(
        { error: '故事不存在或无权删除' },
        { status: 403 },
      )
    }
    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
