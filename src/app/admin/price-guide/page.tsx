'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  ArrowLeft,
  Save,
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  FileText,
  Upload,
  Image as ImageIcon,
  X,
  AlertCircle,
  CheckCircle,
  Loader2,
  Receipt,
  Calendar,
  Smartphone,
  ScanText,
  Wand2
} from 'lucide-react'

interface PriceItem {
  id: string
  name: string
  description?: string
  unit?: string
  price?: string
  notes?: string
}

interface PriceCategory {
  id: string
  name: string
  icon: string
  items: PriceItem[]
}

interface PriceGuideData {
  updateDate: string
  categories: PriceCategory[]
}

interface PdfImage {
  page: number
  base64: string
}

// 默认类别（按PDF顺序）
const DEFAULT_CATEGORIES: PriceCategory[] = [
  { id: 'water', name: '水电气', icon: '💧', items: [] },
  { id: 'transport', name: '公共汽（电）车、轨道交通', icon: '🚌', items: [] },
  { id: 'taxi', name: '市域巡游出租车', icon: '🚕', items: [] },
  { id: 'ferry', name: '黄浦江过江轮渡', icon: '⛴️', items: [] },
  { id: 'tv', name: '有线电视', icon: '📺', items: [] },
  { id: 'certificate', name: '证件申领', icon: '🪪', items: [] },
  { id: 'medical', name: '医疗服务', icon: '🏥', items: [] },
  { id: 'education', name: '教育', icon: '🎓', items: [] },
  { id: 'scenic', name: '景区门票', icon: '🏞️', items: [] },
  { id: 'highway', name: '高速公路', icon: '🛣️', items: [] },
  { id: 'rescue', name: '高速公路清障救援', icon: '🚑', items: [] },
  { id: 'parking', name: '机动车停放', icon: '🅿️', items: [] },
  { id: 'property', name: '不动产登记', icon: '🏠', items: [] },
]

export default function PriceGuideAdmin() {
  const [data, setData] = useState<PriceGuideData>({
    updateDate: new Date().getFullYear() + '年',
    categories: JSON.parse(JSON.stringify(DEFAULT_CATEGORIES))
  })
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  
  // PDF 图片相关
  const [pdfImages, setPdfImages] = useState<PdfImage[]>([])
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  const [extractingImages, setExtractingImages] = useState(false)
  const [usePdfViewer, setUsePdfViewer] = useState(false)
  const [pdfBase64, setPdfBase64] = useState('')
  const [pdfFile, setPdfFile] = useState<File | null>(null)
  const pdfFileInputRef = useRef<HTMLInputElement>(null)
  
  // OCR 提取相关
  const [extractingPrices, setExtractingPrices] = useState(false)
  const [rawOcrText, setRawOcrText] = useState('')
  const [showOcrResult, setShowOcrResult] = useState(false)
  const [debugInfo, setDebugInfo] = useState<any>(null)
  
  // 图片上传相关
  const [uploadedImages, setUploadedImages] = useState<File[]>([])
  const [imagePreviews, setImagePreviews] = useState<string[]>([])
  const imageFileInputRef = useRef<HTMLInputElement>(null)

  // 加载已有数据
  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const res = await fetch('/api/price-guide/save')
      if (res.ok) {
        const savedData = await res.json()
        if (savedData.categories && savedData.categories.length > 0) {
          setData(savedData)
        }
      }
    } catch (error) {
      console.error('加载数据失败:', error)
    }
  }

  const toggleCategory = (id: string) => {
    const newExpanded = new Set(expandedCategories)
    if (newExpanded.has(id)) {
      newExpanded.delete(id)
    } else {
      newExpanded.add(id)
    }
    setExpandedCategories(newExpanded)
  }

  const addItem = (categoryId: string) => {
    const newItem: PriceItem = {
      id: Date.now().toString(),
      name: '',
      description: '',
      unit: '',
      price: '',
      notes: ''
    }
    
    setData(prev => ({
      ...prev,
      categories: prev.categories.map(cat =>
        cat.id === categoryId
          ? { ...cat, items: [...cat.items, newItem] }
          : cat
      )
    }))
  }

  const removeItem = (categoryId: string, itemId: string) => {
    setData(prev => ({
      ...prev,
      categories: prev.categories.map(cat =>
        cat.id === categoryId
          ? { ...cat, items: cat.items.filter(item => item.id !== itemId) }
          : cat
      )
    }))
  }

  const updateItem = (categoryId: string, itemId: string, field: keyof PriceItem, value: string) => {
    setData(prev => ({
      ...prev,
      categories: prev.categories.map(cat =>
        cat.id === categoryId
          ? {
              ...cat,
              items: cat.items.map(item =>
                item.id === itemId ? { ...item, [field]: value } : item
              )
            }
          : cat
      )
    }))
  }

  const saveData = async () => {
    setLoading(true)
    setMessage(null)
    
    try {
      const res = await fetch('/api/price-guide/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })
      
      if (res.ok) {
        setMessage({ type: 'success', text: '发布成功！' })
      } else {
        const error = await res.json()
        setMessage({ type: 'error', text: '发布失败: ' + error.error })
      }
    } catch (error) {
      setMessage({ type: 'error', text: '发布失败: ' + (error as Error).message })
    } finally {
      setLoading(false)
    }
  }

  // 上传 PDF 并提取图片
  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.name.endsWith('.pdf')) {
      setMessage({ type: 'error', text: '请上传 PDF 文件' })
      return
    }

    setExtractingImages(true)
    setMessage(null)

    const formData = new FormData()
    formData.append('file', file)

    try {
      const res = await fetch('/api/price-guide/extract-images', {
        method: 'POST',
        body: formData
      })

      const result = await res.json()

      if (res.ok) {
        setPdfFile(file)
        if (result.usePdfViewer && result.pdfBase64) {
          setUsePdfViewer(true)
          setPdfBase64(result.pdfBase64)
          setPdfImages([])
          setMessage({ type: 'success', text: `已加载 PDF，共 ${result.totalPages} 页。点击"AI识别价格"自动提取，或对照右侧手动录入` })
        } else if (result.images && result.images.length > 0) {
          setUsePdfViewer(false)
          setPdfImages(result.images)
          setCurrentImageIndex(0)
          setMessage({ type: 'success', text: `已提取 ${result.images.length} 页，点击"AI识别价格"自动提取，或对照右侧手动录入` })
        } else {
          setMessage({ type: 'error', text: '未能提取 PDF 内容' })
        }
      } else {
        setMessage({ type: 'error', text: '提取失败: ' + (result.error || '未知错误') })
      }
    } catch (error) {
      setMessage({ type: 'error', text: '提取失败: ' + (error as Error).message })
    } finally {
      setExtractingImages(false)
      if (pdfFileInputRef.current) {
        pdfFileInputRef.current.value = ''
      }
    }
  }

  const clearPdfImages = () => {
    setPdfImages([])
    setCurrentImageIndex(0)
    setUsePdfViewer(false)
    setPdfBase64('')
    setPdfFile(null)
    setRawOcrText('')
    setShowOcrResult(false)
  }

  // 处理图片上传
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    const newImages: File[] = []
    const newPreviews: string[] = []

    Array.from(files).forEach(file => {
      if (file.type.startsWith('image/')) {
        newImages.push(file)
        newPreviews.push(URL.createObjectURL(file))
      }
    })

    setUploadedImages(prev => [...prev, ...newImages])
    setImagePreviews(prev => [...prev, ...newPreviews])
    setMessage({ type: 'success', text: `已添加 ${newImages.length} 张图片，点击"AI识别价格"提取信息` })
  }

  // 移除单张图片
  const removeImage = (index: number) => {
    setUploadedImages(prev => prev.filter((_, i) => i !== index))
    setImagePreviews(prev => {
      URL.revokeObjectURL(prev[index])
      return prev.filter((_, i) => i !== index)
    })
  }

  // 清空所有图片
  const clearAllImages = () => {
    imagePreviews.forEach(url => URL.revokeObjectURL(url))
    setUploadedImages([])
    setImagePreviews([])
  }

  // OCR 识别图片中的价格
  const extractPricesFromImages = async () => {
    if (uploadedImages.length === 0) {
      setMessage({ type: 'error', text: '请先上传图片' })
      return
    }

    setExtractingPrices(true)
    setDebugInfo(null)
    const estimatedTime = Math.ceil(uploadedImages.length * 10) // 预估每张10秒
    setMessage({ type: 'success', text: `正在识别 ${uploadedImages.length} 张图片，预计需要 ${estimatedTime} 秒，请耐心等待...` })

    const formData = new FormData()
    uploadedImages.forEach(img => formData.append('images', img))

    try {
      // 不使用 AbortController，让请求自然完成
      // Next.js 默认超时是 60 秒，需要在 route.config.ts 中配置
      console.log('[前端] 开始发送请求...')
      const startTime = Date.now()
      
      const res = await fetch('/api/price-guide/extract-from-images', {
        method: 'POST',
        body: formData
        // 不设置 signal，避免超时中断
      })
      
      const requestTime = Date.now() - startTime
      console.log(`[前端] 请求完成，耗时 ${requestTime}ms，状态: ${res.status}`)

      const result = await res.json()
      console.log('[前端] 响应数据:', { success: result.success, hasDebug: !!result.debug, error: result.error })

      if (res.ok && result.success) {
        if (result.categories && result.categories.length > 0) {
          setData(prev => {
            const newCategories = prev.categories.map(cat => {
              const extractedCat = result.categories.find((c: PriceCategory) => c.name === cat.name)
              if (extractedCat && extractedCat.items.length > 0) {
                return { ...cat, items: [...cat.items, ...extractedCat.items] }
              }
              return cat
            })
            return { ...prev, categories: newCategories }
          })
        }
        
        if (result.rawText) setRawOcrText(result.rawText)
        if (result.debug) {
          console.log('[前端] 调试信息:', result.debug)
          setDebugInfo(result.debug)
        }
        
        const totalItems = result.categories?.reduce((sum: number, c: PriceCategory) => sum + c.items.length, 0) || 0
        setShowOcrResult(true)
        setMessage({ type: 'success', text: `识别完成！共提取 ${totalItems} 条价格信息（成功处理 ${result.debug?.successImages || 0}/${result.debug?.totalImages || 0} 张图片，耗时 ${Math.round(requestTime/1000)} 秒）` })
      } else {
        setMessage({ type: 'error', text: '识别失败: ' + (result.error || '未知错误') })
        if (result.logs) {
          console.error('服务器日志:', result.logs)
          setDebugInfo({ logs: result.logs, error: result.error })
        }
      }
    } catch (error) {
      console.error('[前端] 请求错误:', error)
      setMessage({ type: 'error', text: '识别失败: ' + (error as Error).message })
    } finally {
      setExtractingPrices(false)
    }
  }

  const totalItems = data.categories.reduce((sum, cat) => sum + cat.items.length, 0)

  return (
    <div className="min-h-screen">
      {/* Header */}
      <section className="border-b border-border/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/admin">
                <Button variant="ghost" size="icon">
                  <ArrowLeft className="w-5 h-5" />
                </Button>
              </Link>
              <div>
                <h1 className="text-2xl font-bold">物价指南管理</h1>
                <p className="text-sm text-muted-foreground">
                  管理《上海市市民价格信息指南》数据
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Data Overview Card */}
        <Card className="bg-purple-50/50 border-purple-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-purple-800">
              <Calendar className="w-5 h-5" />
              {data.updateDate} 数据概览
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white rounded-lg p-4 border border-purple-100">
                <div className="text-sm text-muted-foreground">更新日期</div>
                <div className="text-xl font-semibold text-purple-700">{data.updateDate}</div>
              </div>
              <div className="bg-white rounded-lg p-4 border border-purple-100">
                <div className="text-sm text-muted-foreground">类别数量</div>
                <div className="text-xl font-semibold text-purple-700">{data.categories.length} 个</div>
              </div>
              <div className="bg-white rounded-lg p-4 border border-purple-100">
                <div className="text-sm text-muted-foreground">价格项目</div>
                <div className="text-xl font-semibold text-purple-700">{totalItems} 条</div>
              </div>
              <div className="bg-white rounded-lg p-4 border border-purple-100">
                <div className="text-sm text-muted-foreground">数据来源</div>
                <div className="text-xl font-semibold text-purple-700">市发改委</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Upload PDF Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Receipt className="w-5 h-5 text-purple-500" />
              上传 PDF 文档
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div 
                className={`border-2 border-dashed rounded-xl p-12 text-center transition-colors ${
                  pdfImages.length > 0 || usePdfViewer
                    ? 'border-green-500 bg-green-50' 
                    : 'border-border hover:border-primary/50'
                }`}
              >
                <input
                  type="file"
                  ref={pdfFileInputRef}
                  accept=".pdf"
                  onChange={handlePdfUpload}
                  className="hidden"
                />
                <label 
                  htmlFor="pdf-upload" 
                  className="cursor-pointer"
                  onClick={() => pdfFileInputRef.current?.click()}
                >
                  {pdfImages.length > 0 || usePdfViewer ? (
                    <>
                      <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-2" />
                      <p className="text-green-600 font-medium">PDF 已加载</p>
                      <p className="text-sm text-muted-foreground">点击更换文件</p>
                    </>
                  ) : (
                    <>
                      <Upload className="w-12 h-12 text-muted-foreground mx-auto mb-2" />
                      <p className="font-medium">点击上传 PDF 文档</p>
                      <p className="text-sm text-muted-foreground mt-1">支持 .pdf 格式</p>
                      <p className="text-xs text-muted-foreground mt-2">来源：《上海市市民价格信息指南》</p>
                    </>
                  )}
                </label>
              </div>

              {/* 图片上传区域 */}
              <div className="border-2 border-dashed border-border rounded-xl p-8 text-center">
                <input
                  type="file"
                  ref={imageFileInputRef}
                  accept="image/*"
                  multiple
                  onChange={handleImageUpload}
                  className="hidden"
                />
                
                {imagePreviews.length === 0 ? (
                  <div 
                    className="cursor-pointer"
                    onClick={() => imageFileInputRef.current?.click()}
                  >
                    <ImageIcon className="w-12 h-12 text-muted-foreground mx-auto mb-2" />
                    <p className="font-medium">点击上传图片</p>
                    <p className="text-sm text-muted-foreground mt-1">支持 JPG、PNG 格式，可多选</p>
                    <p className="text-xs text-muted-foreground mt-2">将 PDF 导出为图片后上传</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="grid grid-cols-4 md:grid-cols-6 gap-2">
                      {imagePreviews.map((url, idx) => (
                        <div key={idx} className="relative aspect-square">
                          <img src={url} alt={`图片 ${idx + 1}`} className="w-full h-full object-cover rounded-lg" />
                          <button
                            onClick={() => removeImage(idx)}
                            className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full text-xs hover:bg-red-600"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                    <div className="flex justify-center gap-2">
                      <Button variant="outline" size="sm" onClick={() => imageFileInputRef.current?.click()}>
                        添加更多
                      </Button>
                      <Button variant="ghost" size="sm" onClick={clearAllImages} className="text-red-500">
                        清空
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex justify-center gap-4 flex-wrap">
                <Button
                  onClick={() => imageFileInputRef.current?.click()}
                  className="gap-2"
                  size="lg"
                >
                  <ImageIcon className="w-4 h-4" />
                  上传图片
                </Button>
                
                {uploadedImages.length > 0 && (
                  <Button
                    onClick={extractPricesFromImages}
                    disabled={extractingPrices}
                    className="gap-2 bg-purple-600 hover:bg-purple-700"
                    size="lg"
                  >
                    {extractingPrices ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Wand2 className="w-4 h-4" />
                    )}
                    {extractingPrices ? '识别中...' : 'AI 识别价格'}
                  </Button>
                )}
                
                <Button
                  onClick={saveData}
                  disabled={loading}
                  className="gap-2 bg-green-600 hover:bg-green-700"
                  size="lg"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  {loading ? '保存中...' : '发布更新'}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Message */}
        {message && (
          <Alert variant={message.type === 'error' ? 'destructive' : 'default'}>
            <AlertCircle className="w-4 h-4" />
            <AlertDescription>{message.text}</AlertDescription>
          </Alert>
        )}

        {/* 调试信息 */}
        {debugInfo && (
          <Card className="border-yellow-200 bg-yellow-50/30">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm text-yellow-800">
                <AlertCircle className="w-4 h-4" />
                调试信息
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setDebugInfo(null)}
                  className="ml-auto"
                >
                  隐藏
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {debugInfo.imageResults && (
                  <div className="text-xs">
                    <p className="font-medium">图片处理结果：</p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-1">
                      {debugInfo.imageResults.map((r: any, i: number) => (
                        <div key={i} className={`p-2 rounded ${r.success ? 'bg-green-100' : 'bg-red-100'}`}>
                          <p className="truncate">{r.name}</p>
                          <p className="text-muted-foreground">{r.success ? `${r.textLength}字/${r.timeMs}ms` : `失败: ${r.error?.substring(0, 20)}`}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {debugInfo.logs && (
                  <details className="text-xs">
                    <summary className="cursor-pointer font-medium">完整日志 ({debugInfo.logs.length} 条)</summary>
                    <pre className="mt-2 bg-muted p-2 rounded max-h-48 overflow-auto">
                      {debugInfo.logs.map((l: any) => `[${l.step}] ${l.message}`).join('\n')}
                    </pre>
                  </details>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* OCR 原始文本查看器 */}
        {showOcrResult && rawOcrText && (
          <Card className="border-purple-200">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm text-purple-700">
                <ScanText className="w-4 h-4" />
                OCR 识别原始文本（调试参考）
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setShowOcrResult(false)}
                  className="ml-auto"
                >
                  隐藏
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="text-xs text-muted-foreground bg-muted p-4 rounded-lg max-h-48 overflow-auto whitespace-pre-wrap">
                {rawOcrText}
              </pre>
            </CardContent>
          </Card>
        )}

        {/* Main Content: Categories + PDF Preview */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Categories */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">价格类别</h3>
            <div className="space-y-3">
              {data.categories.map((category, catIndex) => (
                <Card key={category.id} className="overflow-hidden">
                  <button
                    onClick={() => toggleCategory(category.id)}
                    className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{category.icon}</span>
                      <div className="text-left">
                        <span className="font-medium">{catIndex + 1}. {category.name}</span>
                        <Badge variant="secondary" className="ml-2">
                          {category.items.length} 项
                        </Badge>
                      </div>
                    </div>
                    {expandedCategories.has(category.id) ? (
                      <ChevronDown className="w-5 h-5 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="w-5 h-5 text-muted-foreground" />
                    )}
                  </button>

                  {expandedCategories.has(category.id) && (
                    <div className="px-4 pb-4 border-t bg-muted/30">
                      <div className="space-y-3 pt-3">
                        {category.items.map((item, itemIndex) => (
                          <Card key={item.id} className="p-4">
                            <div className="flex items-center gap-2 mb-3">
                              <Badge variant="outline" className="text-xs">
                                #{itemIndex + 1}
                              </Badge>
                              <Input
                                value={item.name}
                                onChange={e => updateItem(category.id, item.id, 'name', e.target.value)}
                                placeholder="项目名称"
                                className="flex-1"
                              />
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => removeItem(category.id, item.id)}
                                className="text-destructive hover:text-destructive"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                            
                            <div className="grid grid-cols-3 gap-3">
                              <Input
                                value={item.description || ''}
                                onChange={e => updateItem(category.id, item.id, 'description', e.target.value)}
                                placeholder="说明/描述"
                              />
                              <Input
                                value={item.unit || ''}
                                onChange={e => updateItem(category.id, item.id, 'unit', e.target.value)}
                                placeholder="单位"
                              />
                              <Input
                                value={item.price || ''}
                                onChange={e => updateItem(category.id, item.id, 'price', e.target.value)}
                                placeholder="价格"
                              />
                            </div>
                            
                            <Textarea
                              value={item.notes || ''}
                              onChange={e => updateItem(category.id, item.id, 'notes', e.target.value)}
                              placeholder="备注信息（如分档计价详情）"
                              className="mt-3"
                              rows={2}
                            />
                          </Card>
                        ))}
                        
                        <Button
                          variant="outline"
                          onClick={() => addItem(category.id)}
                          className="w-full gap-2"
                        >
                          <Plus className="w-4 h-4" />
                          添加项目
                        </Button>
                      </div>
                    </div>
                  )}
                </Card>
              ))}
            </div>
          </div>

          {/* Right: PDF Preview */}
          {(pdfImages.length > 0 || usePdfViewer) && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">PDF 预览</h3>
                <div className="flex items-center gap-2">
                  {!usePdfViewer && (
                    <Badge variant="secondary">
                      {currentImageIndex + 1} / {pdfImages.length}
                    </Badge>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={clearPdfImages}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <Card className="overflow-hidden">
                <div className="aspect-[3/4] bg-muted">
                  {usePdfViewer && pdfBase64 ? (
                    <iframe
                      src={pdfBase64}
                      className="w-full h-full"
                    />
                  ) : pdfImages[currentImageIndex] ? (
                    <img
                      src={pdfImages[currentImageIndex].base64}
                      alt={`第 ${currentImageIndex + 1} 页`}
                      className="w-full h-full object-contain"
                    />
                  ) : null}
                </div>
              </Card>

              {/* Page Navigation */}
              {!usePdfViewer && pdfImages.length > 0 && (
                <div className="flex items-center justify-between gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setCurrentImageIndex(prev => Math.max(0, prev - 1))}
                    disabled={currentImageIndex === 0}
                  >
                    上一页
                  </Button>
                  
                  <div className="flex-1 overflow-x-auto">
                    <div className="flex gap-1 justify-center">
                      {pdfImages.map((_, idx) => (
                        <Button
                          key={idx}
                          variant={idx === currentImageIndex ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setCurrentImageIndex(idx)}
                          className="w-8 h-8 p-0"
                        >
                          {idx + 1}
                        </Button>
                      ))}
                    </div>
                  </div>
                  
                  <Button
                    variant="outline"
                    onClick={() => setCurrentImageIndex(prev => Math.min(pdfImages.length - 1, prev + 1))}
                    disabled={currentImageIndex === pdfImages.length - 1}
                  >
                    下一页
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
