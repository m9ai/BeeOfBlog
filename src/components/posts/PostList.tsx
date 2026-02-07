import { PostCard } from './PostCard'
import type { Tables } from '@/types/database'

interface PostListProps {
  posts: (Tables<'posts'> & {
    category?: Tables<'categories'> | null
  })[]
}

export function PostList({ posts }: PostListProps) {
  if (posts.length === 0) {
    return (
      <div className="text-center py-20">
        <p className="text-muted-foreground">暂无内容</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {posts.map((post) => (
        <PostCard key={post.id} post={post} />
      ))}
    </div>
  )
}
