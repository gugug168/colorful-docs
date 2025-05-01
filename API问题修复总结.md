# API路径问题修复总结

## 问题描述

网站在Vercel部署环境下遇到以下API相关问题：

1. **双重任务创建**：美化文档时会在Supabase中产生两个任务
   - 其中一个任务能成功完成并返回结果
   - 另一个任务保持空状态
   - 网站一直查询空的任务，导致用户永远看不到处理结果

2. **API路径404错误**：前端请求API时出现404错误
   - `GET /api/check-task/{taskId}` 返回404
   - `POST /api/update-task/{taskId}` 返回404

3. **路由混淆错误**：Vercel日志显示路由混淆
   - 错误: `/api/beautify-task.js@beautify-task.js`

4. **Vercel配置问题**：
   - 最初尝试同时使用`builds`和`functions`配置，这在Vercel中是不允许的
   - 随后尝试将app.js作为函数处理，但Vercel要求所有函数必须在api目录中
   - 需要调整配置，使其符合Vercel的文件系统路由规则

## 问题原因分析

1. **重复路由定义**：
   - app.js中定义了两次相同的`/beautify-task`路由
   - 导致同一请求创建两个不同的任务

2. **不一致的API调用**：
   - 前端同时使用`/beautify`和`/api/beautify-task`两种不同的路径
   - 这两个不同的路径都能创建任务，导致双重创建

3. **Vercel路由不兼容**：
   - API路由在本地开发环境下正常工作
   - 在Vercel部署环境中路由规则不同，导致404错误
   - Vercel使用基于文件系统的路由，而我们的api/index.js使用自定义路由分发

4. **Serverless架构问题**：
   - Vercel需要API端点放在api目录下且使用特定的文件命名规则
   - 每个URL参数需要使用`[param].js`格式创建文件

## 修复方案

1. **解决重复路由**：
   - 删除app.js中重复的`/beautify-task`路由定义
   - 通过脚本`fix-app.js`自动处理重复路由问题

2. **统一API调用**：
   - 修改前端代码，统一使用`/api/beautify-task`路径
   - 在public/js/task-processor.js中添加动态API基础路径判断

3. **Vercel兼容路由**：
   - 创建适用于Vercel文件系统路由的API处理程序
   - 新增`api/check-task/[taskId].js`文件处理检查任务请求
   - 新增`api/update-task/[taskId].js`文件处理更新任务请求
   - 修改`api/processTasks.js`以适应Vercel环境

4. **Vercel配置调整**：
   - 使用`functions`配置处理API请求
   - 只为api目录下的文件配置函数属性
   - 通过routes配置将URL模式映射到正确的处理函数

## 技术实现

1. **动态API路径检测**：
```javascript
// 确定API基础URL（支持本地开发和Vercel部署环境）
const apiBase = window.location.hostname === 'localhost' ? '' : '/api';

// 发送请求时使用动态基础路径
fetch(`${apiBase}/check-task/${taskId}`)
```

2. **Vercel文件系统路由**：
```javascript
// api/check-task/[taskId].js
module.exports = async (req, res) => {
  // 获取动态参数
  const { taskId } = req.query;
  // ... 处理逻辑
}
```

3. **优化的vercel.json配置**：
```json
{
  "functions": {
    "api/check-task/[taskId].js": {
      "includeFiles": "utils/**"
    },
    "api/update-task/[taskId].js": {
      "includeFiles": "utils/**"
    },
    "api/processTasks.js": {
      "includeFiles": "utils/**"
    },
    "api/beautify-task.js": {
      "includeFiles": "utils/**"
    }
  },
  "routes": [
    { "src": "/api/check-task/(.*)", "dest": "/api/check-task/[taskId].js?taskId=$1" },
    { "src": "/api/update-task/(.*)", "dest": "/api/update-task/[taskId].js?taskId=$1" },
    { "src": "/api/cancelTask/(.*)", "dest": "/api/cancelTask.js?taskId=$1" }
  ]
}
```

## 总结

这次修复解决了几个主要问题：

1. 通过删除重复路由和统一API调用路径，解决了双重任务创建问题
2. 通过创建Vercel兼容的API路由文件和配置，解决了404错误问题
3. 将Vercel配置调整为仅使用`functions`，确保部署兼容性
4. 使用文件系统路由规则，创建正确的URL参数处理文件

修复后，美化文档功能将只创建一个任务，并能正确跟踪和显示任务状态和结果。修复同时兼容本地开发环境和Vercel部署环境。 