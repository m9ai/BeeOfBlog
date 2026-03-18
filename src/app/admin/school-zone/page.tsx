'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  ArrowLeft,
  Upload,
  FileSpreadsheet,
  Download,
  School,
  AlertCircle,
  CheckCircle,
  Loader2,
  MapPin,
  Building2
} from 'lucide-react'

interface UploadStatus {
  primary: 'idle' | 'uploading' | 'success' | 'error'
  middle: 'idle' | 'uploading' | 'success' | 'error'
}

interface StreetData {
  name: string
  primaryCount: number
  middleCount: number
  communityCount: number
}

export default function SchoolZonePage() {
  const router = useRouter()
  const [primaryFile, setPrimaryFile] = useState<File | null>(null)
  const [middleFile, setMiddleFile] = useState<File | null>(null)
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>({
    primary: 'idle',
    middle: 'idle'
  })
  const [isProcessing, setIsProcessing] = useState(false)
  const [previewData, setPreviewData] = useState<StreetData[] | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const handleFileSelect = (type: 'primary' | 'middle', file: File | null) => {
    if (type === 'primary') {
      setPrimaryFile(file)
      setUploadStatus(prev => ({ ...prev, primary: file ? 'success' : 'idle' }))
    } else {
      setMiddleFile(file)
      setUploadStatus(prev => ({ ...prev, middle: file ? 'success' : 'idle' }))
    }
  }

  const handleProcess = async () => {
    if (!primaryFile || !middleFile) {
      setMessage({ type: 'error', text: '请上传小学和中学两个表格' })
      return
    }

    setIsProcessing(true)
    setMessage(null)

    try {
      const formData = new FormData()
      formData.append('primary', primaryFile)
      formData.append('middle', middleFile)

      const response = await fetch('/api/school-zone/process', {
        method: 'POST',
        body: formData
      })

      const result = await response.json()

      if (result.success) {
        setPreviewData(result.streets)
        setMessage({ 
          type: 'success', 
          text: `成功生成 ${result.streets.length} 个街镇的学区数据` 
        })
      } else {
        setMessage({ type: 'error', text: result.error || '处理失败' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: '上传处理失败: ' + (error as Error).message })
    } finally {
      setIsProcessing(false)
    }
  }

  const handlePublish = async () => {
    setIsProcessing(true)
    try {
      const response = await fetch('/api/school-zone/publish', {
        method: 'POST'
      })
      const result = await response.json()
      
      if (result.success) {
        setMessage({ 
          type: 'success', 
          text: `成功发布到小程序！共 ${result.fileCount} 个文件` 
        })
      } else {
        setMessage({ type: 'error', text: result.error || '发布失败' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: '发布失败: ' + (error as Error).message })
    } finally {
      setIsProcessing(false)
    }
  }

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
                <h1 className="text-2xl font-bold">学区管理</h1>
                <p className="text-sm text-muted-foreground">
                  上传学区划分表，生成各街镇学区数据
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Upload Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Primary School Upload */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <School className="w-5 h-5 text-blue-500" />
                小学学区表
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div 
                  className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
                    uploadStatus.primary === 'success' 
                      ? 'border-green-500 bg-green-50' 
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={(e) => handleFileSelect('primary', e.target.files?.[0] || null)}
                    className="hidden"
                    id="primary-upload"
                  />
                  <label htmlFor="primary-upload" className="cursor-pointer">
                    {uploadStatus.primary === 'success' ? (
                      <>
                        <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-2" />
                        <p className="text-green-600 font-medium">{primaryFile?.name}</p>
                        <p className="text-sm text-muted-foreground">点击更换文件</p>
                      </>
                    ) : (
                      <>
                        <Upload className="w-12 h-12 text-muted-foreground mx-auto mb-2" />
                        <p className="font-medium">点击上传小学学区表</p>
                        <p className="text-sm text-muted-foreground">支持 .xlsx, .xls 格式</p>
                      </>
                    )}
                  </label>
                </div>
                <div className="text-sm text-muted-foreground">
                  <p>表格需包含列：</p>
                  <ul className="list-disc list-inside mt-1 space-y-1">
                    <li>学校名称</li>
                    <li>对口地段所属街镇</li>
                    <li>小区名称</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Middle School Upload */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-amber-500" />
                中学学区表
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div 
                  className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
                    uploadStatus.middle === 'success' 
                      ? 'border-green-500 bg-green-50' 
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={(e) => handleFileSelect('middle', e.target.files?.[0] || null)}
                    className="hidden"
                    id="middle-upload"
                  />
                  <label htmlFor="middle-upload" className="cursor-pointer">
                    {uploadStatus.middle === 'success' ? (
                      <>
                        <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-2" />
                        <p className="text-green-600 font-medium">{middleFile?.name}</p>
                        <p className="text-sm text-muted-foreground">点击更换文件</p>
                      </>
                    ) : (
                      <>
                        <Upload className="w-12 h-12 text-muted-foreground mx-auto mb-2" />
                        <p className="font-medium">点击上传中学学区表</p>
                        <p className="text-sm text-muted-foreground">支持 .xlsx, .xls 格式</p>
                      </>
                    )}
                  </label>
                </div>
                <div className="text-sm text-muted-foreground">
                  <p>表格需包含列：</p>
                  <ul className="list-disc list-inside mt-1 space-y-1">
                    <li>学校名称</li>
                    <li>对口地段所属街镇</li>
                    <li>小区名称</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-center gap-4">
          <Button
            onClick={handleProcess}
            disabled={!primaryFile || !middleFile || isProcessing}
            className="gap-2"
            size="lg"
          >
            {isProcessing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <FileSpreadsheet className="w-4 h-4" />
            )}
            {isProcessing ? '处理中...' : '生成学区数据'}
          </Button>
          
          {previewData && (
            <Button
              onClick={handlePublish}
              disabled={isProcessing}
              variant="outline"
              className="gap-2"
              size="lg"
            >
              <Download className="w-4 h-4" />
              发布到小程序
            </Button>
          )}
        </div>

        {/* Message */}
        {message && (
          <Alert variant={message.type === 'error' ? 'destructive' : 'default'}>
            <AlertCircle className="w-4 h-4" />
            <AlertDescription>{message.text}</AlertDescription>
          </Alert>
        )}

        {/* Preview Table */}
        {previewData && previewData.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="w-5 h-5" />
                生成结果预览
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>街镇名称</TableHead>
                    <TableHead className="text-center">小学数量</TableHead>
                    <TableHead className="text-center">初中数量</TableHead>
                    <TableHead className="text-center">小区总数</TableHead>
                    <TableHead className="text-right">状态</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previewData.map((street) => (
                    <TableRow key={street.name}>
                      <TableCell className="font-medium">{street.name}</TableCell>
                      <TableCell className="text-center">{street.primaryCount}</TableCell>
                      <TableCell className="text-center">{street.middleCount}</TableCell>
                      <TableCell className="text-center">{street.communityCount}</TableCell>
                      <TableCell className="text-right">
                        <span className="text-green-600 text-sm">✓ 已生成</span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* Instructions */}
        <Card className="bg-blue-50 border-blue-200">
          <CardHeader>
            <CardTitle className="text-blue-800 text-base">使用说明</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-blue-700 space-y-2">
            <p>1. 上传小学和中学的学区划分Excel表格</p>
            <p>2. 点击&quot;生成学区数据&quot;，系统将自动按街镇分组处理</p>
            <p>3. 预览生成的街镇数据，确认无误后点击&quot;发布到小程序&quot;</p>
            <p>4. 发布后会自动生成 public/feeds/school_data/ 下的各街镇JSON文件</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
