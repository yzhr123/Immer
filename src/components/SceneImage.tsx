'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'

export default function SceneImage({ url, alt }: { url: string; alt: string }) {
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState(false)

  if (!url || error) {
    return (
      <div className="w-full aspect-[16/9] bg-zinc-50 rounded-sm border border-zinc-100 flex items-center justify-center">
        <span className="text-xs text-zinc-300 tracking-wider">NO IMAGE</span>
      </div>
    )
  }

  return (
    <div className="relative w-full aspect-[16/9] overflow-hidden rounded-sm bg-zinc-50">
      {!loaded && (
        <div className="absolute inset-0 bg-gradient-to-r from-zinc-100 via-zinc-50 to-zinc-100 bg-[length:200%_100%] animate-shimmer" />
      )}
      <img
        src={url}
        alt={alt}
        onLoad={() => setLoaded(true)}
        onError={() => setError(true)}
        className={cn(
          'w-full h-full object-cover transition-opacity duration-700',
          loaded ? 'opacity-100' : 'opacity-0',
        )}
      />
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-black/30 via-transparent to-transparent" />
    </div>
  )
}
