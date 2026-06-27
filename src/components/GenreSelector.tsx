'use client'

import { Genre, GENRE_NAMES } from '@/lib/ai/types'

const GENRES: Genre[] = ['fantasy', 'sci-fi', 'mystery', 'historical', 'horror', 'martial-arts']

export default function GenreSelector({
  selected,
  onSelect,
}: {
  selected: Genre | null
  onSelect: (genre: Genre) => void
}) {
  return (
    <div className="flex flex-wrap justify-center gap-x-8 gap-y-4">
      {GENRES.map((genre) => (
        <button
          key={genre}
          onClick={() => onSelect(genre)}
          className={`relative text-sm tracking-wider transition-all duration-200 pb-0.5 ${
            selected === genre
              ? 'text-zinc-800'
              : 'text-zinc-400 hover:text-zinc-600'
          }`}
        >
          {GENRE_NAMES[genre]}
          {selected === genre && (
            <span className="absolute bottom-0 left-0 right-0 h-px bg-zinc-800" />
          )}
        </button>
      ))}
    </div>
  )
}
