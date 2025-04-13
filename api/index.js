// API入口点
const fs = require('fs');
const path = require('path');
const handleStaticRequest = require('./_static');

// 导入Express应用（如果可用）
let app;
try {
  app = require('../app');
} catch (error) {
  console.error('无法导入app.js:', error);
}

module.exports = async (req, res) => {
  // 启用CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // 处理OPTIONS请求
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  console.log(`处理请求: ${req.method} ${req.url}`);
  
  // 处理静态资源
  try {
    const isHandled = await handleStaticRequest(req, res);
    if (isHandled) {
      return;
    }
  } catch (err) {
    console.error('处理静态资源出错:', err);
  }
  
  // 处理特定的API路由
  if (req.url.startsWith('/api/')) {
    // 从URL中提取路径部分
    const urlParts = req.url.split('?');
    const urlPath = urlParts[0];
    
    // 将/api/xxx路径映射到特定的处理函数
    const handlerPath = urlPath.replace('/api/', './');
    
    try {
      const handlerModule = require(handlerPath);
      return handlerModule(req, res);
    } catch (error) {
      console.error(`无法加载API处理程序 ${handlerPath}:`, error);
      return res.status(404).json({ 
        error: '找不到该API端点',
        path: urlPath
      });
    }
  }
  
  // 处理根路径请求 - 返回主页
  if (req.url === '/' || req.url === '') {
    try {
      // 尝试提供主页
      const landingPath = path.join(process.cwd(), 'views', 'landing.html'); 
      const indexPath = path.join(process.cwd(), 'views', 'index.html');
      
      if (fs.existsSync(landingPath)) {
        const content = fs.readFileSync(landingPath, 'utf8');
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        return res.status(200).send(content);
      } 
      else if (fs.existsSync(indexPath)) {
        const content = fs.readFileSync(indexPath, 'utf8');
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        return res.status(200).send(content);
      } 
      else {
        // 如果找不到页面，返回简单的HTML
        return res.status(200).send(`
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>文档美化系统</title>
            <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
          </head>
          <body>
            <div class="container py-5 text-center">
              <h1>文档排版与美化系统</h1>
              <p class="lead">欢迎使用文档美化系统</p>
              <a href="/app" class="btn btn-primary">进入应用</a>
            </div>
          </body>
          </html>
        `);
      }
    } catch (error) {
      console.error('提供主页时出错:', error);
      return res.status(500).send('服务器错误: ' + error.message);
    }
  }
  
  // 处理/app路由
  if (req.url === '/app' || req.url.startsWith('/app?')) {
    try {
      const indexPath = path.join(process.cwd(), 'views', 'index.html');
      if (fs.existsSync(indexPath)) {
        const content = fs.readFileSync(indexPath, 'utf8');
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        return res.status(200).send(content);
      } else {
        return res.status(404).send('应用页面未找到');
      }
    } catch (error) {
      console.error('提供应用页面时出错:', error);
      return res.status(500).send('服务器错误: ' + error.message);
    }
  }
  
  // 如果不是特定路由，返回API信息
  const apiInfo = {
    name: "文档美化系统API",
    version: "1.0.0",
    endpoints: [
      { path: "/api/check-task", method: "GET", description: "查询任务状态" },
      { path: "/api/templates", method: "GET", description: "获取模板列表" },
      { path: "/api/beautify-task", method: "POST", description: "创建美化任务" }
    ]
  };
  
  // 返回API信息
  return res.status(200).json(apiInfo);
}; 