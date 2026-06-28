import { StoryEntry, StoryClubStore } from './store'

interface StoreData {
  stories: StoryEntry[]
}

const DATA_DIR = '.data'
const DATA_FILE = 'storyclub-store.json'

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

function generateId(): string {
  return crypto.randomUUID?.() ?? Math.random().toString(36).slice(2, 15)
}

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

let instance: StoryClubStore | null = null

export function getStoryClubStore(): StoryClubStore {
  if (!instance) {
    instance = new MemoryStoryClubStore()
  }
  return instance
}
