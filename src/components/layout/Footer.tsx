import Link from 'next/link'
import { Heart, Github, Twitter } from 'lucide-react'

export function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="border-t border-border/50 bg-secondary/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
          <div className="flex items-center gap-4">
            <Link
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <Github className="w-5 h-5" />
            </Link>
            <Link
              href="https://twitter.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <Twitter className="w-5 h-5" />
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
