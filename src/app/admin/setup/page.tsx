import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { SetupAdminForm } from './SetupAdminForm'

// 从环境变量获取设置密钥
const SETUP_SECRET_KEY = process.env.SETUP_SECRET_KEY

interface SetupPageProps {
  searchParams: Promise<{ key?: string }>
}

export default async function SetupAdminPage(props: SetupPageProps) {
  const searchParams = await props.searchParams
  // 验证密钥
  if (!SETUP_SECRET_KEY || searchParams.key !== SETUP_SECRET_KEY) {
    redirect('/admin/login')
  }

  // 检查是否已有管理员存在
  const supabase = await createClient()
  const { data: existingAdmins } = await supabase
    .from('user_roles')
    .select('user_id')
    .eq('role', 'admin')
    .limit(1)

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-secondary/20 p-4">
      <SetupAdminForm hasExistingAdmin={!!existingAdmins && existingAdmins.length > 0} />
    </div>
  )
}
