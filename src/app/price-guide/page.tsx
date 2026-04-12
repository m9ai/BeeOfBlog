'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Droplets, Bus, Taxi, Ship, Tv, CreditCard, Stethoscope, GraduationCap, Mountain, Road, CircleAlert, ParkingCircle, Home, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

interface PriceItem {
  id: string
  name: string
  description?: string
  unit?: string
  price?: string
  notes?: string
}

interface PriceCategory {
  id: string
  name: string
  icon: string
  items: PriceItem[]
}

interface PriceGuideData {
  updateDate: string
  categories: PriceCategory[]
}

const iconMap: Record<string, React.ReactNode> = {
  '💧': <Droplets className="w-5 h-5" />,
  '🚌': <Bus className="w-5 h-5" />,
  '🚕': <Taxi className="w-5 h-5" />,
  '⛴️': <Ship className="w-5 h-5" />,
  '📺': <Tv className="w-5 h-5" />,
  '🪪': <CreditCard className="w-5 h-5" />,
  '🏥': <Stethoscope className="w-5 h-5" />,
  '🎓': <GraduationCap className="w-5 h-5" />,
  '🏞️': <Mountain className="w-5 h-5" />,
  '🛣️': <Road className="w-5 h-5" />,
  '🚑': <CircleAlert className="w-5 h-5" />,
  '🅿️': <ParkingCircle className="w-5 h-5" />,
  '🏠': <Home className="w-5 h-5" />,
}

export default function PriceGuidePage() {
  const [data, setData] = useState<PriceGuideData | null>(null)
  const [activeCategory, setActiveCategory] = useState<string>('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const res = await fetch('/feeds/price_guide.json')
      if (res.ok) {
        const savedData = await res.json()
        setData(savedData)
        if (savedData.categories?.length > 0) {
          setActiveCategory(savedData.categories[0].id)
        }
      }
    } catch (error) {
      console.error('加载数据失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const activeItems = data?.categories.find(c => c.id === activeCategory)?.items || []
  const activeCategoryName = data?.categories.find(c => c.id === activeCategory)?.name || ''
  const activeIcon = data?.categories.find(c => c.id === activeCategory)?.icon || ''

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted-foreground">加载中...</div>
      </div>
    )
  }

  if (!data || data.categories.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted-foreground">暂无数据</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header - 固定顶部 */}
      <header className="bg-green-500 text-white sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <Link href="/">
              <Button variant="ghost" size="icon" className="text-white hover:bg-green-600">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div className="flex-1 text-center">
              <h1 className="text-xl font-bold">上海物价指南</h1>
              <p className="text-sm text-green-100">上海市市民价格信息指南 · {data.updateDate}</p>
            </div>
            <div className="w-10" /> {/* 占位保持居中 */}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row min-h-[calc(100vh-80px)]">
          {/* Left Sidebar - 固定左侧 */}
          <aside className="w-full md:w-64 bg-white border-r border-gray-200 md:sticky md:top-[80px] md:h-[calc(100vh-80px)] md:overflow-y-auto flex-shrink-0">
            <nav className="p-4 space-y-2">
              {data.categories.map((category) => (
                <button
                  key={category.id}
                  onClick={() => setActiveCategory(category.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors ${
                    activeCategory === category.id
                      ? 'bg-green-50 text-green-700 border border-green-200'
                      : 'hover:bg-gray-50 text-gray-700'
                  }`}
                >
                  <span className="text-green-500">
                    {iconMap[category.icon] || category.icon}
                  </span>
                  <span className="text-sm font-medium">{category.name}</span>
                </button>
              ))}
            </nav>
          </aside>

          {/* Right Content - 独立滚动 */}
          <main className="flex-1 p-4 md:p-6 overflow-y-auto">
            <div className="max-w-3xl mx-auto">
              {/* Category Header */}
              <div className="flex items-center gap-3 mb-6">
                <span className="text-3xl">{activeIcon}</span>
                <h2 className="text-xl font-bold text-gray-900">{activeCategoryName}</h2>
              </div>

              {/* Price Items */}
              <div className="space-y-3">
                {activeItems.map((item) => (
                  <Card key={item.id} className="bg-white border-0 shadow-sm">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-gray-900 mb-1">{item.name}</h3>
                          {item.description && (
                            <p className="text-sm text-gray-500">{item.description}</p>
                          )}
                        </div>
                        <div className="text-right flex-shrink-0">
                          <div className="flex items-baseline gap-1 justify-end">
                            <span className="text-lg font-bold text-green-600">{item.price}</span>
                            {item.unit && (
                              <span className="text-sm text-gray-500">/{item.unit}</span>
                            )}
                          </div>
                        </div>
                      </div>
                      {item.notes && (
                        <div className="mt-2 pt-2 border-t border-gray-100">
                          <p className="text-xs text-gray-400">{item.notes}</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>

              {activeItems.length === 0 && (
                <div className="text-center py-12 text-gray-400">
                  该分类暂无价格数据
                </div>
              )}

              {/* Footer Info */}
              <div className="mt-8 text-center text-xs text-gray-400">
                <p>数据来源：上海市发展和改革委员会</p>
                <p className="mt-1">更新时间：{data.updateDate}</p>
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}
