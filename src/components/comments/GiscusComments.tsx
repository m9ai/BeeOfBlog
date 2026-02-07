'use client'

import { useEffect, useRef, useState } from 'react'
import { MessageCircle, AlertCircle } from 'lucide-react'

interface GiscusCommentsProps {
  slug: string
}

export function GiscusComments({ slug }: GiscusCommentsProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!ref.current) return

    // Giscus 配置 - 需要替换为您的 GitHub 仓库信息
    // 配置步骤：
    // 1. 在 GitHub 仓库安装 Giscus 应用: https://github.com/apps/giscus
    // 2. 在仓库设置中启用 Discussions
    // 3. 在 https://giscus.app/ 获取配置信息
    const GISCUS_CONFIG = {
      repo: 'your-username/your-repo', // 替换为您的仓库
      repoId: 'R_kgD-your-repo-id', // 替换为仓库ID
      category: 'Announcements', // 替换为分类名称
      categoryId: 'DIC_kwD-your-category-id', // 替换为分类ID
    }

    // 检查是否已配置
    if (GISCUS_CONFIG.repo.includes('your-')) {
      setError(true)
      return
    }

    const script = document.createElement('script')
    script.src = 'https://giscus.app/client.js'
    script.setAttribute('data-repo', GISCUS_CONFIG.repo)
    script.setAttribute('data-repo-id', GISCUS_CONFIG.repoId)
    script.setAttribute('data-category', GISCUS_CONFIG.category)
    script.setAttribute('data-category-id', GISCUS_CONFIG.categoryId)
    script.setAttribute('data-mapping', 'specific')
    script.setAttribute('data-term', slug)
    script.setAttribute('data-strict', '0')
    script.setAttribute('data-reactions-enabled', '1')
    script.setAttribute('data-emit-metadata', '0')
    script.setAttribute('data-input-position', 'bottom')
    script.setAttribute('data-theme', 'dark')
    script.setAttribute('data-lang', 'zh-CN')
    script.setAttribute('crossorigin', 'anonymous')
    script.async = true

    ref.current.appendChild(script)

    return () => {
      if (ref.current) {
        ref.current.innerHTML = ''
      }
    }
  }, [slug])

  if (error) {
    return (
      <div className="mt-8 p-6 rounded-xl bg-secondary/30 border border-border/50">
        <div className="flex items-center gap-2 mb-3">
          <MessageCircle className="w-5 h-5 text-muted-foreground" />
          <h3 className="text-lg font-semibold">评论</h3>
        </div>
        <div className="flex items-start gap-3 p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
          <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-yellow-700 dark:text-yellow-300">
            <p className="font-medium mb-1">评论功能待配置</p>
            <p className="text-yellow-600/80 dark:text-yellow-400/80">
              请配置 Giscus 评论系统以启用评论功能。
            </p>
            <a 
              href="https://giscus.app/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 mt-2 text-primary hover:underline"
            >
              前往 Giscus 配置 →
            </a>
          </div>
        </div>
      </div>
    )
  }

  return <div ref={ref} className="mt-8" />
}
