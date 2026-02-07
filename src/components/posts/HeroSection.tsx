// import Image from 'next/image'
import { Github, Twitter, Mail, Video, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

interface HeroSectionProps {
  videoCount: number
  articleCount: number
}

export function HeroSection({ videoCount, articleCount }: HeroSectionProps) {
  return (
    <section className="relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-secondary/20" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent" />
      
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24">
        <div className="flex flex-col md:flex-row items-center gap-8 md:gap-12">
          {/* Avatar */}
          <div className="relative">
            <div className="absolute -inset-1 bg-gradient-to-r from-primary to-primary/60 rounded-full blur opacity-50" />
            <Avatar className="relative w-28 h-28 md:w-36 md:h-36 border-4 border-background shadow-2xl">
              <AvatarImage src="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200" alt="Avatar" />
              <AvatarFallback className="text-3xl">博主</AvatarFallback>
            </Avatar>
          </div>

          {/* Info */}
          <div className="text-center md:text-left flex-1">
            <h1 className="text-3xl md:text-4xl font-bold mb-3 bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
              欢迎来到洋泾小蜜蜂
            </h1>
            <p className="text-muted-foreground text-lg mb-6 max-w-xl">
              分享视频号创作、技术文章与生活感悟。在这里记录成长的每一步，与你一起探索更广阔的世界。
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
              <Button variant="outline" size="icon" className="rounded-full hover:bg-primary hover:text-primary-foreground transition-colors">
                <Github className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="icon" className="rounded-full hover:bg-primary hover:text-primary-foreground transition-colors">
                <Twitter className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="icon" className="rounded-full hover:bg-primary hover:text-primary-foreground transition-colors">
                <Mail className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
