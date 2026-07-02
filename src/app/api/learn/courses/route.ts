import { NextResponse } from 'next/server'
import { COURSES } from '@/learn/courses'

export async function GET() {
  return NextResponse.json({ courses: COURSES })
}
