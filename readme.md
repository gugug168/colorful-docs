# 文档排版与美化系统

#该项目代码会上传到github托管，然后使用vercel进行部署，然后空间存储使用supabase，同时为了减少vercel的代码运行时间，采用异步执行AI美化，查询supabase的数据库

#重点和重复出现的问题
1、我是使用vercel的环境变量
2、在vercel.json中The `functions` property cannot be used in conjunction with the `builds` property. Please remove one of them.'functions' 属性不能与 'builds' 属性一起使用。请删除其中一个。
3、我要用免费的VERCEL计划，Serverless函数不要超过12个。

## Vercel免费计划Serverless函数限制解决方案

Vercel的Hobby（免费）计划限制部署不能超过12个Serverless函数。为了解决这个问题，我们采用了API分组策略，将功能相似的API合并到单个Serverless函数中：

### API分组策略

我们将所有API按功能分为三大类：

1. **document-api.js** - 处理文档相关操作
   - 文档上传与转换
   - 文档美化与处理
   - 文档模板管理
   - 图像处理相关功能

2. **task-api.js** - 处理任务相关操作
   - 任务创建与查询
   - 任务状态更新
   - 任务队列处理
   - 任务取消功能

3. **resource-api.js** - 处理资源访问相关操作
   - 文件下载功能
   - 文件导出功能（HTML转DOCX/PDF）
   - 文档预览
   - 图片代理功能

每个API文件内部通过`req.query.action`参数区分具体操作，例如：
```
/api/task-api?action=check&taskId=123   // 检查任务状态
/api/task-api?action=cancel&taskId=123  // 取消任务
/api/document-api?action=upload         // 上传文档
/api/resource-api?action=download&path=file.docx  // 下载文件
```

### 优势

- 符合Vercel Hobby计划12个函数的限制
- 保持所有原始功能完整
- 前端代码无需大量修改，只需更改API路径
- 代码组织更加清晰，便于维护
- 相关功能集中在同一文件，降低了代码重复

### 实现方式

在`vercel.json`中，我们通过如下配置将所有API请求映射到三个主要函数：

```json
{
  "version": 2,
  "functions": {
    "api/document-api.js": {
      "includeFiles": "utils/**"
    },
    "api/task-api.js": {
      "includeFiles": "utils/**"
    },
    "api/resource-api.js": {
      "includeFiles": "utils/**"
    }
  },
  "routes": [
    { "src": "/upload", "dest": "/api/document-api.js?action=upload" },
    { "src": "/api/beautify-task", "dest": "/api/document-api.js?action=beautify" },
    { "src": "/api/templates", "dest": "/api/document-api.js?action=templates" },
    { "src": "/api/image/colorize", "dest": "/api/document-api.js?action=colorize" },
    { "src": "/api/image/recolorize", "dest": "/api/document-api.js?action=recolorize" },
    { "src": "/api/document/apply-colorized-images", "dest": "/api/document-api.js?action=apply-colorized-images" },
    { "src": "/api/document/images", "dest": "/api/document-api.js?action=get-images" },
    { "src": "/api/config", "dest": "/api/document-api.js?action=config" },
    { "src": "/api/check-task/(.*)", "dest": "/api/task-api.js?action=check&taskId=$1" },
    { "src": "/api/update-task/(.*)", "dest": "/api/task-api.js?action=update&taskId=$1" },
    { "src": "/api/processTasks", "dest": "/api/task-api.js?action=process" },
    { "src": "/api/cancelTask/(.*)", "dest": "/api/task-api.js?action=cancel&taskId=$1" },
    { "src": "/api/task-status", "dest": "/api/task-api.js?action=status" },
    { "src": "/download", "dest": "/api/resource-api.js?action=download" },
    { "src": "/export", "dest": "/api/resource-api.js?action=export" },
    { "src": "/preview/(.*)", "dest": "/api/resource-api.js?action=preview&file=$1" },
    { "src": "/view-document/(.*)", "dest": "/api/resource-api.js?action=view&file=$1" },
    { "src": "/api/proxy-image", "dest": "/api/resource-api.js?action=proxy-image" }
  ]
}
```

这种方法确保我们能够在Vercel免费计划的限制范围内运行所有必要的服务器功能。函数配置中的`includeFiles`参数确保了utils目录下的所有工具函数可以被API函数访问。

## 项目概述
本项目旨在开发一个文档排版与美化系统，能够将用户上传的文档转换为HTML格式，利用AI技术对其进行智能排版和重点知识突出显示，并支持将美化后的文档导出为原格式。系统不会影响原文档中的图片展示，同时能够对重点字句进行字体变色、加粗等处理。

项目采用Vercel进行部署，Supabase用于空间存储和数据库，并使用异步任务处理AI美化请求，以减少Vercel的代码运行时间。

## 核心功能
### 文档转HTML转换
- 支持常见文档格式（Word、PDF等）转HTML
- 保留原文档结构和内容完整性
- 文档中的图片提取并临时存储
- 保持图片在文档中的原有位置

### AI智能排版美化
- 自动识别文档结构和层次
- 重点知识自动标记和突出显示
- 关键字句智能加粗、变色处理
- 整体样式优化与美化

### 结果展示与预览
- 实时展示美化后的HTML效果
- 支持在线调整和微调

### 导出与下载
- 支持将美化后的HTML导出为原格式文档
- 保留美化效果和样式

## HTML到WORD转换格式限制

在WORD优化色彩转为WORD的流程中，为了确保AI优化后的HTML能成功的转回WORD，而不缺失格式，请仅使用以下HTML/CSS修改文本样式，其他标签和样式将被忽略：

颜色（可选不同颜色）：`<span style="color:#FF0000">`

高亮（可选不同颜色）：`<span style="background-color:yellow">`

加粗：`<b>` 或 `<strong>`

下划线：`<u>`

斜体：`<i>`

禁止使用class、id、div布局或复杂CSS。

## 图片处理机制

请注意，不要在DOCX转化成HTML的时候，将图片转换成BASE64，而是单独将图片保存，然后在HTML中插入图片链接。同时展示文档的时候要出现文档。在传输给AI的时候，也不要传输图片及连接，只是告诉AI这里要留一个图片的位置不要动，不要改变图片位置。等后期AI返回数据后，再将图片插入。

### 图片存储目录
图片将保存在 `temp/images` 目录下，通过相对路径在HTML中引用，确保图片能够正常显示。转换过程中会为每个图片生成唯一文件名，防止冲突。

### AI处理时的图片处理
在发送内容给AI进行美化处理时：
1. 所有图片标签会被替换为占位符
2. 图片信息会临时保存在内存中
3. 在AI处理完成后，将图片引用恢复到生成的HTML中

## 技术栈

### 前端技术
- **HTML/CSS/JavaScript**：基础网页开发
- **Bootstrap 5**：响应式UI组件
- **jQuery**：简化DOM操作

### 后端技术
- **Node.js + Express**：主要后端环境
- **Serverless部署**：使用Vercel部署

### 存储解决方案
- **Supabase**：用于文件存储和数据库
  - 文件存储：处理上传的文件和结果存储
  - 数据库：存储任务状态和配置信息

### 文档处理
- **mammoth.js**：处理Word文档转HTML
- **pdf-parse**：处理PDF文档转HTML
- **multer**：处理文件上传
- **html-to-docx**：HTML转回Word格式
- **html-pdf-node**：HTML转PDF

### AI集成与处理
- **AI提供商**：支持DeepSeek和百度文心大模型
  - 模块化设计，支持扩展其他AI服务
- **异步任务处理**：减少Vercel函数执行时间
- **备用优化模式**：当AI服务不可用时的本地处理方案

### 错误处理与日志
- **统一错误处理机制**：分类处理各种错误类型
- **详细日志记录**：记录系统运行状态和错误信息

## 项目结构
```
colorful-docs/
  ├── public/           // 静态资源
  │   ├── css/          // 样式文件
  │   ├── js/           // 客户端JavaScript
  │   └── images/       // 图片资源
  ├── uploads/          // 上传文件存储
  │   ├── temp/         // 临时存储
  │   └── results/      // 处理结果存储
  ├── downloads/        // 导出文件存储
  ├── logs/             // 日志文件目录
  ├── app.js            // 主应用入口
  ├── vercel.json       // Vercel配置文件
  ├── api/              // Serverless API函数
  │   ├── document-api.js  // 文档处理API（上传、美化、模板）
  │   ├── task-api.js      // 任务管理API（创建、检查、取消）
  │   └── resource-api.js  // 资源访问API（下载、导出、预览）
  ├── routes/           // 路由处理
  │   ├── upload.js     // 上传路由
  │   ├── process.js    // 处理路由
  │   └── download.js   // 下载路由
  └── utils/            // 工具函数
      ├── supabaseClient.js    // Supabase客户端配置
      ├── taskProcessor.js     // 任务处理器
      ├── fileManager.js       // 文件管理工具
      ├── errorHandler.js      // 错误处理工具
      ├── validatorUtils.js    // 表单验证工具
      ├── aiOptimizer.js       // AI优化处理
      ├── htmlUtils.js         // HTML处理工具
      ├── exportUtils.js       // 导出工具函数
      └── imageColorizer.js    // 图片处理工具
```

## 核心模块详解

### 1. Supabase客户端配置 (utils/supabaseClient.js)
- 管理与Supabase的连接
- 处理文件上传、下载、列表和删除
- 管理异步任务队列

```javascript
// 主要功能
uploadFile()      // 上传文件到Supabase Storage
getFile()         // 从Supabase Storage获取文件
createTask()      // 创建异步处理任务
updateTaskStatus() // 更新任务状态
getTask()         // 获取任务信息
```

### 2. 任务处理器 (utils/taskProcessor.js)
- 异步任务处理的核心模块
- 支持不同类型的处理任务（美化、优化等）
- 处理超时和错误情况

```javascript
// 主要功能
processTask()          // 任务处理的入口函数
processBeautifyTask()  // 处理美化任务
processAiOptimizationTask() // 处理AI优化任务
setApiConfig()         // 设置全局API配置
```

### 3. 文件管理工具 (utils/fileManager.js)
- 处理文件上传、保存和清理
- 管理临时文件和结果文件
- 定期清理过期文件

```javascript
// 主要功能
upload                // multer配置，处理文件上传
getFileInfo()         // 获取文件信息
saveResultToFile()    // 保存结果到文件
moveFileToResults()   // 移动文件到结果目录
cleanupExpiredFiles() // 清理过期文件
```

### 4. 错误处理工具 (utils/errorHandler.js)
- 提供统一的错误处理机制
- 支持多种错误类型（验证、文件、数据库等）
- 错误日志记录

```javascript
// 主要功能
createError()         // 创建通用错误对象
logErrorToFile()      // 记录错误到日志文件
handleApiError()      // 处理API错误并返回适当响应
errorMiddleware()     // Express错误中间件
```

### 5. 表单验证工具 (utils/validatorUtils.js)
- 验证各种表单字段
- 提供丰富的验证规则
- 生成结构化错误信息

```javascript
// 主要功能
validateRequired()    // 验证必填字段
validateLength()      // 验证字符串长度
validateEmail()       // 验证电子邮件格式
validateUrl()         // 验证URL格式
validateNumber()      // 验证数字
validateDate()        // 验证日期
validateObject()      // 验证对象
validateArray()       // 验证数组
```

### 6. AI优化处理 (utils/aiOptimizer.js)
- 调用不同AI服务处理内容
- 生成优化提示
- 处理AI返回结果

```javascript
// 主要功能
processWithDeepseek() // 使用DeepSeek处理HTML
beautifyWithBaidu()   // 使用百度文心处理HTML
beautifyWithRules()   // 本地规则处理（备用模式）
generateOptimizationPrompt() // 生成优化提示
```

## 实现流程

### 文档上传与处理流程
1. 用户上传文档到前端
2. 文档通过API上传到服务器
3. 文件被临时存储并验证
4. 创建异步处理任务并存储在Supabase
5. 返回任务ID给前端，前端使用它查询处理状态
6. 异步任务处理器处理文档:
   - 转换为HTML
   - 提取图片
   - 调用AI服务进行优化
   - 处理完成后更新任务状态
7. 前端轮询查询任务状态
8. 处理完成后，用户可以预览和下载结果

### AI处理流程
1. 准备HTML内容和优化提示
2. 根据配置选择AI服务提供商（DeepSeek、百度等）
3. 调用相应的AI API处理内容
4. 如果AI处理失败，使用本地备用优化规则
5. 处理返回的优化内容
6. 替换或恢复图片引用
7. 存储结果并更新任务状态

## 部署指南

### Vercel部署
1. Fork或Clone项目仓库
2. 在Vercel上创建新项目并连接仓库
3. 设置以下环境变量:
   - `NEXT_PUBLIC_SUPABASE_URL`: Supabase项目URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Supabase匿名密钥
   - `SUPABASE_SERVICE_KEY`: Supabase服务密钥（可选）
   - `DEEPSEEK_API_KEY`: DeepSeek API密钥（可选）
   - `BAIDU_API_KEY`: 百度文心API密钥（可选）
   - `BAIDU_API_SECRET`: 百度文心API密钥（可选）
4. 部署项目

### Supabase设置
1. 创建Supabase项目
2. 创建以下存储桶:
   - `uploads`: 存储上传的文件
   - `results`: 存储处理结果
3. 设置适当的存储桶权限
4. 创建`tasks`表用于存储任务信息:
   ```sql
   create table tasks (
     id uuid primary key,
     status text,
     created_at timestamp with time zone,
     updated_at timestamp with time zone,
     data jsonb,
     result jsonb,
     error text,
     expires_at timestamp with time zone
   );
   ```

## 关键依赖项
请确保在package.json中包含以下依赖:

```json
{
  "dependencies": {
    "@supabase/supabase-js": "^2.0.0",
    "axios": "^0.27.2",
    "busboy": "^1.6.0",
    "express": "^4.18.2",
    "html-pdf-node": "^1.0.8",
    "html-to-docx": "^1.6.5",
    "mammoth": "^1.5.1",
    "multer": "^1.4.5-lts.1",
    "pdf-parse": "^1.1.1",
    "puppeteer": "^19.7.0",
    "uuid": "^9.0.0"
  }
}
```

## 常见问题与解决方案

### 1. Vercel部署超时问题
**问题**: Vercel函数执行超过10秒会终止  
**解决方案**: 使用异步任务处理机制，将长时间运行的任务存储在Supabase，然后使用单独的处理器处理

### 2. Vercel Serverless函数数量限制
**问题**: Vercel Hobby计划限制最多12个Serverless函数  
**解决方案**: 采用API分组策略，将功能相似的API合并到单个Serverless函数中，使用query参数区分不同操作。具体实现见"Vercel免费计划Serverless函数限制解决方案"部分。

### 3. 文件大小限制
**问题**: Vercel和Supabase对文件大小有限制  
**解决方案**: 
- 在前端添加文件大小验证
- 实现文件分块上传(大文件)
- 优化图片和内容以减小文件大小

### 4. AI服务不可用
**问题**: AI服务可能暂时不可用  
**解决方案**: 实现本地备用处理逻辑(`beautifyWithRules`函数)

### 5. 处理任务失败
**问题**: 任务可能因各种原因失败  
**解决方案**:
- 实现详细的错误记录
- 自动重试机制
- 用户友好的错误提示

## 后续优化方向
1. 添加用户认证系统
2. 实现更多文档格式的支持
3. 优化AI处理提示，提高优化质量
4. 增加批量处理功能
5. 添加自定义主题和模板选择

## 注意事项
1. 密钥和敏感信息应保存在环境变量中
2. 定期清理临时文件和过期任务
3. 监控API使用情况和费用
4. 注意AI服务提供商的使用限制和费率
