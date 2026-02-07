# Giscus 评论系统配置指南

## 配置步骤

### 1. 安装 Giscus 应用
访问 https://github.com/apps/giscus 并安装到 `m9ai/BeeOfBlog` 仓库

### 2. 启用 Discussions
1. 进入仓库 https://github.com/m9ai/BeeOfBlog
2. 点击 Settings → Features
3. 勾选 "Discussions"

### 3. 创建评论分类
1. 进入仓库的 Discussions 页面
2. 点击 "New category"
3. 创建分类名称如："Comments" 或 "评论"
4. 记住分类名称

### 4. 获取配置信息
访问 https://giscus.app/ 并填写：
- **Repository**: `m9ai/BeeOfBlog`
- **Discussion Category**: 选择您创建的分类
- **Page ↔️ Discussions Mapping**: `Specific discussion title`
- **Discussion Title**: 留空或填写特定格式

页面会生成配置代码，提取以下信息：
- `data-repo-id` (仓库ID)
- `data-category-id` (分类ID)

### 5. 更新代码配置
将获取到的信息填入 `src/components/comments/GiscusComments.tsx`：

```typescript
const GISCUS_CONFIG = {
  repo: 'm9ai/BeeOfBlog',
  repoId: 'R_kgD-xxxxxxxx', // 替换为实际的仓库ID
  category: 'Comments', // 替换为实际分类名称
  categoryId: 'DIC_kwD-xxxxxxxx', // 替换为实际分类ID
}
```

## 配置完成后

提交更改并推送：
```bash
git add .
git commit -m "feat: 配置 Giscus 评论系统"
git push
```

## 验证

访问任意文章或视频详情页，评论区域应显示 Giscus 评论框。
