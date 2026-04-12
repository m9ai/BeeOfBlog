#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""今日菜价转换脚本 - 将XLS价格表转换为JSON

用法:
    python convert_vegetable_prices.py [xls文件路径] [输出JSON路径]
    
示例:
    python convert_vegetable_prices.py ../yangjing-bee-micro-app-wx/miniprogram/resources/20fc8894bcae2d5c0df08fa573d193f4.xls
    python convert_vegetable_prices.py  ./data/vege_prices.xls  ./public/feeds/vegetable_prices.json
"""

import pandas as pd
import json
import os
import sys

def convert_xls_to_json(xls_path, output_path='./public/feeds/vegetable_prices.json'):
    """将XLS转换为JSON"""
    print(f'读取文件: {xls_path}')
    df = pd.read_excel(xls_path, header=None)
    
    # 提取日期
    date_str = df.iloc[2, 0].replace('采价时间：', '')
    
    # 获取品类信息
    categories = df.iloc[3, 2:].tolist()
    items = df.iloc[4, 2:].tolist()
    units = df.iloc[6, 2:].tolist()
    
    # 构建菜品列表
    products = []
    for i in range(len(items)):
        item = items[i]
        if pd.notna(item) and str(item) != '-':
            # 清理单位字段
            unit = units[i] if pd.notna(units[i]) else '元/500g'
            unit = unit.replace('元/', '')
            products.append({
                'index': i + 2,
                'category': categories[i] if pd.notna(categories[i]) else '',
                'name': item,
                'unit': unit
            })
    
    # 提取浦东新区数据（保留所有品类：粮食、食用油、肉禽蛋、鱼虾、蔬菜、水果等）
    markets = []
    for i in range(8, len(df)):
        row = df.iloc[i]
        district = row.iloc[0]
        if pd.notna(district) and '浦东' in str(district):
            market_name = row.iloc[1]
            if pd.notna(market_name):
                prices = []
                for product in products:
                    price_value = row.iloc[product['index']]
                    if pd.notna(price_value) and str(price_value) != '-' and str(price_value) != 'nan':
                        try:
                            prices.append({
                                'name': product['name'],
                                'category': product['category'],
                                'unit': product['unit'],
                                'price': float(price_value),
                                'trend': 'stable'
                            })
                        except:
                            pass
                if prices:
                    markets.append({
                        'market': market_name,
                        'prices': prices
                    })
    
    result = {
        'updateDate': date_str,
        'district': '浦东新区',
        'markets': markets
    }
    
    # 确保目录存在
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(result, f, ensure_ascii=False, indent=2)
    
    print(f'转换成功: {output_path}')
    print(f'采价日期: {result["updateDate"]}')
    print(f'浦东新区菜市场数: {len(result["markets"])}')
    total_prices = sum(len(m['prices']) for m in result['markets'])
    print(f'价格数: {total_prices}')
    
    return result

if __name__ == '__main__':
    # 默认路径
    xls_path = os.path.join(os.path.dirname(__file__), '../yangjing-bee-micro-app-wx/miniprogram/resources/20fc8894bcae2d5c0df08fa573d193f4.xls')
    output_path = os.path.join(os.path.dirname(__file__), '../public/feeds/vegetable_prices.json')
    
    # 命令行参数覆盖
    if len(sys.argv) > 1:
        xls_path = sys.argv[1]
    if len(sys.argv) > 2:
        output_path = sys.argv[2]
    
    # 转换为绝对路径
    xls_path = os.path.abspath(xls_path)
    output_path = os.path.abspath(output_path)
    
    convert_xls_to_json(xls_path, output_path)
