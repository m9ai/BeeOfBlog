# 洋泾小蜜蜂小程序数据接口文档

本文档描述了洋泾小蜜蜂小程序所需的所有 JSON 数据接口。

## 接口列表

### 1. 为老服务

| 接口 | 路径 | 说明 |
|------|------|------|
| 养老资源 | `/feeds/elderly_resources.json` | 养老服务机构列表 |
| 活动中心 | `/feeds/elderly_activities.json` | 老年活动列表 |
| 适老化改造 | `/feeds/agefriendly_projects.json` | 适老化改造项目 |

### 2. 萌宠服务

| 接口 | 路径 | 说明 |
|------|------|------|
| 免疫点 | `/feeds/pet_vaccine.json` | 宠物疫苗接种点 |
| 禁养犬目录 | `/feeds/pet_banned.json` | 禁养犬种列表 |
| 犬伤门诊 | `/feeds/rabies_clinics.json` | 狂犬疫苗接种门诊 |

### 3. 民生速递

| 接口 | 路径 | 说明 |
|------|------|------|
| 政策列表 | `/feeds/livelihood.json` | 政策文档列表 |
| 政策详情 | `/feeds/livelihood_detail_{id}.json` | 政策详情 |

### 4. 洋泾知识库

| 接口 | 路径 | 说明 |
|------|------|------|
| 分类列表 | `/feeds/knowledge_categories.json` | 知识分类 |
| 热门文档 | `/feeds/knowledge_hot.json` | 热门知识文档 |
| 全部文档 | `/feeds/knowledge_all.json` | 全部文档列表 |
| 分类文档 | `/feeds/knowledge_list_{category}.json` | 分类下文档 |
| 文档详情 | `/feeds/knowledge_{id}.json` | 文档详情 |

## 数据结构

### 养老资源 (elderly_resources.json)

```json
[
  {
    "id": "1",
    "name": "机构名称",
    "type": "机构类型",
    "address": "地址",
    "phone": "电话",
    "beds": "床位信息",
    "features": ["服务特色"]
  }
]
```

### 知识文档详情 (knowledge_{id}.json)

```json
{
  "id": "1",
  "title": "文档标题",
  "category": "分类ID",
  "categoryName": "分类名称",
  "author": "作者",
  "updateTime": "2025-03-01",
  "readCount": 1234,
  "content": "Markdown内容",
  "relatedDocs": [
    { "id": "2", "title": "相关文档" }
  ]
}
```

## 访问方式

所有接口通过 HTTP GET 请求访问，建议添加时间戳避免缓存：

```
https://yangjing.m9ai.work/feeds/{filename}.json?t={timestamp}
```

## 更新说明

- 2025-03-01: 初始化所有数据接口
