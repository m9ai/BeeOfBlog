'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, CheckCircle, AlertCircle } from 'lucide-react'

export default function SetupAdminPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ success?: boolean; message?: string } | null>(null)
  const [adminEmail, setAdminEmail] = useState('zhangjian@m9ai.work')
  const [adminPassword, setAdminPassword] = useState('Admin@123456')

  async function setupAdmin() {
    setLoading(true)
    setResult(null)

    try {
      // 先尝试登录，检查用户是否已存在
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: adminEmail,
        password: adminPassword,
      })

      // 登录成功，说明用户已存在且密码正确
      if (signInData.user) {
        // 设置管理员角色
        const { error: roleError } = await supabase
          .from('user_roles')
          .upsert({ user_id: signInData.user.id, role: 'admin' }, { onConflict: 'user_id' })

        if (roleError) {
          setResult({ success: false, message: '设置管理员角色失败: ' + roleError.message })
        } else {
          setResult({ 
            success: true, 
            message: '管理员权限设置成功！用户已存在，已更新为管理员角色。' 
          })
        }
        setLoading(false)
        return
      }

      // 登录失败，可能是用户不存在或密码错误
      if (signInError) {
        // 尝试注册新用户
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email: adminEmail,
          password: adminPassword,
          options: {
            emailRedirectTo: window.location.origin,
          },
        })

        if (signUpError) {
          if (signUpError.message.includes('already registered') || signUpError.message.includes('already been registered')) {
            setResult({
              success: false,
              message: '用户已存在但密码不匹配，请输入正确的密码',
            })
          } else if (signUpError.message.includes('rate limit')) {
            setResult({
              success: false,
              message: '操作太频繁，请稍后再试（约1分钟后）',
            })
          } else {
            setResult({ success: false, message: '注册失败: ' + signUpError.message })
          }
          setLoading(false)
          return
        }

        // 注册成功，设置管理员角色
        if (signUpData.user) {
          const { error: roleError } = await supabase.from('user_roles').insert({
            user_id: signUpData.user.id,
            role: 'admin',
          })

          if (roleError) {
            setResult({ success: false, message: '设置管理员角色失败: ' + roleError.message })
          } else {
            setResult({
              success: true,
              message: `管理员创建成功！邮箱: ${adminEmail}, 密码: ${adminPassword}`,
            })
          }
        }
      }
    } catch (error) {
      setResult({ success: false, message: '发生错误: ' + String(error) })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-secondary/20 p-4">
      <div className="w-full max-w-md">
        <Card className="border-border/50 shadow-xl">
          <CardHeader>
            <CardTitle>初始化管理员账号</CardTitle>
            <CardDescription>创建或更新管理员账号</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">管理员邮箱</Label>
              <Input
                id="email"
                type="email"
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                placeholder="admin@example.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">管理员密码</Label>
              <Input
                id="password"
                type="text"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                placeholder="输入密码"
              />
            </div>

            {result && (
              <div className={`p-4 rounded-lg border flex items-start gap-3 ${
                result.success 
                  ? 'bg-green-500/10 border-green-500/20 text-green-700 dark:text-green-400' 
                  : 'bg-destructive/10 border-destructive/20 text-destructive'
              }`}>
                {result.success ? (
                  <CheckCircle className="h-5 w-5 mt-0.5 flex-shrink-0" />
                ) : (
                  <AlertCircle className="h-5 w-5 mt-0.5 flex-shrink-0" />
                )}
                <div className="text-sm">{result.message}</div>
              </div>
            )}

            <Button onClick={setupAdmin} disabled={loading} className="w-full">
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  处理中...
                </>
              ) : (
                '创建/更新管理员'
              )}
            </Button>

            <div className="text-center">
              <a href="/admin/login" className="text-sm text-primary hover:underline">
                前往登录页面 →
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
