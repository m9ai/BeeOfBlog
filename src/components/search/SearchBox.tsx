'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Search, X, Loader2, Heart, FileText, Video } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { useDebounce } from '@/hooks/useDebounce'
import { Badge } from '@/components/ui/badge'

interface PostResult {
  id: string
  title: string
  excerpt: string | null
  type: 'video' | 'article'
  cover_image: string | null
  source: 'post'
}

interface WishlistResult {
  id: string
  title: string
  content: string
  category: 'old_renovation' | 'municipal' | 'cooperation' | 'other'
  status: 'pending' | 'processing' | 'completed' | 'rejected'
  source: 'wishlist'
}

type SearchResult = PostResult | WishlistResult

const categoryLabels: Record<string, string> = {
  old_renovation: '小区旧改',
  municipal: '市政工程',
  cooperation: '本地合作',
  other: '其他',
}

const statusLabels: Record<string, string> = {
  pending: '待处理',
  processing: '处理中',
  completed: '已完成',
  rejected: '已拒绝',
}

export function SearchBox() {
  const router = useRouter()
  const supabase = createClient()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  const debouncedQuery = useDebounce(query, 300)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowResults(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    async function performSearch() {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
      abortControllerRef.current = new AbortController()

      if (debouncedQuery.trim().length < 2) {
        setResults([])
        setLoading(false)
        return
      }

      setLoading(true)
      const searchTerm = debouncedQuery.trim()

      try {
        const [postsResult, wishlistResult] = await Promise.all([
          supabase
            .from('posts')
            .select('id, title, excerpt, type, cover_image')
            .eq('status', 'published')
            .or(`title.ilike.%${searchTerm}%,excerpt.ilike.%${searchTerm}%,content.ilike.%${searchTerm}%`)
            .limit(5)
            .abortSignal(abortControllerRef.current.signal),
          supabase
            .from('wishlist')
            .select('id, title, content, category, status')
            .or(`title.ilike.%${searchTerm}%,content.ilike.%${searchTerm}%`)
            .limit(3)
            .abortSignal(abortControllerRef.current.signal),
        ])

        const combinedResults: SearchResult[] = []

        if (!postsResult.error && postsResult.data) {
          combinedResults.push(
            ...postsResult.data.map((item) => ({ ...item, source: 'post' as const }))
          )
        }

        if (!wishlistResult.error && wishlistResult.data) {
          combinedResults.push(
            ...wishlistResult.data.map((item) => ({ ...item, source: 'wishlist' as const }))
          )
        }

        setResults(combinedResults)
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          return
        }
        console.error('Search error:', err)
      } finally {
        setLoading(false)
      }
    }

    performSearch()

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [debouncedQuery, supabase])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (query.trim()) {
      router.push(`/search?q=${encodeURIComponent(query.trim())}`)
      setShowResults(false)
    }
  }

  function handleResultClick(result: SearchResult) {
    if (result.source === 'post') {
      const path = result.type === 'video' ? `/videos/${result.id}` : `/posts/${result.id}`
      router.push(path)
    } else {
      router.push(`/wishlist/${result.id}`)
    }
    setShowResults(false)
    setQuery('')
  }

  function clearSearch() {
    setQuery('')
    setResults([])
    inputRef.current?.focus()
  }

  function getResultIcon(result: SearchResult) {
    if (result.source === 'wishlist') {
      return <Heart className="w-4 h-4 text-red-500" />
    }
    return result.type === 'video' ? (
      <Video className="w-4 h-4 text-purple-500" />
    ) : (
      <FileText className="w-4 h-4 text-blue-500" />
    )
  }

  function getResultBadge(result: SearchResult) {
    if (result.source === 'wishlist') {
      return (
        <Badge variant="outline" className="text-xs">
          <Heart className="w-3 h-3 mr-1 text-red-500" />
          心愿单
        </Badge>
      )
    }
    return (
      <Badge
        variant="outline"
        className={`text-xs ${
          result.type === 'video'
            ? 'bg-purple-500/10 text-purple-600 border-purple-200'
            : 'bg-blue-500/10 text-blue-600 border-blue-200'
        }`}
      >
        {result.type === 'video' ? '视频' : '文章'}
      </Badge>
    )
  }

  return (
    <div ref={containerRef} className="relative w-full max-w-md">
      <form onSubmit={handleSubmit} className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          ref={inputRef}
          type="text"
          placeholder="搜索文章、视频或心愿单..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setShowResults(true)
          }}
          onFocus={() => setShowResults(true)}
          className="pl-10 pr-10 w-full"
        />
        {query && (
          <button
            type="button"
            onClick={clearSearch}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </form>

      {showResults && query.trim().length >= 2 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-background border border-border rounded-lg shadow-lg overflow-hidden z-50">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : results.length > 0 ? (
            <div className="max-h-96 overflow-y-auto">
              {results.map((result) => (
                <button
                  key={`${result.source}-${result.id}`}
                  onClick={() => handleResultClick(result)}
                  className="w-full flex items-center gap-3 p-3 hover:bg-secondary transition-colors text-left"
                >
                  <div className="w-12 h-12 rounded-lg overflow-hidden bg-secondary flex-shrink-0 flex items-center justify-center">
                    {result.source === 'post' && result.cover_image ? (
                      <img
                        src={result.cover_image}
                        alt={result.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        {getResultIcon(result)}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-sm truncate">{result.title}</h4>
                    <p className="text-xs text-muted-foreground truncate">
                      {result.source === 'post'
                        ? result.excerpt || '暂无描述'
                        : result.content.slice(0, 50) + '...'}
                    </p>
                  </div>
                  {getResultBadge(result)}
                </button>
              ))}
              <div className="p-2 border-t border-border">
                <Button variant="ghost" size="sm" className="w-full" onClick={handleSubmit}>
                  查看全部搜索结果
                </Button>
              </div>
            </div>
          ) : (
            <div className="py-8 text-center text-muted-foreground text-sm">未找到相关内容</div>
          )}
        </div>
      )}
    </div>
  )
}
