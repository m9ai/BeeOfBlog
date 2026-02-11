'use client'

import Link from 'next/link'
import Image from 'next/image'
import { Heart, MessageCircle, Video, Mail, Github, Twitter } from 'lucide-react'

export function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="border-t border-border/50 bg-secondary/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Social Media QR Codes */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-8 mb-10">
          {/* WeChat Official Account */}
          <div className="flex flex-col items-center gap-3">
            <div className="w-32 h-32 rounded-xl overflow-hidden bg-white p-2 shadow-lg">
              <Image
                src="/images/wechat-qr.jpg"
                alt="微信公众号"
                width={120}
                height={120}
                className="w-full h-full object-contain"
              />
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <MessageCircle className="w-4 h-4 text-green-500" />
              <span>微信公众号</span>
            </div>
          </div>

          {/* WeChat Video Channel */}
          <div className="flex flex-col items-center gap-3">
            <div className="w-32 h-32 rounded-xl overflow-hidden bg-white p-2 shadow-lg">
              <Image
                src="/images/video-channel-qr.jpg"
                alt="微信视频号"
                width={120}
                height={120}
                className="w-full h-full object-contain"
              />
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Video className="w-4 h-4 text-orange-500" />
              <span>微信视频号</span>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-border/50 mb-8" />

        {/* Bottom Section */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Copyright */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>&copy; {currentYear} 洋泾小蜜蜂</span>
            <span className="hidden sm:inline">·</span>
            <span className="hidden sm:flex items-center gap-1">
              用 <Heart className="w-3 h-3 text-red-500 fill-red-500" /> 打造
            </span>
          </div>

          {/* Links */}
          <div className="flex items-center gap-6 text-sm text-muted-foreground">
            <Link href="/" className="hover:text-foreground transition-colors">
              首页
            </Link>
            <Link href="/videos" className="hover:text-foreground transition-colors">
              视频号
            </Link>
            <Link href="/posts" className="hover:text-foreground transition-colors">
              公众号
            </Link>
          </div>

          {/* Social Links */}
          <div className="flex items-center gap-4">
            <a
              href="https://x.com/BeeOfYangjing"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground transition-colors"
              aria-label="X (Twitter)"
            >
              <Twitter className="w-5 h-5" />
            </a>
            <a
              href="mailto:zhangjian@m9ai.work"
              className="hover:text-foreground transition-colors"
              aria-label="Email"
            >
              <Mail className="w-5 h-5" />
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}
