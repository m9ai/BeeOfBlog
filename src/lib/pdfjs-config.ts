import * as pdfjs from 'pdfjs-dist'

// 设置 worker 路径为本地文件
if (typeof window === 'undefined') {
  // 服务端：使用本地 worker 文件
  const path = require('path')
  pdfjs.GlobalWorkerOptions.workerSrc = path.join(
    process.cwd(),
    'node_modules/pdfjs-dist/build/pdf.worker.mjs'
  )
} else {
  // 客户端
  pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.mjs'
}

export default pdfjs
