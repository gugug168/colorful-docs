// API入口点
const fs = require('fs');
const path = require('path');
const handleStaticRequest = require('./_static');

// 添加全局错误处理
process.on('unhandledRejection', (reason, promise) => {
  console.error('未处理的Promise拒绝:', reason);
});

// 设置更详细的日志
const debug = (...args) => {
  console.log(new Date().toISOString(), ...args);
};

// 检查环境变量
debug('环境变量检查:');
debug('SUPABASE_URL:', process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '未设置');
debug('SUPABASE_KEY设置状态:', process.env.SUPABASE_KEY ? '已设置' : '未设置'); 
debug('SUPABASE_SERVICE_KEY设置状态:', process.env.SUPABASE_SERVICE_KEY ? '已设置' : '未设置');
debug('NEXT_PUBLIC_SUPABASE_ANON_KEY设置状态:', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? '已设置' : '未设置');
debug('NODE_ENV:', process.env.NODE_ENV);

// 导入Express应用（如果可用）
let app;
try {
  app = require('../app');
  debug('成功导入app.js');
} catch (error) {
  console.error('无法导入app.js:', error);
}

// 主处理函数
module.exports = async (req, res) => {
  try {
    // 启用CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    // 处理OPTIONS请求
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }
    
    debug(`处理请求: ${req.method} ${req.url}`);
    
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
      
      debug(`尝试加载API处理程序: ${handlerPath}`);
      
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
        debug('处理根路径请求');
        // 尝试提供主页
        const landingPath = path.join(process.cwd(), 'views', 'landing.html'); 
        const indexPath = path.join(process.cwd(), 'views', 'index.html');
        
        debug('检查文件路径:', landingPath, fs.existsSync(landingPath));
        debug('检查文件路径:', indexPath, fs.existsSync(indexPath));
        
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
          debug('未找到landing.html或index.html，返回默认HTML');
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
        debug('处理应用页面请求');
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
    debug('返回API信息');
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
  } catch (error) {
    console.error('处理请求时发生致命错误:', error);
    res.status(500).json({
      error: '服务器内部错误',
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}; 