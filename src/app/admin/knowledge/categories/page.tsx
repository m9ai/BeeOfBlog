'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { 
  ArrowLeft,
  Plus,
  Edit2,
  Trash2,
  GripVertical,
  Loader2
} from 'lucide-react'
import type { Tables } from '@/types/database'

type Category = Tables<'knowledge_categories'>

export default function CategoriesPage() {
  const router = useRouter()
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    icon: '',
    description: '',
    color: '#3b82f6',
    sort_order: 0
  })
  const supabase = createClient()

  useEffect(() => {
    fetchCategories()
  }, [])

  async function fetchCategories() {
    const { data, error } = await supabase
      .from('knowledge_categories')
      .select('*')
      .order('sort_order', { ascending: true })

    if (error) {
      console.error('Error fetching categories:', error)
    } else {
      setCategories(data || [])
    }
    setLoading(false)
  }

  function openAddDialog() {
    setEditingCategory(null)
    setFormData({
      name: '',
      icon: '',
      description: '',
      color: '#3b82f6',
      sort_order: categories.length
    })
    setDialogOpen(true)
  }

  function openEditDialog(category: Category) {
    setEditingCategory(category)
    setFormData({
      name: category.name,
      icon: category.icon,
      description: category.description,
      color: category.color,
      sort_order: category.sort_order
    })
    setDialogOpen(true)
  }

  async function handleSave() {
    if (!formData.name) {
      alert('请输入分类名称')
      return
    }

    if (editingCategory) {
      const { error } = await supabase
        .from('knowledge_categories')
        .update({
          name: formData.name,
          icon: formData.icon,
          description: formData.description,
          color: formData.color,
          sort_order: formData.sort_order,
          updated_at: new Date().toISOString()
        })
        .eq('id', editingCategory.id)

      if (error) {
        console.error('Error updating category:', error)
        alert('更新失败')
        return
      }
    } else {
      const id = formData.name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
      
      const { error } = await supabase
        .from('knowledge_categories')
        .insert({
          id,
          name: formData.name,
          icon: formData.icon,
          description: formData.description,
          color: formData.color,
          sort_order: formData.sort_order
        })

      if (error) {
        console.error('Error creating category:', error)
        alert('创建失败')
        return
      }
    }

    setDialogOpen(false)
    fetchCategories()
  }

  async function handleDelete(category: Category) {
    if (!confirm(`确定要删除分类「${category.name}」吗？该分类下的文档也会被删除。`)) return

    const { error } = await supabase
      .from('knowledge_categories')
      .delete()
      .eq('id', category.id)

    if (error) {
      console.error('Error deleting category:', error)
      alert('删除失败')
    } else {
      fetchCategories()
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-5 h-5 animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <section className="border-b border-border/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/admin/knowledge">
                <Button variant="ghost" size="icon">
                  <ArrowLeft className="w-5 h-5" />
                </Button>
              </Link>
              <div>
                <h1 className="text-2xl font-bold">分类管理</h1>
                <p className="text-sm text-muted-foreground">
                  共 {categories.length} 个分类
                </p>
              </div>
            </div>
            <Button onClick={openAddDialog} className="gap-2">
              <Plus className="w-4 h-4" />
              新建分类
            </Button>
          </div>
        </div>
      </section>

      {/* Categories List */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead className="bg-secondary/50">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-medium text-muted-foreground">排序</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-muted-foreground">图标</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-muted-foreground">名称</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-muted-foreground">描述</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-muted-foreground">文档数</th>
                <th className="px-6 py-4 text-right text-sm font-medium text-muted-foreground">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {categories.map((category) => (
                <tr key={category.id} className="hover:bg-secondary/30 transition-colors">
                  <td className="px-6 py-4">
                    <span className="text-muted-foreground">{category.sort_order}</span>
                  </td>
                  <td className="px-6 py-4 text-2xl">{category.icon}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: category.color }}
                      />
                      <span className="font-medium">{category.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-muted-foreground">
                    {category.description || '-'}
                  </td>
                  <td className="px-6 py-4 text-sm">{category.doc_count}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-2">
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => openEditDialog(category)}
                      >
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => handleDelete(category)}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          {categories.length === 0 && (
            <div className="text-center py-12">
              <p className="text-muted-foreground mb-4">暂无分类</p>
              <Button onClick={openAddDialog}>创建第一个分类</Button>
            </div>
          )}
        </div>
      </section>

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{editingCategory ? '编辑分类' : '新建分类'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>分类名称 *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="如：历史沿革"
                />
              </div>
              <div className="space-y-2">
                <Label>图标 (emoji)</Label>
                <Input
                  value={formData.icon}
                  onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                  placeholder="如：📜"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>描述</Label>
              <Input
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="分类的简短描述"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>主题色</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={formData.color}
                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                    className="w-10 h-10 rounded cursor-pointer"
                  />
                  <Input
                    value={formData.color}
                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                    className="flex-1"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>排序</Label>
                <Input
                  type="number"
                  value={formData.sort_order}
                  onChange={(e) => setFormData({ ...formData, sort_order: parseInt(e.target.value) || 0 })}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>取消</Button>
              <Button onClick={handleSave}>保存</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
