'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Plus,
  Save,
  Trash2,
  ArrowLeft,
  Package,
  MapPin,
  Clock,
  AlertCircle
} from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

interface FacilityItem {
  id: string
  name: string
  brand?: string
  location: string
  hours: string
  note: string
}

interface FacilityConfig {
  id: string
  type: string
  icon: string
  title: string
  desc: string
  tips: string
  items: FacilityItem[]
}

const defaultFacilities: FacilityConfig[] = [
  {
    id: 'express',
    type: 'express',
    icon: '📦',
    title: '快递柜/自提点',
    desc: '查看小区快递柜位置',
    tips: '使用提示:请根据快递单号选择对应的快递柜品牌,部分柜机需要使用手机APP或微信小程序扫码取件。',
    items: []
  },
  {
    id: 'garbage',
    type: 'garbage',
    icon: '♻️',
    title: '垃圾分类点',
    desc: '投放点位置与开放时间',
    tips: '分类提示:干垃圾、湿垃圾、可回收物、有害垃圾请按类别投放,投放时请保持容器周边清洁。',
    items: []
  },
  {
    id: 'parking',
    type: 'parking',
    icon: '🅿️',
    title: '停车位',
    desc: '周边公共停车场',
    tips: '停车提示:请留意停车场收费标准和营业时间,部分停车场夜间可能有不同费率。',
    items: []
  },
  {
    id: 'charging',
    type: 'charging',
    icon: '⚡',
    title: '充电桩',
    desc: '电动车充电点位置',
    tips: '充电提示:请根据电动车类型选择合适的充电桩,充电过程中请勿离开车辆。',
    items: []
  }
]

export default function FacilitiesAdminPage() {
  const router = useRouter()
  const [facilities, setFacilities] = useState<FacilityConfig[]>(defaultFacilities)
  const [selectedFacility, setSelectedFacility] = useState<FacilityConfig | null>(null)
  const [newItem, setNewItem] = useState<Partial<FacilityItem>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadFacilities()
  }, [])

  async function loadFacilities() {
    try {
      const response = await fetch('/feeds/facilities.json?t=' + Date.now())
      if (response.ok) {
        const data = await response.json()
        setFacilities(data)
      }
    } catch (error) {
      console.error('加载设施配置失败:', error)
    } finally {
      setLoading(false)
    }
  }

  async function saveFacilities() {
    setSaving(true)
    try {
      const response = await fetch('/api/admin/facilities', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(facilities),
      })

      if (response.ok) {
        alert('保存成功!')
      } else {
        alert('保存失败!')
      }
    } catch (error) {
      console.error('保存失败:', error)
      alert('保存失败!')
    } finally {
      setSaving(false)
    }
  }

  function addItem(facilityId: string) {
    if (!newItem.name || !newItem.location || !newItem.hours) {
      alert('请填写必填项:名称、位置、营业时间')
      return
    }

    const item: FacilityItem = {
      id: Date.now().toString(),
      name: newItem.name,
      brand: newItem.brand || '',
      location: newItem.location,
      hours: newItem.hours,
      note: newItem.note || ''
    }

    setFacilities(facilities.map(f => {
      if (f.id === facilityId) {
        return {
          ...f,
          items: [...f.items, item]
        }
      }
      return f
    }))

    setNewItem({})
  }

  function removeItem(facilityId: string, itemId: string) {
    setFacilities(facilities.map(f => {
      if (f.id === facilityId) {
        return {
          ...f,
          items: f.items.filter(item => item.id !== itemId)
        }
      }
      return f
    }))
  }

  function updateConfigField(facilityId: string, field: keyof FacilityConfig, value: string) {
    setFacilities(facilities.map(f => {
      if (f.id === facilityId) {
        return { ...f, [field]: value }
      }
      return f
    }))
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted-foreground">加载中...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <section className="border-b border-border/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/admin">
                <Button variant="ghost" size="icon">
                  <ArrowLeft className="w-5 h-5" />
                </Button>
              </Link>
              <div>
                <h1 className="text-2xl font-bold">设施配置管理</h1>
                <p className="text-sm text-muted-foreground">
                  管理社区便民设施信息
                </p>
              </div>
            </div>
            <Button
              onClick={saveFacilities}
              disabled={saving}
              className="gap-2"
            >
              <Save className="w-4 h-4" />
              {saving ? '保存中...' : '保存配置'}
            </Button>
          </div>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Facility Cards */}
        <div className="space-y-6">
          {facilities.map(facility => (
            <Card key={facility.id} className="p-6">
              {/* Facility Header */}
              <div className="mb-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="text-4xl">{facility.icon}</div>
                    <div>
                      <h3 className="text-xl font-semibold">{facility.title}</h3>
                      <Badge variant="secondary" className="mt-1">{facility.type}</Badge>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground mb-1 block">
                      描述
                    </label>
                    <Input
                      value={facility.desc}
                      onChange={(e) => updateConfigField(facility.id, 'desc', e.target.value)}
                      placeholder="设施描述"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground mb-1 block">
                      提示语
                    </label>
                    <Textarea
                      value={facility.tips}
                      onChange={(e) => updateConfigField(facility.id, 'tips', e.target.value)}
                      placeholder="使用提示"
                      rows={2}
                    />
                  </div>
                </div>
              </div>

              {/* Add New Item */}
              <div className="bg-secondary/30 rounded-lg p-4 mb-4">
                <div className="flex items-center gap-2 mb-3">
                  <Plus className="w-4 h-4" />
                  <span className="text-sm font-medium">添加设施点</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                  <Input
                    placeholder="名称 *"
                    value={newItem.name || ''}
                    onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                  />
                  <Input
                    placeholder="品牌(可选)"
                    value={newItem.brand || ''}
                    onChange={(e) => setNewItem({ ...newItem, brand: e.target.value })}
                  />
                  <Input
                    placeholder="位置 *"
                    value={newItem.location || ''}
                    onChange={(e) => setNewItem({ ...newItem, location: e.target.value })}
                  />
                  <Input
                    placeholder="营业时间 *"
                    value={newItem.hours || ''}
                    onChange={(e) => setNewItem({ ...newItem, hours: e.target.value })}
                  />
                  <div className="flex gap-2">
                    <Input
                      placeholder="备注"
                      value={newItem.note || ''}
                      onChange={(e) => setNewItem({ ...newItem, note: e.target.value })}
                    />
                    <Button onClick={() => addItem(facility.id)} size="icon">
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>

              {/* Facility Items List */}
              {facility.items.length > 0 ? (
                <div className="space-y-2">
                  {facility.items.map(item => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between bg-card/50 border rounded-lg p-3"
                    >
                      <div className="flex items-start gap-3 flex-1">
                        <div className="flex items-center gap-2 flex-1">
                          <Package className="w-4 h-4 text-muted-foreground" />
                          <div>
                            <div className="font-medium">{item.name}</div>
                            {item.brand && (
                              <Badge variant="outline" className="text-xs">{item.brand}</Badge>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-1">
                          <MapPin className="w-4 h-4 text-muted-foreground" />
                          <span className="text-sm">{item.location}</span>
                        </div>
                        <div className="flex items-center gap-2 flex-1">
                          <Clock className="w-4 h-4 text-muted-foreground" />
                          <span className="text-sm">{item.hours}</span>
                        </div>
                        {item.note && (
                          <div className="flex items-center gap-2 flex-1">
                            <AlertCircle className="w-4 h-4 text-muted-foreground" />
                            <span className="text-sm text-muted-foreground">{item.note}</span>
                          </div>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeItem(facility.id, item.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  暂无设施点,请添加
                </div>
              )}
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}
