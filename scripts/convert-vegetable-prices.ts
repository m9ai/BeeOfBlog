#!/usr/bin/env npx ts-node
/**
 * 今日菜价转换脚本
 * 将XLS价格表转换为JSON格式
 * 
 * 用法: npx ts-node scripts/convert-vegetable-prices.ts [xls文件路径]
 * 示例: npx ts-node scripts/convert-vegetable-prices.ts ../yangjing-bee-micro-app-wx/miniprogram/resources/20fc8894bcae2d5c0df08fa573d193f4.xls
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import xlsx from 'xlsx';

// 获取当前文件目录
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface VegetablePrice {
  name: string;
  category: string;
  unit: string;
  price: number;
  trend: 'up' | 'down' | 'stable';
}

interface MarketPrices {
  market: string;
  prices: VegetablePrice[];
}

interface PriceData {
  updateDate: string;
  district: string;
  markets: MarketPrices[];
}

function convertXlsToJson(xlsPath: string): PriceData | null {
  try {
    // 读取XLS文件
    const workbook = xlsx.readFile(xlsPath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data: any[][] = xlsx.utils.sheet_to_json(worksheet, { header: 1 });

    if (data.length < 10) {
      console.error('数据行数不足');
      return null;
    }

    // 提取日期
    const dateRow = data[2][0] as string;
    const updateDate = dateRow.replace('采价时间：', '');

    // 获取菜品信息（第4行：品种）
    const categories = data[3].slice(2) as string[];
    const items = data[4].slice(2) as string[];
    const units = data[6].slice(2) as string[];

    // 构建菜品列表
    const products: { index: number; category: string; name: string; unit: string }[] = [];
    for (let i = 0; i < items.length; i++) {
      if (items[i] && items[i] !== '-') {
        products.push({
          index: i + 2,
          category: categories[i] || '',
          name: items[i],
          unit: units[i] || '元/500g'
        });
      }
    }

    // 筛选蔬菜类
    const vegetables = products.filter(p => p.category === '蔬菜');

    // 提取浦东新区数据
    const pudongData: MarketPrices[] = [];
    for (let i = 8; i < data.length; i++) {
      const row = data[i];
      const district = row[0];
      if (district && district.includes('浦东')) {
        const marketName = row[1];
        if (marketName) {
          const prices: VegetablePrice[] = [];
          for (const veg of vegetables) {
            const priceValue = row[veg.index];
            if (priceValue && priceValue !== '-' && !isNaN(parseFloat(priceValue))) {
              prices.push({
                name: veg.name,
                category: veg.category,
                unit: veg.unit,
                price: parseFloat(priceValue),
                trend: 'stable' // 首次数据，暂无对比
              });
            }
          }
          if (prices.length > 0) {
            pudongData.push({
              market: marketName,
              prices
            });
          }
        }
      }
    }

    return {
      updateDate,
      district: '浦东新区',
      markets: pudongData
    };
  } catch (error) {
    console.error('转换失败:', error);
    return null;
  }
}

// 主函数
function main() {
  const args = process.argv.slice(2);
  const xlsPath = args[0] || './20fc8894bcae2d5c0df08fa573d193f4.xls';

  console.log(`正在转换: ${xlsPath}`);

  const result = convertXlsToJson(xlsPath);
  if (result) {
    // 输出路径
    const outputPath = path.join(__dirname, '../public/feeds/vegetable_prices.json');
    
    // 确保目录存在
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // 写入JSON文件
    fs.writeFileSync(outputPath, JSON.stringify(result, null, 2), 'utf-8');
    console.log(`转换成功: ${outputPath}`);
    console.log(`采价日期: ${result.updateDate}`);
    console.log(`菜市场数: ${result.markets.length}`);
    console.log(`菜品数: ${result.markets.reduce((sum, m) => sum + m.prices.length, 0)}`);
  } else {
    console.error('转换失败');
    process.exit(1);
  }
}

main();
