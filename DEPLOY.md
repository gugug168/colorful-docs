# 文档排版与美化系统部署指南

本指南将帮助您将文档排版与美化系统部署到 GitHub 和 Vercel，并集成 Supabase 服务。

## 准备工作

1. 创建 GitHub 账号（如果没有）
2. 创建 Vercel 账号（如果没有）- https://vercel.com/signup
3. 创建 Supabase 账号（如果没有）- https://supabase.com/

## 创建 Supabase 项目

1. 登录 Supabase 控制台
2. 创建新项目
3. 记录下项目 URL 和 anon public key (在项目设置 > API 中找到)
4. 在 Storage 部分创建三个存储桶：
   - `uploads` - 用于存储上传的原始文件
   - `temp` - 用于存储临时转换文件
   - `downloads` - 用于存储处理后的文件

为每个存储桶设置以下权限策略：

```sql
-- 允许已认证用户上传文件
CREATE POLICY "允许已认证用户上传文件"
ON storage.objects
FOR INSERT
TO authenticated
USING (true);

-- 允许所有人下载文件
CREATE POLICY "允许所有人下载文件"
ON storage.objects
FOR SELECT
TO public
USING (true);

-- 允许已认证用户删除自己上传的文件
CREATE POLICY "允许已认证用户删除自己的文件"
ON storage.objects
FOR DELETE
TO authenticated
USING (auth.uid() = owner);
```

## 部署到 GitHub

1. 在本地初始化 Git 仓库（如果尚未初始化）：

```bash
git init
git add .
git commit -m "初始提交"
```

2. 在 GitHub 创建新仓库

3. 添加远程仓库并推送：

```bash
git remote add origin https://github.com/您的用户名/colorful-docs.git
git branch -M main
git push -u origin main
```

## 部署到 Vercel

1. 登录 Vercel 并导入项目：
   - 连接到您的 GitHub 仓库
   - 选择要部署的仓库（colorful-docs）

2. 配置项目：
   - 构建命令：`npm run build`
   - 输出目录：（保持默认）
   - 安装命令：`npm install`

3. 添加环境变量：
   - `SUPABASE_URL` - 您的 Supabase 项目 URL
   - `SUPABASE_KEY` - 您的 Supabase anon key
   - `DEEPSEEK_API_KEY` - 您的 DeepSeek API 密钥（如适用）

4. 部署项目

## 验证部署

1. 访问 Vercel 提供的 URL 检查应用是否正常运行
2. 测试文件上传和处理功能
3. 检查 Supabase Storage 是否正确存储文件

## 故障排查

1. 检查 Vercel 构建日志，查找任何错误
2. 确保所有环境变量都已正确设置
3. 确认 Supabase 存储桶权限设置正确
4. 检查网络请求以识别可能的 API 调用错误

## 更新应用

要更新应用，只需将更改推送到 GitHub 仓库：

```bash
git add .
git commit -m "更新描述"
git push
```

Vercel 将自动检测更改并重新部署您的应用。

## 注意事项

- Vercel 的免费计划对于 Serverless 函数执行时间有限制（10秒），如果文档处理需要更长时间，可能需要升级计划
- Supabase 免费计划提供 1GB 存储空间和有限的带宽，对于大型文档处理可能需要升级
- 确保敏感信息（如 API 密钥）始终保存在环境变量中，不要硬编码在代码库中 