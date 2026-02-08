'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Loader2 } from 'lucide-react'

interface PageTransitionProps {
  children: React.ReactNode
}

export function PageTransition({ children }: PageTransitionProps) {
  const pathname = usePathname()
  const [isLoading, setIsLoading] = useState(false)
  const [displayChildren, setDisplayChildren] = useState(children)

  useEffect(() => {
    // 当路径变化时显示加载状态
    setIsLoading(true)
    
    // 使用 requestAnimationFrame 确保加载动画能显示
    const timer = requestAnimationFrame(() => {
      setDisplayChildren(children)
      
      // 短暂延迟后隐藏加载状态，给用户视觉反馈
      setTimeout(() => {
        setIsLoading(false)
      }, 300)
    })

    return () => cancelAnimationFrame(timer)
  }, [pathname, children])

  return (
    <div className="relative">
      {/* 页面内容 */}
      <AnimatePresence mode="wait">
        <motion.div
          key={pathname}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{
            duration: 0.3,
            ease: [0.25, 0.1, 0.25, 1]
          }}
        >
          {displayChildren}
        </motion.div>
      </AnimatePresence>

      {/* 加载遮罩 */}
      <AnimatePresence>
        {isLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="flex flex-col items-center gap-4"
            >
              {/* 自定义加载动画 - 小蜜蜂 */}
              <div className="relative">
                <motion.div
                  animate={{
                    rotate: [0, -10, 10, -10, 10, 0],
                    y: [0, -5, 0, -5, 0]
                  }}
                  transition={{
                    duration: 1.5,
                    repeat: Infinity,
                    ease: "easeInOut"
                  }}
                  className="text-4xl"
                >
                  🐝
                </motion.div>
                {/* 翅膀动画 */}
                <motion.div
                  animate={{
                    opacity: [0.5, 1, 0.5],
                    scale: [1, 1.2, 1]
                  }}
                  transition={{
                    duration: 0.3,
                    repeat: Infinity,
                    ease: "easeInOut"
                  }}
                  className="absolute -top-1 -left-2 text-2xl"
                >
                  ✨
                </motion.div>
                <motion.div
                  animate={{
                    opacity: [0.5, 1, 0.5],
                    scale: [1, 1.2, 1]
                  }}
                  transition={{
                    duration: 0.3,
                    repeat: Infinity,
                    ease: "easeInOut",
                    delay: 0.15
                  }}
                  className="absolute -top-1 -right-2 text-2xl"
                >
                  ✨
                </motion.div>
              </div>
              <p className="text-sm text-muted-foreground animate-pulse">
                加载中...
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
