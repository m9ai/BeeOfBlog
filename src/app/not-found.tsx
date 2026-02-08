import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Home, Search, ArrowLeft } from 'lucide-react'

export default function NotFoundPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        {/* Bee Mascot */}
        <div className="text-8xl mb-6">🐝</div>
        
        {/* 404 Title */}
        <h1 className="text-6xl font-bold mb-4 bg-gradient-to-r from-yellow-500 to-orange-500 bg-clip-text text-transparent">
          404
        </h1>
        
        {/* Subtitle */}
        <h2 className="text-2xl font-semibold mb-2 text-foreground">
          页面飞走了
        </h2>
        
        {/* Description */}
        <p className="text-muted-foreground mb-8">
          小蜜蜂找遍了整个洋泾，也没发现这个页面<br />
          也许它去采蜜了，稍后再来看看吧～
        </p>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/">
            <Button className="gap-2 w-full sm:w-auto">
              <Home className="w-4 h-4" />
              返回首页
            </Button>
          </Link>
          <Button 
            variant="outline" 
            className="gap-2 w-full sm:w-auto"
            onClick={() => window.history.back()}
          >
            <ArrowLeft className="w-4 h-4" />
            返回上一页
          </Button>
        </div>

        {/* Search Suggestion */}
        <div className="mt-8 p-4 bg-secondary/50 rounded-lg">
          <p className="text-sm text-muted-foreground mb-2">
            或者试试搜索你想找的内容？
          </p>
          <Link href="/">
            <Button variant="ghost" size="sm" className="gap-2 text-primary">
              <Search className="w-4 h-4" />
              去首页搜索
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
