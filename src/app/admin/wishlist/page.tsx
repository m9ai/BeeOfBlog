import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { WishlistManager } from '@/components/admin/WishlistManager'

async function checkAdmin() {
  const supabase = await createClient()
  
  const { data: { session } } = await supabase.auth.getSession()
  
  if (!session) {
    return false
  }
  
  return true
}

async function getWishlist() {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('wishlist')
    .select('*')
    .order('created_at', { ascending: false })
  
  if (error) {
    console.error('Error fetching wishlist:', error)
    return []
  }
  
  return data || []
}

export default async function AdminWishlistPage() {
  const isAdmin = await checkAdmin()
  
  if (!isAdmin) {
    redirect('/admin/login')
  }
  
  const wishlist = await getWishlist()

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">心愿单管理</h1>
        <p className="text-muted-foreground">
          管理用户提交的心愿诉求，及时回复处理
        </p>
      </div>

      <WishlistManager wishlist={wishlist} />
    </div>
  )
}
