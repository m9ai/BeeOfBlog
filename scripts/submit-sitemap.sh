#!/bin/bash

# 搜索引擎提交脚本
# 用于向各大搜索引擎提交sitemap

BASE_URL="https://yangjing.m9ai.work"
SITEMAP_URL="${BASE_URL}/sitemap.xml"

echo "正在向搜索引擎提交站点地图..."

# Google Search Console
echo "提交到 Google..."
curl -s "https://www.google.com/ping?sitemap=${SITEMAP_URL}" > /dev/null
if [ $? -eq 0 ]; then
    echo "✓ Google 提交成功"
else
    echo "✗ Google 提交失败"
fi

# Bing Webmaster Tools
echo "提交到 Bing..."
curl -s "https://www.bing.com/ping?sitemap=${SITEMAP_URL}" > /dev/null
if [ $? -eq 0 ]; then
    echo "✓ Bing 提交成功"
else
    echo "✗ Bing 提交失败"
fi

echo "提交完成！"
echo "建议同时在以下平台手动提交："
echo "- 百度站长平台: https://ziyuan.baidu.com/"
echo "- 360站长平台: https://zhanzhang.so.com/"
echo "- 头条搜索站长平台: https://zhanzhang.toutiao.com/"