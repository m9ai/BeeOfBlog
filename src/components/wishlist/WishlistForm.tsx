'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Send, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

const categories = [
  { id: 'old_renovation', label: '小区旧改', description: '咨询小区旧改进展、政策等' },
  { id: 'municipal', label: '市政工程', description: '反馈市政工程、道路施工等问题' },
  { id: 'cooperation', label: '本地合作', description: '寻求本地合作、商业洽谈等' },
  { id: 'other', label: '其他诉求', description: '其他需要小蜜蜂帮助的事项' },
]

export function WishlistForm() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    category: 'old_renovation',
    contact_name: '',
    contact_phone: '',
    contact_email: '',
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    // 表单验证
    if (!formData.title.trim()) {
      toast.error('请输入标题')
      return
    }
    if (!formData.content.trim()) {
      toast.error('请输入详细内容')
      return
    }
    if (formData.content.trim().length < 10) {
      toast.error('详细内容至少需要10个字')
      return
    }

    setLoading(true)

    try {
      const { error } = await supabase.from('wishlist').insert({
        title: formData.title.trim(),
        content: formData.content.trim(),
        category: formData.category,
        contact_name: formData.contact_name.trim() || null,
        contact_phone: formData.contact_phone.trim() || null,
        contact_email: formData.contact_email.trim() || null,
      })

      if (error) {
        throw error
      }

      toast.success('心愿提交成功！小蜜蜂会尽快回复你 🐝')
      
      // 重置表单
      setFormData({
        title: '',
        content: '',
        category: 'old_renovation',
        contact_name: '',
        contact_phone: '',
        contact_email: '',
      })
      
      // 刷新页面以显示新提交的心愿
      router.refresh()
    } catch (error) {
      console.error('Error submitting wishlist:', error)
      toast.error('提交失败，请稍后重试')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-card border rounded-xl p-6 shadow-sm">
      <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
        <Send className="w-5 h-5 text-primary" />
        提交你的心愿
      </h2>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* 分类选择 */}
        <div className="space-y-3">
          <Label>选择分类</Label>
          <RadioGroup
            value={formData.category}
            onValueChange={(value) => setFormData({ ...formData, category: value })}
            className="grid grid-cols-1 sm:grid-cols-2 gap-3"
          >
            {categories.map((cat) => (
              <div key={cat.id}>
                <RadioGroupItem
                  value={cat.id}
                  id={cat.id}
                  className="peer sr-only"
                />
                <Label
                  htmlFor={cat.id}
                  className="flex flex-col p-3 rounded-lg border-2 border-muted bg-popover hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 cursor-pointer transition-all"
                >
                  <span className="font-medium">{cat.label}</span>
                  <span className="text-xs text-muted-foreground mt-1">
                    {cat.description}
                  </span>
                </Label>
              </div>
            ))}
          </RadioGroup>
        </div>

        {/* 标题 */}
        <div className="space-y-2">
          <Label htmlFor="title">
            标题 <span className="text-red-500">*</span>
          </Label>
          <Input
            id="title"
            placeholder="简单描述你的心愿..."
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            maxLength={100}
          />
        </div>

        {/* 详细内容 */}
        <div className="space-y-2">
          <Label htmlFor="content">
            详细内容 <span className="text-red-500">*</span>
          </Label>
          <Textarea
            id="content"
            placeholder="请详细描述你的诉求，至少10个字..."
            value={formData.content}
            onChange={(e) => setFormData({ ...formData, content: e.target.value })}
            rows={5}
            maxLength={1000}
          />
          <p className="text-xs text-muted-foreground text-right">
            {formData.content.length}/1000
          </p>
        </div>

        {/* 联系方式 */}
        <div className="space-y-4">
          <Label>联系方式（选填）</Label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="contact_name" className="text-sm text-muted-foreground">
                称呼
              </Label>
              <Input
                id="contact_name"
                placeholder="怎么称呼你？"
                value={formData.contact_name}
                onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact_phone" className="text-sm text-muted-foreground">
                电话
              </Label>
              <Input
                id="contact_phone"
                type="tel"
                placeholder="联系电话"
                value={formData.contact_phone}
                onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="contact_email" className="text-sm text-muted-foreground">
              邮箱
            </Label>
            <Input
              id="contact_email"
              type="email"
              placeholder="联系邮箱"
              value={formData.contact_email}
              onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
            />
          </div>
        </div>

        {/* 提交按钮 */}
        <Button
          type="submit"
          className="w-full"
          disabled={loading}
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              提交中...
            </>
          ) : (
            <>
              <Send className="w-4 h-4 mr-2" />
              提交心愿
            </>
          )}
        </Button>

        <p className="text-xs text-muted-foreground text-center">
          提交后小蜜蜂会尽快查看并回复，请保持联系方式畅通 🐝
        </p>
      </form>
    </div>
  )
}
