'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from './supabase/client'

export function useAdminAuth() {
  const router = useRouter()
  const supabase = createClient()
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    checkAuth()
  }, [])

  async function checkAuth() {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        setIsAuthenticated(false)
        router.push('/admin/login')
        return
      }

      // 检查用户是否为管理员
      const { data: userData, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', session.user.id)
        .single()

      if (error || userData?.role !== 'admin') {
        setIsAuthenticated(false)
        await supabase.auth.signOut()
        router.push('/admin/login')
        return
      }

      setIsAuthenticated(true)
    } catch (error) {
      console.error('Auth check error:', error)
      setIsAuthenticated(false)
      router.push('/admin/login')
    } finally {
      setIsLoading(false)
    }
  }

  async function logout() {
    await supabase.auth.signOut()
    router.push('/admin/login')
  }

  return { isAuthenticated, isLoading, logout }
}
