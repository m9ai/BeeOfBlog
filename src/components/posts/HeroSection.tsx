'use client'

import Image from 'next/image'
import { Twitter, Mail, Video, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useState } from 'react'

interface HeroSectionProps {
  videoCount: number
  articleCount: number
}

export function HeroSection({ videoCount, articleCount }: HeroSectionProps) {
  const [showWechatQR, setShowWechatQR] = useState(false)
  const [showVideoQR, setShowVideoQR] = useState(false)

  return (
    <section className="relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-secondary/20" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent" />
      
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24">
        <div className="flex flex-col md:flex-row items-center gap-8 md:gap-12">
          {/* Logo */}
          <div className="relative">
            <div className="absolute -inset-2 bg-gradient-to-r from-yellow-400 to-yellow-600 rounded-full blur opacity-30" />
            <div className="relative w-32 h-32 md:w-40 md:h-40 rounded-full overflow-hidden border-4 border-background shadow-2xl bg-gradient-to-br from-yellow-300 to-yellow-500">
              <Image
                src="/logo.png"
                alt="洋泾小蜜蜂"
                fill
                className="object-cover"
                priority
              />
            </div>
          </div>

          {/* Info */}
          <div className="text-center md:text-left flex-1">
            <h1 className="text-3xl md:text-4xl font-bold mb-3 bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
              欢迎来到洋泾小蜜蜂
            </h1>
            <p className="text-muted-foreground text-base mb-6 max-w-xl leading-relaxed">
              侬好！阿拉是 "洋泾小蜜蜂"，以前叫 "洋泾阿舰"。改名是想以更活力的形象和大家见面。以前在视频号分享生活趣事，承蒙大家喜欢。以后，我还会接着挖掘生活乐子，像邻里间的新鲜事、自己的小创意，都分享给大家。我也会努力提升视频质量，多搞点新花样，让大家看得开心。"洋泾小蜜蜂" 想成为大家的快乐源泉，赶紧关注我，一起在生活里找乐子，别错过！
            </p>

            {/* Stats */}
            <div className="flex items-center justify-center md:justify-start gap-6 mb-6">
              <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-secondary/50">
                <Video className="w-4 h-4 text-primary" />
                <span className="font-semibold">{videoCount}</span>
                <span className="text-sm text-muted-foreground">视频</span>
              </div>
              <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-secondary/50">
                <FileText className="w-4 h-4 text-primary" />
                <span className="font-semibold">{articleCount}</span>
                <span className="text-sm text-muted-foreground">文章</span>
              </div>
            </div>

            {/* Social Links */}
            <div className="flex items-center justify-center md:justify-start gap-3">
              {/* 微信公众号 */}
              <div className="relative">
                <Button 
                  variant="outline" 
                  size="icon" 
                  className="rounded-full hover:bg-primary hover:text-primary-foreground transition-colors"
                  onMouseEnter={() => setShowWechatQR(true)}
                  onMouseLeave={() => setShowWechatQR(false)}
                  onTouchStart={() => setShowWechatQR(!showWechatQR)}
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M8.691 2.188C3.891 2.188 0 5.476 0 9.53c0 2.212 1.17 4.203 3.002 5.55a.59.59 0 0 1 .213.665l-.39 1.48c-.019.07-.048.141-.048.213 0 .163.13.295.29.295a.326.326 0 0 0 .167-.054l1.903-1.114a.864.864 0 0 1 .717-.098 10.16 10.16 0 0 0 2.837.403c.276 0 .543-.027.811-.05-.857-2.578.157-4.972 1.932-6.446 1.703-1.415 3.882-1.98 5.853-1.838-.576-3.583-4.196-6.348-8.596-6.348zM5.785 5.991c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178A1.17 1.17 0 0 1 4.623 7.17c0-.651.52-1.18 1.162-1.18zm5.813 0c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178 1.17 1.17 0 0 1-1.162-1.178c0-.651.52-1.18 1.162-1.18zm5.34 2.867c-1.797-.052-3.746.512-5.28 1.786-1.72 1.428-2.687 3.72-1.78 6.22.942 2.453 3.666 4.229 6.884 4.229.826 0 1.622-.12 2.361-.336a.722.722 0 0 1 .598.082l1.584.926a.272.272 0 0 0 .14.047c.134 0 .24-.111.24-.247 0-.06-.023-.12-.038-.177l-.327-1.233a.582.582 0 0 1-.023-.156.49.49 0 0 1 .201-.398C23.024 18.48 24 16.82 24 14.98c0-3.21-2.931-5.837-6.656-6.088V8.89c-.135-.01-.27-.027-.407-.03zm-2.53 3.274c.535 0 .969.44.969.982a.976.976 0 0 1-.969.983.976.976 0 0 1-.969-.983c0-.542.434-.982.969-.982zm4.844 0c.535 0 .969.44.969.982a.976.976 0 0 1-.969.983.976.976 0 0 1-.969-.983c0-.542.434-.982.969-.982z"/>
                  </svg>
                </Button>
                {showWechatQR && (
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 p-2 bg-background border border-border rounded-lg shadow-xl z-50 animate-in fade-in slide-in-from-bottom-2 duration-200">
                    <div className="relative w-32 h-32">
                      <Image
                        src="/images/wechat-qr.jpg"
                        alt="微信公众号二维码"
                        fill
                        className="object-contain"
                      />
                    </div>
                    <p className="text-xs text-center text-muted-foreground mt-1">扫码关注公众号</p>
                  </div>
                )}
              </div>

              {/* 微信视频号 */}
              <div className="relative">
                <Button 
                  variant="outline" 
                  size="icon" 
                  className="rounded-full hover:bg-primary hover:text-primary-foreground transition-colors"
                  onMouseEnter={() => setShowVideoQR(true)}
                  onMouseLeave={() => setShowVideoQR(false)}
                  onTouchStart={() => setShowVideoQR(!showVideoQR)}
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M21.5 8.5l-5 3v-3c0-1.1-.9-2-2-2h-10c-1.1 0-2 .9-2 2v7c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2v-3l5 3v-7z"/>
                  </svg>
                </Button>
                {showVideoQR && (
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 p-2 bg-background border border-border rounded-lg shadow-xl z-50 animate-in fade-in slide-in-from-bottom-2 duration-200">
                    <div className="relative w-32 h-32">
                      <Image
                        src="/images/video-channel-qr.jpg"
                        alt="微信视频号二维码"
                        fill
                        className="object-contain"
                      />
                    </div>
                    <p className="text-xs text-center text-muted-foreground mt-1">扫码关注视频号</p>
                  </div>
                )}
              </div>

              <a href="https://x.com/BeeOfYangjing" target="_blank" rel="noopener noreferrer">
                <Button variant="outline" size="icon" className="rounded-full hover:bg-primary hover:text-primary-foreground transition-colors">
                  <Twitter className="w-4 h-4" />
                </Button>
              </a>
              <a href="mailto:zhangjian@m9ai.work">
                <Button variant="outline" size="icon" className="rounded-full hover:bg-primary hover:text-primary-foreground transition-colors">
                  <Mail className="w-4 h-4" />
                </Button>
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
