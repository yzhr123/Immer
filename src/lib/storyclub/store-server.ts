import { StoryEntry, StoryClubStore } from './store'
import { readBlob, writeBlob, deleteBlob, listBlobs } from '@/lib/blob-store'

interface StoreData {
  stories: StoryEntry[]
}

const DATA_DIR = '.data'
const DATA_FILE = 'storyclub-store.json'

/* ============================================================
 *  File persistence helpers (local dev)
 * ============================================================ */

function getDataFilePath(): string {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const path = require('path')
  return path.join(process.cwd(), DATA_DIR, DATA_FILE)
}

function loadStoreData(): StoreData | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require('fs')
    const filePath = getDataFilePath()
    if (!fs.existsSync(filePath)) return null
    const raw = fs.readFileSync(filePath, 'utf-8')
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function saveStoreData(data: StoreData): void {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require('fs')
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const path = require('path')
    const dir = path.join(process.cwd(), DATA_DIR)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(getDataFilePath(), JSON.stringify(data, null, 2))
  } catch (e) {
    console.error('Failed to persist story club store:', e)
  }
}

/* ============================================================
 *  Utils
 * ============================================================ */

function generateId(): string {
  return crypto.randomUUID?.() ?? Math.random().toString(36).slice(2, 15)
}

function isNetlify(): boolean {
  return process.env.NETLIFY === 'true'
}

/* ============================================================
 *  MemoryStoryClubStore — local file persistence
 * ============================================================ */

export class MemoryStoryClubStore implements StoryClubStore {
  private stories: StoryEntry[]

  constructor() {
    this.stories = []
    this.loadFromDisk()
  }

  private loadFromDisk(): void {
    const data = loadStoreData()
    if (!data) return
    this.stories = data.stories
  }

  private persist(): void {
    saveStoreData({ stories: this.stories })
  }

  async list(): Promise<StoryEntry[]> {
    return [...this.stories].reverse()
  }

  async add(entry: Omit<StoryEntry, 'id' | 'createdAt'>): Promise<StoryEntry> {
    const story: StoryEntry = {
      ...entry,
      id: generateId(),
      createdAt: Date.now(),
    }
    this.stories.push(story)
    this.persist()
    return story
  }

  async remove(id: string, userId: string): Promise<boolean> {
    const idx = this.stories.findIndex((s) => s.id === id)
    if (idx === -1) return false
    const story = this.stories[idx]
    if (story.userId && story.userId !== userId) return false
    this.stories.splice(idx, 1)
    this.persist()
    return true
  }
}

/* ============================================================
 *  NetlifyBlobStoryClubStore — Netlify Blob persistence
 *
 *  Each story stored under its own key:  storyclub:{id}
 *  No read-modify-write cycle → no race condition between
 *  concurrent serverless function instances.
 * ============================================================ */

const BLOB_PREFIX = 'storyclub:'

function storyKey(id: string): string {
  return `${BLOB_PREFIX}${id}`
}

export class NetlifyBlobStoryClubStore implements StoryClubStore {
  async list(): Promise<StoryEntry[]> {
    const keys = await listBlobs(BLOB_PREFIX)
    if (keys.length === 0) return []

    const stories: StoryEntry[] = (
      await Promise.all(keys.map((key) => readBlob<StoryEntry>(key)))
    ).filter((s): s is StoryEntry => s !== null)

    if (stories.length !== keys.length) {
      console.warn(
        '[NetlifyBlobStoryClubStore] list(): %d of %d blobs could not be parsed.',
        keys.length - stories.length,
        keys.length,
      )
    }

    return stories.sort((a, b) => b.createdAt - a.createdAt)
  }

  async add(entry: Omit<StoryEntry, 'id' | 'createdAt'>): Promise<StoryEntry> {
    const story: StoryEntry = {
      ...entry,
      id: generateId(),
      createdAt: Date.now(),
    }
    const ok = await writeBlob(storyKey(story.id), story)
    if (!ok) {
      throw new Error(
        `NetlifyBlobStoryClubStore.add(): writeBlob failed for story "${story.id}". ` +
          'Check Netlify function logs for details.',
      )
    }
    return story
  }

  async remove(id: string, userId: string): Promise<boolean> {
    const key = storyKey(id)
    const story = await readBlob<StoryEntry>(key)
    if (!story) {
      console.warn(
        '[NetlifyBlobStoryClubStore] remove(): story "%s" not found or could not be read.',
        id,
      )
      return false
    }
    if (story.userId && story.userId !== userId) return false
    const ok = await deleteBlob(key)
    if (!ok) {
      console.warn(
        '[NetlifyBlobStoryClubStore] remove(): deleteBlob returned false for key "%s".',
        key,
      )
      return false
    }
    return true
  }
}

/* ============================================================
 *  Singleton Resolver
 * ============================================================ */

let instance: StoryClubStore | null = null

export function getStoryClubStore(): StoryClubStore {
  if (!instance) {
    instance = isNetlify()
      ? new NetlifyBlobStoryClubStore()
      : new MemoryStoryClubStore()
  }
  return instance
}
