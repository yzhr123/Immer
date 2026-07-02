import { NextRequest, NextResponse } from 'next/server'
import { readFile, writeFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'
import type { LearnProgress } from '@/learn/types'

const DATA_DIR = path.join(process.cwd(), '.data')
const FILE = path.join(DATA_DIR, 'learn-progress.json')

async function readProgresses(): Promise<Record<string, LearnProgress>> {
  try {
    const raw = await readFile(FILE, 'utf-8')
    return JSON.parse(raw)
  } catch {
    return {}
  }
}

async function writeProgresses(data: Record<string, LearnProgress>) {
  if (!existsSync(DATA_DIR)) await mkdir(DATA_DIR, { recursive: true })
  await writeFile(FILE, JSON.stringify(data, null, 2), 'utf-8')
}

export async function GET(request: NextRequest) {
  const courseId = request.nextUrl.searchParams.get('courseId')
  const all = await readProgresses()
  if (courseId) {
    return NextResponse.json(all[courseId] || null)
  }
  return NextResponse.json(all)
}

export async function POST(request: NextRequest) {
  try {
    const { courseId, progress } = await request.json()
    if (!courseId || !progress) {
      return NextResponse.json({ error: '缺少参数' }, { status: 400 })
    }
    const all = await readProgresses()
    all[courseId] = progress
    await writeProgresses(all)
    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
