import { Suspense } from 'react'
import { Phone } from 'lucide-react'
import ServicesContent from './ServicesContent'

export const dynamic = 'force-static'

export default function ServicesPage() {
  return (
    <div className="min-h-screen">
      {/* Header */}
      <section className="relative overflow-hidden border-b border-border/50">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-secondary/20" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <Phone className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">便民电话</h1>
              <p className="text-muted-foreground mt-1">
                查询小区物业、居委会及街道服务电话
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Content */}
      <Suspense fallback={
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center py-12">
            <div className="text-muted-foreground">加载中...</div>
          </div>
        </section>
      }>
        <ServicesContent />
      </Suspense>
    </div>
  )
}
