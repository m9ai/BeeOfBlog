'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  ArrowLeft,
  Upload,
  FileSpreadsheet,
  Carrot,
  AlertCircle,
  CheckCircle,
  Loader2,
  Store,
  Calendar,
  RefreshCw,
  Download,
  MapPin,
  Building2,
  Smartphone
} from 'lucide-react'

interface VegetablePrice {
  name: string
  category: string
  unit: string
  price: number
  trend: 'up' | 'down' | 'stable'
}

interface MarketInfo {
  market: string
  priceCount: number
  prices?: VegetablePrice[]
}

interface DistrictData {
  district: string
  markets: MarketInfo[]
}

interface PriceData {
  updateDate: string
  districts: DistrictData[]
}

interface TrendStats {
  upCount: number
  downCount: number
  stableCount: number
  totalCount: number
}

// 默认小程序展示的区
const DEFAULT_DISTRICT = '浦东新区'

export default function VegetablePricesPage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle')
  const [isProcessing, setIsProcessing] = useState(false)
  const [previewData, setPreviewData] = useState<PriceData | null>(null)
  const [currentData, setCurrentData] = useState<PriceData | null>(null)
  const [selectedDistrict, setSelectedDistrict] = useState<string>('')
  const [publishedFiles, setPublishedFiles] = useState<string[]>([])
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [trendStats, setTrendStats] = useState<TrendStats | null>(null)
  const [comparisonDate, setComparisonDate] = useState<string | null>(null)

  // 加载当前已发布的数据
  useEffect(() => {
    loadCurrentData()
  }, [])

  const loadCurrentData = async () => {
    try {
      // 优先加载完整数据文件
      const response = await fetch('/feeds/vegetable_prices_full.json')
      if (response.ok) {
        const data = await response.json()
        // 新格式（多区）
        let formattedData: PriceData
        if (data.districts) {
          formattedData = {
            updateDate: data.updateDate,
            districts: data.districts.map((d: any) => ({
              district: d.district,
              markets: d.markets?.map((m: any) => ({
                market: m.market,
                priceCount: m.prices?.length || 0,
                prices: m.prices
              })) || []
            }))
          }
        } else {
          // 旧格式（单区）
          formattedData = {
            updateDate: data.updateDate,
            districts: [{
              district: data.district || '浦东新区',
              markets: data.markets?.map((m: any) => ({
                market: m.market,
                priceCount: m.prices?.length || 0,
                prices: m.prices
              })) || []
            }]
          }
        }
        setCurrentData(formattedData)
        if (formattedData.districts.length > 0 && !selectedDistrict) {
          setSelectedDistrict(formattedData.districts[0].district)
        }
      }
    } catch (error) {
      console.log('暂无已发布数据')
    }
  }

  const handleFileSelect = (file: File | null) => {
    setSelectedFile(file)
    setUploadStatus(file ? 'success' : 'idle')
    if (file) {
      setPreviewData(null)
      setMessage(null)
    }
  }

  const handleProcess = async () => {
    if (!selectedFile) {
      setMessage({ type: 'error', text: '请选择XLS文件' })
      return
    }

    setIsProcessing(true)
    setMessage(null)
    setPreviewData(null)

    try {
      const formData = new FormData()
      formData.append('file', selectedFile)

      const response = await fetch('/api/vegetable-prices/process', {
        method: 'POST',
        body: formData
      })

      const result = await response.json()

      if (result.success) {
        const formattedData: PriceData = {
          updateDate: result.data.updateDate,
          districts: result.data.districts?.map((d: any) => ({
            district: d.district,
            markets: d.markets?.map((m: any) => ({
              market: m.market,
              priceCount: m.prices?.length || 0,
              prices: m.prices
            })) || []
          })) || []
        }
        setPreviewData(formattedData)
        if (formattedData.districts.length > 0) {
          setSelectedDistrict(formattedData.districts[0].district)
        }
        
        const totalMarkets = formattedData.districts.reduce((sum, d) => sum + d.markets.length, 0)
        const totalPrices = formattedData.districts.reduce((sum, d) => 
          sum + d.markets.reduce((mSum, m) => mSum + m.priceCount, 0), 0)
        
        setMessage({ 
          type: 'success', 
          text: `成功处理！采价日期: ${result.data.updateDate}，共 ${formattedData.districts.length} 个区，${totalMarkets} 个菜市场，${totalPrices} 条价格数据` 
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
      const response = await fetch('/api/vegetable-prices/publish', {
        method: 'POST'
      })
      const result = await response.json()
      
      if (result.success) {
        setPublishedFiles(result.data.publishedFiles || [])
        setTrendStats(result.data.trendStats || null)
        setComparisonDate(result.data.comparisonDate || null)
        
        // 构建趋势统计信息
        const stats = result.data.trendStats
        let trendText = ''
        if (stats) {
          trendText = `，价格趋势: ↑${stats.upCount} ↓${stats.downCount} →${stats.stableCount}`
          if (result.data.comparisonDate) {
            trendText += ` (与 ${result.data.comparisonDate} 对比)`
          }
        }
        
        setMessage({ 
          type: 'success', 
          text: `成功发布！共生成 ${result.data.districtCount} 个区县的价格表文件${trendText}` 
        })
        // 刷新当前数据
        await loadCurrentData()
        setPreviewData(null)
        setSelectedFile(null)
        setUploadStatus('idle')
      } else {
        setMessage({ type: 'error', text: result.error || '发布失败' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: '发布失败: ' + (error as Error).message })
    } finally {
      setIsProcessing(false)
    }
  }

  const handleDownloadTemplate = () => {
    const templateInfo = `今日菜价数据上传说明

1. 文件格式: Excel (.xls 或 .xlsx)

2. 数据来源: 上海市发展和改革委员会价格监测中心发布的主副食品价格报表

3. 表格结构要求:
   - 第3行: 品类信息
   - 第4行: 商品名称
   - 第6行: 计量单位
   - 第8行开始: 各市场数据
   - A列: 区县
   - B列: 市场名称
   - C列开始: 各商品价格

4. 系统会自动:
   - 提取采价日期
   - 保留所有品类数据（粮食、食用油、肉禽蛋、鱼虾、蔬菜、水果等）
   - 提取所有区县的菜市场数据
   - 生成JSON文件供小程序使用

5. 支持的区县:
   - 浦东新区、黄浦区、静安区、徐汇区
   - 长宁区、普陀区、虹口区、杨浦区
   - 宝山区、闵行区、嘉定区、金山区
   - 松江区、青浦区、奉贤区、崇明区

6. 发布后文件:
   - 系统会为每个区县生成单独的JSON文件
   - 文件命名格式：vegetable_prices_区县名.json
   - 例如：vegetable_prices_浦东新区.json、vegetable_prices_黄浦区.json
   - 同时生成完整数据文件：vegetable_prices_full.json

7. 小程序数据:
   - 小程序默认加载浦东新区的价格表文件
   - 文件路径：/feeds/vegetable_prices_浦东新区.json

8. 注意事项:
   - 请确保文件格式与原始报表一致
   - 系统会自动识别所有包含有效数据的区县
   - 保留所有品类数据
`
    const blob = new Blob([templateInfo], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = '菜价上传说明.txt'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  // 获取当前选中的区数据
  const getCurrentDistrictData = () => {
    const data = previewData || currentData
    if (!data || !selectedDistrict) return null
    return data.districts.find(d => d.district === selectedDistrict) || null
  }

  // 获取浦东新区数据
  const getPudongData = () => {
    const data = previewData || currentData
    if (!data) return null
    return data.districts.find(d => d.district.includes('浦东')) || data.districts[0] || null
  }

  // 计算统计数据
  const getStats = (data: PriceData | null) => {
    if (!data) return { districtCount: 0, marketCount: 0, priceCount: 0 }
    const districtCount = data.districts.length
    const marketCount = data.districts.reduce((sum, d) => sum + d.markets.length, 0)
    const priceCount = data.districts.reduce((sum, d) => 
      sum + d.markets.reduce((mSum, m) => mSum + m.priceCount, 0), 0)
    return { districtCount, marketCount, priceCount }
  }

  const currentDistrictData = getCurrentDistrictData()
  const pudongData = getPudongData()
  const currentStats = getStats(previewData || currentData)

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
                <h1 className="text-2xl font-bold">今日菜价管理</h1>
                <p className="text-sm text-muted-foreground">
                  上传每日价格数据，包含粮食、食用油、肉禽蛋、鱼虾、蔬菜、水果等
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              onClick={handleDownloadTemplate}
              className="gap-2"
            >
              <Download className="w-4 h-4" />
              下载说明
            </Button>
          </div>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Current Data Card */}
        {(previewData || currentData) && (
          <Card className="bg-green-50/50 border-green-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-green-800">
                <Calendar className="w-5 h-5" />
                {(previewData || currentData)?.updateDate} 数据概览
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white rounded-lg p-4 border border-green-100">
                  <div className="text-sm text-muted-foreground">采价日期</div>
                  <div className="text-xl font-semibold text-green-700">{(previewData || currentData)?.updateDate}</div>
                </div>
                <div className="bg-white rounded-lg p-4 border border-green-100">
                  <div className="text-sm text-muted-foreground">区县数量</div>
                  <div className="text-xl font-semibold text-green-700">{currentStats.districtCount} 个</div>
                </div>
                <div className="bg-white rounded-lg p-4 border border-green-100">
                  <div className="text-sm text-muted-foreground">菜市场数量</div>
                  <div className="text-xl font-semibold text-green-700">{currentStats.marketCount} 个</div>
                </div>
                <div className="bg-white rounded-lg p-4 border border-green-100">
                  <div className="text-sm text-muted-foreground">价格数据条数</div>
                  <div className="text-xl font-semibold text-green-700">{currentStats.priceCount} 条</div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Mini Program Display Card */}
        {(previewData || currentData) && pudongData && (
          <Card className="bg-orange-50/50 border-orange-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-orange-800">
                <Smartphone className="w-5 h-5" />
                小程序展示数据（默认：浦东新区）
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white rounded-lg p-4 border border-orange-100">
                  <div className="text-sm text-muted-foreground">展示区县</div>
                  <div className="text-xl font-semibold text-orange-700 flex items-center gap-2">
                    {pudongData.district}
                    <Badge variant="secondary">默认</Badge>
                  </div>
                </div>
                <div className="bg-white rounded-lg p-4 border border-orange-100">
                  <div className="text-sm text-muted-foreground">菜市场数量</div>
                  <div className="text-xl font-semibold text-orange-700">{pudongData.markets.length} 个</div>
                </div>
                <div className="bg-white rounded-lg p-4 border border-orange-100">
                  <div className="text-sm text-muted-foreground">价格数据条数</div>
                  <div className="text-xl font-semibold text-orange-700">
                    {pudongData.markets.reduce((sum, m) => sum + m.priceCount, 0)} 条
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Upload Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Carrot className="w-5 h-5 text-orange-500" />
              上传菜价数据
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div 
                className={`border-2 border-dashed rounded-xl p-12 text-center transition-colors ${
                  uploadStatus === 'success' 
                    ? 'border-green-500 bg-green-50' 
                    : 'border-border hover:border-primary/50'
                }`}
              >
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={(e) => handleFileSelect(e.target.files?.[0] || null)}
                  className="hidden"
                  id="price-upload"
                />
                <label htmlFor="price-upload" className="cursor-pointer">
                  {uploadStatus === 'success' ? (
                    <>
                      <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-2" />
                      <p className="text-green-600 font-medium">{selectedFile?.name}</p>
                      <p className="text-sm text-muted-foreground">点击更换文件</p>
                    </>
                  ) : (
                    <>
                      <Upload className="w-12 h-12 text-muted-foreground mx-auto mb-2" />
                      <p className="font-medium">点击上传菜价Excel文件</p>
                      <p className="text-sm text-muted-foreground mt-1">支持 .xlsx, .xls 格式</p>
                      <p className="text-xs text-muted-foreground mt-2">文件来源：上海市发改委价格监测中心主副食品价格报表</p>
                    </>
                  )}
                </label>
              </div>



              {/* Action Buttons */}
              <div className="flex justify-center gap-4">
                <Button
                  onClick={handleProcess}
                  disabled={!selectedFile || isProcessing}
                  className="gap-2"
                  size="lg"
                >
                  {isProcessing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <FileSpreadsheet className="w-4 h-4" />
                  )}
                  {isProcessing ? '处理中...' : '预览数据'}
                </Button>
                
                {previewData && (
                  <Button
                    onClick={handlePublish}
                    disabled={isProcessing}
                    className="gap-2 bg-green-600 hover:bg-green-700"
                    size="lg"
                  >
                    <RefreshCw className="w-4 h-4" />
                    发布更新
                  </Button>
                )}
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

        {/* Published Files List */}
        {publishedFiles.length > 0 && (
          <Card className="bg-purple-50/50 border-purple-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-purple-800">
                <FileSpreadsheet className="w-5 h-5" />
                已发布的价格表文件
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {publishedFiles.map((fileName) => (
                  <div 
                    key={fileName}
                    className="bg-white rounded-lg p-3 border border-purple-100 flex items-center gap-2"
                  >
                    <FileSpreadsheet className="w-4 h-4 text-purple-500" />
                    <code className="text-sm text-purple-700">{fileName}</code>
                    {fileName.includes('full') && (
                      <Badge variant="secondary" className="ml-auto">完整数据</Badge>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Trend Statistics */}
        {trendStats && trendStats.totalCount > 0 && (
          <Card className="bg-gradient-to-r from-orange-50 to-amber-50 border-orange-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-orange-800">
                <RefreshCw className="w-5 h-5" />
                价格趋势分析
                {comparisonDate && (
                  <span className="text-sm font-normal text-orange-600">
                    (与 {comparisonDate} 数据对比)
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white rounded-lg p-4 border border-orange-100">
                  <div className="text-sm text-muted-foreground">价格上涨</div>
                  <div className="text-2xl font-bold text-red-600 flex items-center gap-1">
                    ↑ {trendStats.upCount}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {((trendStats.upCount / trendStats.totalCount) * 100).toFixed(1)}%
                  </div>
                </div>
                <div className="bg-white rounded-lg p-4 border border-orange-100">
                  <div className="text-sm text-muted-foreground">价格下跌</div>
                  <div className="text-2xl font-bold text-green-600 flex items-center gap-1">
                    ↓ {trendStats.downCount}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {((trendStats.downCount / trendStats.totalCount) * 100).toFixed(1)}%
                  </div>
                </div>
                <div className="bg-white rounded-lg p-4 border border-orange-100">
                  <div className="text-sm text-muted-foreground">价格持平</div>
                  <div className="text-2xl font-bold text-gray-600 flex items-center gap-1">
                    → {trendStats.stableCount}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {((trendStats.stableCount / trendStats.totalCount) * 100).toFixed(1)}%
                  </div>
                </div>
                <div className="bg-white rounded-lg p-4 border border-orange-100">
                  <div className="text-sm text-muted-foreground">数据总量</div>
                  <div className="text-2xl font-bold text-orange-700">
                    {trendStats.totalCount}
                  </div>
                  <div className="text-xs text-muted-foreground">条价格数据</div>
                </div>
              </div>
              
              {/* Trend Legend */}
              <div className="mt-4 p-3 bg-orange-100/50 rounded-lg text-sm text-orange-700">
                <p className="font-medium mb-1">趋势判断规则：</p>
                <p>• 价格上涨 ↑：相比上期价格上涨超过 5%</p>
                <p>• 价格下跌 ↓：相比上期价格下跌超过 5%</p>
                <p>• 价格持平 →：价格变化在 ±5% 范围内</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* District Selection and Preview */}
        {(previewData || currentData) && (previewData || currentData)!.districts.length > 0 && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between flex-wrap gap-4">
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="w-5 h-5" />
                  各区菜市场数据预览
                </CardTitle>
                <Select value={selectedDistrict} onValueChange={setSelectedDistrict}>
                  <SelectTrigger className="w-[220px]">
                    <SelectValue placeholder="选择区县" />
                  </SelectTrigger>
                  <SelectContent>
                    {(previewData || currentData)!.districts.map((d) => (
                      <SelectItem key={d.district} value={d.district}>
                        {d.district} ({d.markets.length}个市场)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              {currentDistrictData ? (
                <>
                  <div className="mb-4 flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <MapPin className="w-4 h-4" />
                      {currentDistrictData.district}
                    </span>
                    <span>菜市场: {currentDistrictData.markets.length} 个</span>
                    <span>价格数据: {currentDistrictData.markets.reduce((sum, m) => sum + m.priceCount, 0)} 条</span>
                    {currentDistrictData.district.includes('浦东') && (
                      <Badge className="bg-orange-100 text-orange-700 hover:bg-orange-100">小程序展示</Badge>
                    )}
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>序号</TableHead>
                        <TableHead>菜市场名称</TableHead>
                        <TableHead className="text-center">价格条数</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {currentDistrictData.markets.map((market, index) => (
                        <TableRow key={market.market}>
                          <TableCell>{index + 1}</TableCell>
                          <TableCell className="font-medium">{market.market}</TableCell>
                          <TableCell className="text-center">
                            <span className="inline-flex items-center px-2 py-1 rounded-full bg-orange-100 text-orange-700 text-sm">
                              {market.priceCount} 条
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  请选择要查看的区县
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Instructions */}
        <Card className="bg-blue-50 border-blue-200">
          <CardHeader>
            <CardTitle className="text-blue-800 text-base">使用说明</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-blue-700 space-y-2">
            <p>1. 从上海市发展和改革委员会网站下载最新的主副食品价格报表（XLS格式）</p>
            <p>2. 点击上传区域，选择下载的XLS文件</p>
            <p>3. 点击"预览数据"按钮，系统将自动提取所有区县所有品类价格数据</p>
            <p>4. 使用下拉菜单切换查看不同区县的菜市场数据</p>
            <p>5. <strong>小程序默认展示"浦东新区"数据</strong>，可在发布前选择其他区作为默认展示</p>
            <p>6. 预览确认数据正确后，点击"发布更新"按钮更新小程序数据</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
