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
  const [showMircoAppQR, setShowMircoAppQR] = useState(false)

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
                  <svg className="w-4 h-4" viewBox="0 0 1111 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="9905" width="256" height="256"><path d="M386.357544 201.78561l19.904039 33.683757q51.035996 88.292273 148.004388 274.573658l63.794995-120.95531c31.642317-59.712115 64.305355-118.40351 98.499472-177.094906l6.124319-10.207199c117.89315-193.426424 233.744861-255.179979 317.443894-148.004388 51.035996 69.919314 74.002194 215.371902 66.346795 391.446088a1271.306656 1271.306656 0 0 1-90.333713 441.461364c-67.367514 144.431868-179.136345 184.239945-281.208337 62.774275l-9.696839-11.738279c-29.090518-36.745917-85.740473-114.320631-170.460226-233.744861L475.160177 817.27972c-51.035996 68.898594-83.188673 113.299911-102.071991 134.735029-102.071992 121.46567-213.840823 81.657593-281.208337-62.774275A1271.306656 1271.306656 0 0 1 1.035776 445.22731C-5.088543 269.153124 15.836215 123.700536 68.91365 51.739782 154.143763-55.435809 268.464394 8.359186 386.357544 201.78561zM154.143763 119.107297c-32.663037 42.870236-51.035996 168.929146-43.890956 321.526773a1160.558545 1160.558545 0 0 0 79.616154 400.632568c38.276997 82.678313 59.712115 90.333713 102.071991 39.297716l17.352239-22.455838c31.642317-40.828797 87.781913-117.38279 167.398066-230.172341l10.207199-14.800439-51.035996-96.968392C379.212505 405.929593 335.321549 326.31344 307.251751 276.298164L295.003112 255.883766a408.287967 408.287967 0 0 0-118.91387-140.348989c-12.758999-7.145039-14.290079-7.145039-22.455838 3.57252z m801.265135 0c-7.655399-10.717559-9.186479-10.717559-22.455838-3.57252A421.046966 421.046966 0 0 0 814.03919 255.883766l-17.862599 30.111237q-51.035996 92.885512-163.315187 303.153815l-11.738279 22.966198 62.774275 87.781913q102.071992 143.921508 132.693589 179.136346c42.870236 51.035996 64.305355 43.380596 102.071992-39.297717a1160.558545 1160.558545 0 0 0 80.126513-400.632567c7.145039-153.107987-11.227919-278.656537-43.890956-321.526774z" fill="#ffffff" p-id="9906"></path></svg>
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
              {/* 微信小程序 */}
              <div className="relative">
                <Button 
                  variant="outline" 
                  size="icon" 
                  className="rounded-full hover:bg-primary hover:text-primary-foreground transition-colors"
                  onMouseEnter={() => setShowMircoAppQR(true)}
                  onMouseLeave={() => setShowMircoAppQR(false)}
                  onTouchStart={() => setShowMircoAppQR(!showMircoAppQR)}
                >
                  <svg className="w-4 h-4" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="7069" width="512" height="512"><path d="M512 136.533333A375.466667 375.466667 0 1 0 887.466667 512 375.864889 375.864889 0 0 0 512 136.533333M512 56.888889a455.111111 455.111111 0 1 1-455.111111 455.111111 455.111111 455.111111 0 0 1 455.111111-455.111111z" fill="#ffffff" p-id="7070"></path><path d="M253.610667 619.975111A132.096 132.096 0 0 1 273.066667 552.163556a148.821333 148.821333 0 0 1 85.390222-63.658667 91.761778 91.761778 0 0 1 25.201778-4.039111 37.034667 37.034667 0 0 1 37.603555 37.148444 37.034667 37.034667 0 0 1-36.807111 37.432889h-0.967111a3.697778 3.697778 0 0 0-1.536 0H381.155556a75.320889 75.320889 0 0 0-43.918223 31.857778 53.589333 53.589333 0 0 0-8.362666 29.240889 69.404444 69.404444 0 0 0 73.955555 62.976 86.016 86.016 0 0 0 40.732445-10.467556 61.326222 61.326222 0 0 0 33.507555-52.508444V404.138667a133.518222 133.518222 0 0 1 71.68-116.792889 149.959111 149.959111 0 0 1 75.946667-20.707556h1.365333a144.042667 144.042667 0 0 1 149.504 137.386667 132.096 132.096 0 0 1-19.512889 67.868444 148.878222 148.878222 0 0 1-85.333333 63.374223 88.860444 88.860444 0 0 1-24.974222 4.039111h-0.682667a36.920889 36.920889 0 0 1-25.998222-10.638223 37.489778 37.489778 0 0 1-11.377778-26.510222 36.977778 36.977778 0 0 1 37.603556-37.091555 4.494222 4.494222 0 0 0 1.763555 0l1.024-0.341334a71.168 71.168 0 0 0 43.576889-31.288889v-0.341333a53.475556 53.475556 0 0 0 8.248889-29.070222 69.063111 69.063111 0 0 0-73.955556-62.919111 85.333333 85.333333 0 0 0-40.675555 10.467555 61.269333 61.269333 0 0 0-33.507556 52.508445v216.177778A133.461333 133.461333 0 0 1 480.711111 737.28a158.151111 158.151111 0 0 1-77.539555 20.138667 144.099556 144.099556 0 0 1-149.560889-137.443556z" fill="#ffffff" p-id="7071"></path></svg>
                </Button>
                {showMircoAppQR && (
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 p-2 bg-background border border-border rounded-lg shadow-xl z-50 animate-in fade-in slide-in-from-bottom-2 duration-200">
                    <div className="relative w-32 h-32">
                      <Image
                        src="/images/bee-wx-micro-app-qr.jpg"
                        alt="微信小程序二维码"
                        fill
                        className="object-contain"
                      />
                    </div>
                    <p className="text-xs text-center text-muted-foreground mt-1">扫码打开小程序</p>
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
