'use client'

import { useState } from 'react'
import Link from 'next/link'
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
  Building2,
  Eye,
  X
} from 'lucide-react'

interface UploadStatus {
  primary: 'idle' | 'uploading' | 'success' | 'error'
  middle: 'idle' | 'uploading' | 'success' | 'error'
}

interface SchoolInfo {
  name: string
  type: '小学' | '初中'
  communities: string[]
}

interface StreetData {
  name: string
  primaryCount: number
  middleCount: number
  communityCount: number
  primarySchools: SchoolInfo[]
  middleSchools: SchoolInfo[]
  communities: string[]
}

export default function SchoolZonePage() {
  const [primaryFile, setPrimaryFile] = useState<File | null>(null)
  const [middleFile, setMiddleFile] = useState<File | null>(null)
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>({
    primary: 'idle',
    middle: 'idle'
  })
  const [isProcessing, setIsProcessing] = useState(false)
  const [previewData, setPreviewData] = useState<StreetData[] | null>(null)
  const [selectedStreet, setSelectedStreet] = useState<StreetData | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const handleFileSelect = (type: 'primary' | 'middle', file: File | null) => {
    if (type === 'primary') {
      setPrimaryFile(file)
      setUploadStatus(prev => ({ ...prev, primary: file ? 'success' : 'idle' }))
    } else {
      setMiddleFile(file)
      setUploadStatus(prev => ({ ...prev, middle: file ? 'success' : 'idle' }))
    }
    // 清除之前的预览数据
    if (file) {
      setPreviewData(null)
      setMessage(null)
    }
  }

  const handleProcess = async () => {
    if (!primaryFile || !middleFile) {
      setMessage({ type: 'error', text: '请上传小学和中学两个表格' })
      return
    }

    setIsProcessing(true)
    setMessage(null)
    setPreviewData(null)

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
        // 获取完整数据用于预览
        const detailResponse = await fetch('/api/school-zone/preview')
        const detailResult = await detailResponse.json()
        
        if (detailResult.success) {
          const streetsWithDetail = result.streets.map((s: any) => ({
            ...s,
            ...detailResult.data[s.name]
          }))
          setPreviewData(streetsWithDetail)
        } else {
          setPreviewData(result.streets)
        }
        
        setMessage({ 
          type: 'success', 
          text: `成功生成 ${result.streets.length} 个街镇的学区数据，点击下方预览按钮查看详情` 
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

  const handleExportStreet = (street: StreetData) => {
    // 构建导出数据
    const exportData = {
      street: street.name,
      primarySchools: street.primarySchools || [],
      middleSchools: street.middleSchools || [],
      communities: street.communities || [],
      stats: {
        primaryCount: street.primaryCount,
        middleCount: street.middleCount,
        communityCount: street.communityCount
      }
    }

    // 创建 Blob 并下载
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${street.name}.json`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
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
          
          {previewData && previewData.length > 0 && (
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
                生成结果预览（共 {previewData.length} 个街镇）
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
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previewData.map((street) => (
                    <TableRow key={street.name}>
                      <TableCell className="font-medium">{street.name}</TableCell>
                      <TableCell className="text-center">
                        <span className="inline-flex items-center px-2 py-1 rounded-full bg-blue-100 text-blue-700 text-sm">
                          {street.primaryCount} 所
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="inline-flex items-center px-2 py-1 rounded-full bg-amber-100 text-amber-700 text-sm">
                          {street.middleCount} 所
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="inline-flex items-center px-2 py-1 rounded-full bg-green-100 text-green-700 text-sm">
                          {street.communityCount} 个
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedStreet(street)}
                            className="gap-1"
                          >
                            <Eye className="w-4 h-4" />
                            预览
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleExportStreet(street)}
                            className="gap-1 text-green-600 hover:text-green-700 hover:bg-green-50"
                          >
                            <Download className="w-4 h-4" />
                            导出
                          </Button>
                        </div>
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
            <p>3. 预览生成的街镇数据，点击&quot;预览&quot;按钮查看学校对口小区详情</p>
            <p>4. 点击&quot;导出&quot;按钮可单独下载某个街镇的学区JSON文件</p>
            <p>5. 确认无误后点击&quot;发布到小程序&quot;生成所有JSON文件</p>
          </CardContent>
        </Card>
      </div>

      {/* Preview Dialog */}
      <Dialog open={!!selectedStreet} onOpenChange={() => setSelectedStreet(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapPin className="w-5 h-5" />
              {selectedStreet?.name} - 学区详情
            </DialogTitle>
          </DialogHeader>
          
          {selectedStreet && (
            <div className="space-y-6">
              {/* Stats */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-blue-50 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-blue-600">{selectedStreet.primaryCount}</div>
                  <div className="text-sm text-blue-700">小学</div>
                </div>
                <div className="bg-amber-50 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-amber-600">{selectedStreet.middleCount}</div>
                  <div className="text-sm text-amber-700">初中</div>
                </div>
                <div className="bg-green-50 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-green-600">{selectedStreet.communityCount}</div>
                  <div className="text-sm text-green-700">小区</div>
                </div>
              </div>

              {/* Primary Schools */}
              {selectedStreet.primarySchools && selectedStreet.primarySchools.length > 0 && (
                <div>
                  <h3 className="font-semibold text-blue-700 mb-3 flex items-center gap-2">
                    <School className="w-4 h-4" />
                    小学（{selectedStreet.primarySchools.length}所）
                  </h3>
                  <div className="space-y-3">
                    {selectedStreet.primarySchools.map((school, idx) => (
                      <div key={idx} className="border rounded-lg p-3">
                        <div className="font-medium mb-2">{school.name}</div>
                        <div className="text-sm text-muted-foreground">
                          对口小区：{school.communities?.slice(0, 5).join('、')}
                          {school.communities?.length > 5 && ` 等${school.communities.length}个小区`}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Middle Schools */}
              {selectedStreet.middleSchools && selectedStreet.middleSchools.length > 0 && (
                <div>
                  <h3 className="font-semibold text-amber-700 mb-3 flex items-center gap-2">
                    <Building2 className="w-4 h-4" />
                    初中（{selectedStreet.middleSchools.length}所）
                  </h3>
                  <div className="space-y-3">
                    {selectedStreet.middleSchools.map((school, idx) => (
                      <div key={idx} className="border rounded-lg p-3">
                        <div className="font-medium mb-2">{school.name}</div>
                        <div className="text-sm text-muted-foreground">
                          对口小区：{school.communities?.slice(0, 5).join('、')}
                          {school.communities?.length > 5 && ` 等${school.communities.length}个小区`}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Communities */}
              {selectedStreet.communities && selectedStreet.communities.length > 0 && (
                <div>
                  <h3 className="font-semibold text-green-700 mb-3 flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    所有小区（{selectedStreet.communities.length}个）
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {selectedStreet.communities.map((community, idx) => (
                      <span 
                        key={idx} 
                        className="px-2 py-1 bg-gray-100 rounded text-sm text-gray-700"
                      >
                        {community}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
