import { getStore } from '@netlify/blobs'

const STORE_NAME = 'immer-data'

function isNetlify(): boolean {
  return process.env.NETLIFY === 'true'
}

let blobStore: ReturnType<typeof getStore> | null = null

function getBlobStore(): ReturnType<typeof getStore> | null {
  if (blobStore) return blobStore
  if (!isNetlify()) return null
  try {
    blobStore = getStore(STORE_NAME)
    return blobStore
  } catch {
    return null
  }
}

export async function readBlob<T = string>(key: string): Promise<T | null> {
  const store = getBlobStore()
  if (!store) return null
  try {
    const raw = await store.get(key, { type: 'text' })
    if (raw == null) return null
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

export async function writeBlob(key: string, value: unknown): Promise<boolean> {
  const store = getBlobStore()
  if (!store) return false
  try {
    await store.set(key, JSON.stringify(value))
    return true
  } catch {
    return false
  }
}

export async function deleteBlob(key: string): Promise<boolean> {
  const store = getBlobStore()
  if (!store) return false
  try {
    await store.delete(key)
    return true
  } catch {
    return false
  }
}
