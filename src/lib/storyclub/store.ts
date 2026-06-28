import type { Genre } from '@/lib/ai/types'

export interface StoryEntry {
  id: string
  genre: Genre | string
  title: string
  content: string
  author: string
  userId?: string
  createdAt: number
}

export interface StoryClubStore {
  list(): Promise<StoryEntry[]>
  add(entry: Omit<StoryEntry, 'id' | 'createdAt'>): Promise<StoryEntry>
  remove(id: string, userId: string): Promise<boolean>
}
