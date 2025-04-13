# 文档排版与美化系统

#该项目代码会上传到github托管，然后使用vercel进行部署，然后空间存储使用supabase，同时为了减少vercel的代码运行时间，采用异步执行AI美化，查询supabase的数据库



## 项目概述
本项目旨在开发一个文档排版与美化系统，能够将用户上传的文档转换为HTML格式，利用AI技术对其进行智能排版和重点知识突出显示，并支持将美化后的文档导出为原格式。系统不会影响原文档中的图片展示，同时能够对重点字句进行字体变色、加粗等处理。

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

## 技术栈选择（新手友好版）

### 前端技术
- **HTML/CSS/JavaScript**：基础网页开发，无需复杂框架
- **Bootstrap 5**：现成的响应式UI组件，快速构建漂亮界面
- **jQuery**：简化DOM操作，降低JavaScript使用难度

### 后端技术
- **Node.js + Express**：简单易学的JavaScript后端环境
- **nodemon**：自动重启服务器，方便开发

### 文档处理
- **mammoth.js**：处理Word文档转HTML
- **pdf.js**：处理PDF文档转HTML
- **multer**：处理文件上传

### AI集成
- **OpenAI API (GPT-4)**：使用简单的API调用实现内容分析和优化
- **预设提示词模板**：简化AI调用复杂度

### 存储
- **本地文件系统**：简单直接，无需数据库配置

### 导出功能
- **html-docx-js**：HTML转回Word格式
- **jsPDF**：生成PDF文件

## 开发步骤详解

### 1. 环境搭建
1. 安装Node.js（从官网下载Windows安装包）
2. 创建项目文件夹并初始化
   ```
   mkdir colorful-docs
   cd colorful-docs
   npm init -y
   ```
3. 安装必要依赖
   ```
   npm install express multer mammoth pdf.js-extract html-docx-js jspdf bootstrap jquery openai
   npm install nodemon --save-dev
   ```

### 2. 基础项目结构
```
colorful-docs/
  ├── public/           // 静态资源
  │   ├── css/          // 样式文件
  │   ├── js/           // 客户端JavaScript
  │   └── images/       // 图片资源
  ├── uploads/          // 上传文件临时存储
  ├── temp/             // 处理过程临时文件
  ├── downloads/        // 导出文件存储
  ├── views/            // HTML页面
  ├── app.js            // 主应用入口
  ├── routes/           // 路由处理
  └── utils/            // 工具函数
      ├── docxConverter.js  // Word转换器
      ├── pdfConverter.js   // PDF转换器
      └── aiProcessor.js    // AI处理
```

### 3. 功能实现简化方案

#### 文档转HTML流程
1. 用户通过网页表单上传文档
2. 使用mammoth.js直接转换Word文档为HTML
3. 使用pdf.js-extract提取PDF内容并转为HTML
4. 临时存储图片到public/images/temp目录

#### AI排版美化（简化版）
1. 分析HTML结构，通过简单规则识别标题、段落等
2. 使用OpenAI API分析内容并标记重要部分
3. 应用预定义的CSS样式突出显示重要内容
4. 使用简单的API调用替代复杂的NLP模型

#### 导出功能简化
1. HTML转Word：使用html-docx-js库
2. HTML转PDF：使用jsPDF库
3. 提供下载链接

## 部署指南（Windows系统）

### 本地开发环境
1. 安装Node.js (LTS版本)
2. 使用命令提示符或PowerShell运行项目
   ```
   npm run dev  // 使用nodemon自动重启服务器
   ```
3. 浏览器访问 http://localhost:3000

### 简易生产环境
1. 租用简单虚拟主机或使用Vercel/Netlify等平台
2. 按照平台说明部署Node.js应用

## 进阶优化建议
1. 先实现基础功能，再逐步增加复杂功能
2. 使用现成的颜色主题和样式模板
3. 开始时可用简单的规则替代AI分析，降低复杂度
4. 先支持Word文档，成功后再添加PDF支持

## 实现流程
### 上传阶段
1. 用户上传文档
2. 服务器接收并临时存储
3. 文件格式验证与安全检查

### 转换阶段
1. 根据文件类型选择相应转换工具
2. 将文档转换为HTML格式
3. 提取并处理文档中的图片
4. 生成初步HTML结构

### AI处理阶段
1. 分析文档内容和结构
2. 识别重点知识点和关键字句
3. 应用排版规则和样式
4. 生成优化后的HTML

### 展示阶段
1. 预览优化后的HTML效果
2. 提供简单的调整选项
3. 用户确认效果

### 导出阶段
1. 将优化后的HTML转换回原格式
2. 提供下载选项

## 注意事项
1. 本项目适合新手小白学习开发
2. 提供了详细的开发步骤说明
3. 使用Windows系统开发和部署
4. 如有问题，请参考各工具的官方文档
