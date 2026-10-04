import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const out: Record<string, unknown> = {}
  const supabase = await createClient()

  for (const table of ['wishlist', 'mini_wishes', 'posts', 'watch_tasks']) {
    try {
      const { count, error } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true })
      out[table] = error ? `ERR: ${error.message}` : `count=${count}`
    } catch (err) {
      out[table] = `THROW: ${(err as Error).message}`
    }
  }

  return NextResponse.json(out)
}
