import Link from 'next/link'
import Image from 'next/image'
import { Video, FileText, Eye, Calendar } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { Tables } from '@/types/database'

interface PostCardProps {
  post: Tables<'posts'> & {
    category?: Tables<'categories'> | null
  }
}

export function PostCard({ post }: PostCardProps) {
  const isVideo = post.type === 'video'
  const Icon = isVideo ? Video : FileText

  return (
    <Link href={`/${isVideo ? 'videos' : 'posts'}/${post.id}`}>
      <Card className="group overflow-hidden bg-card/50 backdrop-blur-sm border-border/50 hover:border-primary/50 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-primary/5 h-full flex flex-col">
        {/* Cover Image */}
        <div className="relative aspect-video overflow-hidden flex-shrink-0">
          <Image
            src={post.cover_image || `https://placehold.co/600x400/1e293b/64748b?text=${encodeURIComponent(post.title)}`}
            alt={post.title}
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-105"
          />
          {/* Overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

          {/* Type Badge */}
          <div className="absolute top-3 left-3">
            <Badge variant="secondary" className="bg-background/80 backdrop-blur-sm">
              <Icon className="w-3 h-3 mr-1" />
              {isVideo ? '视频' : '文章'}
            </Badge>
          </div>

          {/* Video Play Button */}
          {isVideo && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-14 h-14 rounded-full bg-primary/90 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 scale-75 group-hover:scale-100">
                <Video className="w-6 h-6 text-primary-foreground ml-1" />
              </div>
            </div>
          )}
        </div>

        {/* Content */}
        <CardContent className="p-4 flex flex-col flex-1">
          {/* Category - 固定高度 */}
          <div className="h-6 mb-2">
            {post.category && (
              <Badge variant="outline" className="text-xs">
                {post.category.name}
              </Badge>
            )}
          </div>

          {/* Title - 固定两行高度 */}
          <h3 className="font-semibold text-lg mb-2 line-clamp-2 group-hover:text-primary transition-colors h-[3.5rem]">
            {post.title}
          </h3>

          {/* Excerpt - 固定两行高度 */}
          <p className="text-sm text-muted-foreground line-clamp-2 mb-3 h-[2.5rem]">
            {post.excerpt || '\u00A0'}
          </p>

          {/* Meta - 固定在底部 */}
          <div className="flex items-center gap-4 text-xs text-muted-foreground mt-auto">
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {new Date(post.created_at).toLocaleDateString('zh-CN')}
            </span>
            <span className="flex items-center gap-1">
              <Eye className="w-3 h-3" />
              {post.view_count}
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
