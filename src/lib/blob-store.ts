import { getStore } from '@netlify/blobs'

const STORE_NAME = 'immer-data'

function isNetlify(): boolean {
  return process.env.NETLIFY === 'true'
}

let blobStore: ReturnType<typeof getStore> | null = null

function getBlobStore(): ReturnType<typeof getStore> | null {
  if (blobStore) return blobStore
  if (!isNetlify()) {
    // Not on Netlify — blob store is unavailable, caller should fall back to
    // file-based storage (MemoryStoryClubStore handles this internally).
    return null
  }
  try {
    blobStore = getStore(STORE_NAME)
    return blobStore
  } catch (err) {
    console.error(
      '[blob-store] Failed to initialise Netlify Blob store "%s".',
      STORE_NAME,
      '\n  Cause:',
      err instanceof Error ? err.message : String(err),
      '\n  → If you are on Netlify, make sure Netlify Blobs are enabled for this site.',
      '\n  → If you are not on Netlify, this error is expected — the MemoryStoryClubStore fallback is used instead.',
    )
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
  } catch (err) {
    console.error(
      '[blob-store] Failed to read key "%s".',
      key,
      '\n  Cause:',
      err instanceof Error ? err.message : String(err),
    )
    return null
  }
}

export async function writeBlob(key: string, value: unknown): Promise<boolean> {
  const store = getBlobStore()
  if (!store) return false
  try {
    const result = await store.set(key, JSON.stringify(value))
    if (!result.modified) {
      console.warn(
        '[blob-store] writeBlob: store.set returned modified=false for key "%s".',
        key,
      )
    }
    return true
  } catch (err) {
    console.error(
      '[blob-store] Failed to write key "%s".',
      key,
      '\n  Cause:',
      err instanceof Error ? err.message : String(err),
    )
    return false
  }
}

export async function deleteBlob(key: string): Promise<boolean> {
  const store = getBlobStore()
  if (!store) return false
  try {
    await store.delete(key)
    return true
  } catch (err) {
    console.error(
      '[blob-store] Failed to delete key "%s".',
      key,
      '\n  Cause:',
      err instanceof Error ? err.message : String(err),
    )
    return false
  }
}

export async function listBlobs(prefix: string): Promise<string[]> {
  const store = getBlobStore()
  if (!store) return []
  try {
    const { blobs } = await store.list({ prefix })
    return blobs.map((b) => b.key)
  } catch (err) {
    console.error(
      '[blob-store] Failed to list blobs with prefix "%s".',
      prefix,
      '\n  Cause:',
      err instanceof Error ? err.message : String(err),
    )
    return []
  }
}
