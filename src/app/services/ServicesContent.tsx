'use client'

import { useState, useMemo, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { Phone, Building2, Home as HomeIcon, Search, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import jiedaoData from '@/../../public/feeds/jiedao.json'
import xiaoquData from '@/../../public/feeds/xiaoqu.json'

// 获取拼音首字母
function getFirstLetter(str: string): string {
  const code = str.charCodeAt(0)
  if (code >= 0x4e00 && code <= 0x9fa5) {
    // 简单的中文首字母映射（仅用于常见字）
    const pinyin: Record<string, string> = {
      '博': 'B', '翠': 'C', '滨': 'B', '中': 'Z', '东': 'D', '申': 'S', '星': 'X',
      '崮': 'G', '益': 'Y', '罗': 'L', '明': 'M', '张': 'Z', '弘': 'H', '海': 'H',
      '浦': 'P', '泾': 'J', '金': 'J', '沈': 'S', '心': 'X', '双': 'S', '龙': 'L',
      '巨': 'J', '民': 'M', '大': 'D', '凌': 'L', '陆': 'L', '玫': 'M', '名': 'M',
      '珠': 'Z', '环': 'H', '证': 'Z', '八': 'B', '生': 'S', '桃': 'T', '金': 'J',
      '旭': 'X', '雅': 'Y', '和': 'H', '洋': 'Y', '璟': 'J', '森': 'S', '景': 'J',
      '裕': 'Y', '美': 'M', '盛': 'S', '尚': 'S', '馨': 'X', '新': 'X', '花': 'H',
      '城': 'C', '维': 'W', '苗': 'M', '西': 'X', '绿': 'L', '申': 'S', '阳': 'Y',
      '永': 'Y', '羽': 'Y', '南': 'N', '华': 'H', '上': 'S', '河': 'H', '湾': 'W',
      '广': 'G', '国': 'G', '第': 'D', '五': 'W', '二': 'E', '三': 'S', '一': 'Y',
      '四': 'S', '高': 'G', '立': 'L', '园': 'Y', '山': 'S', '水': 'S', '滩': 'T',
      '年': 'N', '郦': 'L', '公': 'G', '寓': 'Y', '庭': 'T', '天': 'T', '家': 'J',
      '北': 'B', '苑': 'Y', '康': 'K', '宅': 'Z', '小': 'X', '区': 'Q', '村': 'C',
      '鼎': 'D', '隆': 'L', '多': 'D', '栖': 'Q', '晶': 'J', '豪': 'H', '门': 'M',
      '悦': 'Y', '铂': 'B', '江': 'J', '丽': 'L'
    }
    return pinyin[str[0]] || '#'
  }
  return '#'
}

// 按首字母分组
function groupByLetter<T extends { name: string }>(items: T[]): Record<string, T[]> {
  const grouped: Record<string, T[]> = {}
  items.forEach(item => {
    const letter = getFirstLetter(item.name)
    if (!grouped[letter]) {
      grouped[letter] = []
    }
    grouped[letter].push(item)
  })
  return grouped
}

type JiedaoContact = {
  name: string
  phone: string
  category: string
  icon: string
  address?: string
}

type XiaoquContact = {
  name: string
  yeweihui: {
    secretary: string
    tel: string
  }
  property: {
    name: string
    manager: string
    phone: string
    address: string
  }
  committee: {
    name: string
    tel: string
  }
}

export default function ServicesContent() {
  const searchParams = useSearchParams()
  const urlQuery = searchParams.get('q') || ''
  
  const [activeTab, setActiveTab] = useState<'jiedao' | 'xiaoqu'>('xiaoqu')
  const [searchQuery, setSearchQuery] = useState(urlQuery)
  const [selectedLetter, setSelectedLetter] = useState<string>('')

  const jiedao: JiedaoContact[] = jiedaoData
  const xiaoqu: XiaoquContact[] = xiaoquData

  // 当 URL 参数变化时更新搜索框
  useEffect(() => {
    if (urlQuery) {
      setSearchQuery(urlQuery)
      // 如果有搜索词，自动切换到对应tab
      const hasXiaoquResult = xiaoqu.some(item =>
        item.name.includes(urlQuery) ||
        item.property.name.includes(urlQuery)
      )
      const hasJiedaoResult = jiedao.some(item =>
        item.name.includes(urlQuery) ||
        item.category.includes(urlQuery)
      )
      if (hasXiaoquResult) {
        setActiveTab('xiaoqu')
      } else if (hasJiedaoResult) {
        setActiveTab('jiedao')
      }
    }
  }, [urlQuery, xiaoqu, jiedao])

  // 分类街道数据
  const categorizedJiedao = useMemo(() => {
    return jiedao.reduce((acc, item) => {
      if (!acc[item.category]) {
        acc[item.category] = []
      }
      acc[item.category].push(item)
      return acc
    }, {} as Record<string, JiedaoContact[]>)
  }, [jiedao])

  // 按首字母分组小区数据
  const groupedXiaoqu = useMemo(() => {
    return groupByLetter(xiaoqu)
  }, [xiaoqu])

  // 获取所有首字母（排序）
  const letters = useMemo(() => {
    return Object.keys(groupedXiaoqu).sort()
  }, [groupedXiaoqu])

  // 过滤街道数据
  const filteredJiedao = searchQuery
    ? jiedao.filter(
        (item) =>
          item.name.includes(searchQuery) ||
          item.phone.includes(searchQuery) ||
          item.category.includes(searchQuery)
      )
    : null

  // 过滤/筛选小区数据
  const displayXiaoqu = useMemo(() => {
    if (searchQuery) {
      // 搜索模式
      return xiaoqu.filter(
        (item) =>
          item.name.includes(searchQuery) ||
          item.property.name.includes(searchQuery) ||
          item.property.phone.includes(searchQuery) ||
          item.committee.name.includes(searchQuery)
      )
    } else if (selectedLetter) {
      // 按字母筛选
      return groupedXiaoqu[selectedLetter] || []
    } else {
      // 默认不显示（提示用户搜索或选择字母）
      return []
    }
  }, [searchQuery, selectedLetter, xiaoqu, groupedXiaoqu])

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* 搜索框和Tab切换 */}
      <div className="mb-8 space-y-4">
        <div className="relative max-w-2xl mx-auto">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <Input
            type="text"
            placeholder="搜索小区名称、物业、电话..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 pr-10 h-12"
          />
          {searchQuery && (
            <button
              onClick={() => {
                setSearchQuery('')
                setSelectedLetter('')
              }}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              aria-label="清空搜索"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        <div className="flex gap-2 justify-center">
          <Button
            variant={activeTab === 'xiaoqu' ? 'default' : 'outline'}
            onClick={() => setActiveTab('xiaoqu')}
            className="gap-2"
          >
            <HomeIcon className="w-4 h-4" />
            小区通讯录
          </Button>
          <Button
            variant={activeTab === 'jiedao' ? 'default' : 'outline'}
            onClick={() => setActiveTab('jiedao')}
            className="gap-2"
          >
            <Building2 className="w-4 h-4" />
            街道通讯录
          </Button>
        </div>
      </div>

      {/* 内容区域 */}
      {activeTab === 'xiaoqu' ? (
        <div className="space-y-6">
          {/* 首字母导航 */}
          {!searchQuery && (
            <div className="sticky top-20 z-10 bg-background/95 backdrop-blur-sm border-b border-border/50 pb-4">
              <div className="text-sm text-muted-foreground mb-3">
                按首字母查找小区
              </div>
              <div className="flex flex-wrap gap-2">
                {letters.map((letter) => (
                  <Button
                    key={letter}
                    variant={selectedLetter === letter ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedLetter(letter)}
                    className="w-10 h-10 p-0"
                  >
                    {letter}
                  </Button>
                ))}
                {selectedLetter && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedLetter('')}
                    className="text-muted-foreground"
                  >
                    清除
                  </Button>
                )}
              </div>
            </div>
          )}

          {displayXiaoqu.length > 0 ? (
            <>
              <div className="text-sm text-muted-foreground">
                {searchQuery ? `搜索到 ${displayXiaoqu.length} 个小区` : `${selectedLetter} 开头的小区 (${displayXiaoqu.length} 个)`}
              </div>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {displayXiaoqu.map((item, index) => (
              <Card
                key={index}
                className="border-border/50 hover:border-primary/50 transition-all duration-300 hover:shadow-md"
              >
                <CardContent className="p-5">
                  <h3 className="text-base font-bold mb-3 text-foreground">
                    {item.name}
                  </h3>

                  {/* 业委会信息 */}
                  {item.yeweihui.secretary && (
                    <div className="mb-3 pb-3 border-b border-border/50">
                      <div className="text-xs text-muted-foreground mb-1">
                        业委会秘书
                      </div>
                      <div className="text-sm text-foreground">{item.yeweihui.secretary}</div>
                      {item.yeweihui.tel && (
                        <a
                          href={`tel:${item.yeweihui.tel}`}
                          className="text-primary hover:underline text-sm"
                        >
                          {item.yeweihui.tel}
                        </a>
                      )}
                    </div>
                  )}

                  {/* 物业信息 */}
                  <div className="mb-3 pb-3 border-b border-border/50">
                    <div className="text-xs text-muted-foreground mb-1">
                      物业公司
                    </div>
                    <div className="text-sm mb-1 text-foreground">
                      {item.property.name}
                    </div>
                    <div className="text-xs text-muted-foreground mb-1">
                      物业经理：{item.property.manager}
                    </div>
                    <a
                      href={`tel:${item.property.phone}`}
                      className="text-primary hover:underline text-sm inline-flex items-center gap-1"
                    >
                      <Phone className="w-3 h-3" />
                      {item.property.phone}
                    </a>
                    {item.property.address && (
                      <div className="text-xs text-muted-foreground mt-1">
                        {item.property.address}
                      </div>
                    )}
                  </div>

                  {/* 居委信息 */}
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">
                      居委会
                    </div>
                    <div className="text-sm mb-1 text-foreground">
                      {item.committee.name}
                    </div>
                    {item.committee.tel && (
                      <a
                        href={`tel:${item.committee.tel}`}
                        className="text-primary hover:underline text-sm inline-flex items-center gap-1"
                      >
                        <Phone className="w-3 h-3" />
                        {item.committee.tel}
                      </a>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
            </>
          ) : (
            <div className="text-center py-12">
              <div className="text-muted-foreground mb-2">
                {searchQuery ? '未找到匹配的小区' : '请选择首字母或使用搜索功能查找小区'}
              </div>
              {!searchQuery && (
                <p className="text-sm text-muted-foreground">
                  共有 {xiaoqu.length} 个小区可供查询
                </p>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-8">
          {filteredJiedao ? (
            // 搜索结果
            <div>
              <div className="text-sm text-muted-foreground mb-4">
                共 {filteredJiedao.length} 条结果
              </div>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filteredJiedao.map((item, index) => (
                  <Card
                    key={index}
                    className="border-border/50 hover:border-primary/50 transition-all duration-300 hover:shadow-md"
                  >
                    <CardContent className="p-5">
                      <div className="flex items-start gap-3">
                        <div className="text-2xl">{item.icon}</div>
                        <div className="flex-1">
                          <div className="text-xs text-muted-foreground mb-1">
                            {item.category}
                          </div>
                          <h3 className="font-semibold mb-2 text-sm leading-tight text-foreground">
                            {item.name}
                          </h3>
                          <a
                            href={`tel:${item.phone}`}
                            className="text-primary hover:underline text-sm inline-flex items-center gap-1"
                          >
                            <Phone className="w-3 h-3" />
                            {item.phone}
                          </a>
                          {item.address && (
                            <div className="text-xs text-muted-foreground mt-2">
                              {item.address}
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ) : (
            // 分类展示
            Object.entries(categorizedJiedao).map(([category, items]) => (
              <div key={category}>
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <span className="text-2xl">{items[0].icon}</span>
                  {category}
                </h2>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {items.map((item, index) => (
                    <Card
                      key={index}
                      className="border-border/50 hover:border-primary/50 transition-all duration-300 hover:shadow-md"
                    >
                      <CardContent className="p-5">
                        <h3 className="font-semibold mb-2 text-sm leading-tight text-foreground">
                          {item.name}
                        </h3>
                        <a
                          href={`tel:${item.phone}`}
                          className="text-primary hover:underline text-sm inline-flex items-center gap-1"
                        >
                          <Phone className="w-3 h-3" />
                          {item.phone}
                        </a>
                        {item.address && (
                          <div className="text-xs text-muted-foreground mt-2">
                            {item.address}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </section>
  )
}
