'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useState, useEffect } from 'react'
import { Video, FileText, Menu, X, Home, User, Shield, Heart, Phone, LayoutGrid } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { SearchBox } from '@/components/search/SearchBox'

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    checkAdminStatus()
  }, [])

  async function checkAdminStatus() {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        setIsAdmin(false)
        return
      }

      const { data: userData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', session.user.id)
        .single()

      setIsAdmin(userData?.role === 'admin')
    } catch {
      setIsAdmin(false)
    }
  }

  const navItems = [
    { href: '/', label: '首页', icon: Home },
    { href: '/works', label: '作品', icon: LayoutGrid },
    { href: '/services', label: '便民', icon: Phone },
    { href: '/wishlist', label: '心愿单', icon: Heart },
  ]

  return (
    <header className="fixed top-0 left-0 right-0 z-50 backdrop-blur-xl bg-background/80 border-b border-border/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-10 h-10 rounded-xl overflow-hidden bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center shadow-lg shadow-yellow-500/20">
              <Image
                src="/logo.png"
                alt="洋泾小蜜蜂"
                width={40}
                height={40}
                className="object-cover"
              />
            </div>
            <span className="font-semibold text-lg group-hover:text-primary transition-colors">
              洋泾小蜜蜂
            </span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-all"
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </Link>
            ))}
          </nav>

          {/* Search Box - Desktop */}
          <div className="hidden lg:block flex-1 max-w-md mx-4">
            <SearchBox />
          </div>

          {/* Right Section */}
          <div className="flex items-center gap-2">
            <Link href="/admin">
              <Button variant="ghost" size="sm" className="hidden sm:flex items-center gap-2">
                {isAdmin ? (
                  <Shield className="w-4 h-4 text-primary" />
                ) : (
                  <User className="w-4 h-4" />
                )}
                管理
              </Button>
            </Link>

            {/* Mobile Menu Button */}
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </Button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-border/50 bg-background/95 backdrop-blur-xl">
          <nav className="flex flex-col p-4 gap-2">
            {/* Mobile Search */}
            <div className="mb-4">
              <SearchBox />
            </div>
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-all"
              >
                <item.icon className="w-5 h-5" />
                {item.label}
              </Link>
            ))}
            <Link
              href="/admin"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-all"
            >
              <User className="w-5 h-5" />
              管理后台
            </Link>
          </nav>
        </div>
      )}
    </header>
  )
}
