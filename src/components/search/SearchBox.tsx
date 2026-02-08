'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Search, X, Loader2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { useDebounce } from '@/hooks/useDebounce'

interface SearchResult {
  id: string
  title: string
  slug: string
  excerpt: string
  type: 'video' | 'article'
  cover_image: string
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
  
  // 使用防抖 hook，延迟 300ms
  const debouncedQuery = useDebounce(query, 300)

  // 点击外部关闭搜索结果
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowResults(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // 搜索功能 - 使用防抖后的查询值
  useEffect(() => {
    async function performSearch() {
      // 取消之前的请求
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
      
      // 创建新的 AbortController
      abortControllerRef.current = new AbortController()
      
      if (debouncedQuery.trim().length < 2) {
        setResults([])
        setLoading(false)
        return
      }

      setLoading(true)
      const searchTerm = debouncedQuery.trim()
      
      try {
        const { data, error } = await supabase
          .from('posts')
          .select('id, title, slug, excerpt, type, cover_image')
          .eq('status', 'published')
          .or(`title.ilike.%${searchTerm}%,excerpt.ilike.%${searchTerm}%,content.ilike.%${searchTerm}%`)
          .limit(8)
          .abortSignal(abortControllerRef.current.signal)

        if (!error && data) {
          setResults(data as SearchResult[])
        }
      } catch (err) {
        // 忽略取消的请求错误
        if (err instanceof Error && err.name === 'AbortError') {
          return
        }
        console.error('Search error:', err)
      } finally {
        setLoading(false)
      }
    }

    performSearch()

    // 清理函数
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

  function handleResultClick(slug: string, type: string) {
    const path = type === 'video' ? `/videos/${slug}` : `/posts/${slug}`
    router.push(path)
    setShowResults(false)
    setQuery('')
  }

  function clearSearch() {
    setQuery('')
    setResults([])
    inputRef.current?.focus()
  }

  return (
    <div ref={containerRef} className="relative w-full max-w-md">
      <form onSubmit={handleSubmit} className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          ref={inputRef}
          type="text"
          placeholder="搜索文章或视频..."
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

      {/* 搜索结果下拉框 */}
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
                  key={result.id}
                  onClick={() => handleResultClick(result.slug, result.type)}
                  className="w-full flex items-center gap-3 p-3 hover:bg-secondary transition-colors text-left"
                >
                  <div className="w-12 h-12 rounded-lg overflow-hidden bg-secondary flex-shrink-0">
                    {result.cover_image ? (
                      <img
                        src={result.cover_image}
                        alt={result.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">
                        无图
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-sm truncate">{result.title}</h4>
                    <p className="text-xs text-muted-foreground truncate">
                      {result.excerpt || '暂无描述'}
                    </p>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded ${
                    result.type === 'video' 
                      ? 'bg-purple-500/20 text-purple-500' 
                      : 'bg-blue-500/20 text-blue-500'
                  }`}>
                    {result.type === 'video' ? '视频' : '文章'}
                  </span>
                </button>
              ))}
              <div className="p-2 border-t border-border">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="w-full"
                  onClick={handleSubmit}
                >
                  查看全部搜索结果
                </Button>
              </div>
            </div>
          ) : (
            <div className="py-8 text-center text-muted-foreground text-sm">
              未找到相关内容
            </div>
          )}
        </div>
      )}
    </div>
  )
}
