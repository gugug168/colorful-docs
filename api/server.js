// 主应用服务器 - 适用于Vercel环境
// 这个文件基本上包含app.js的功能，但作为Vercel Serverless Function
const express = require('express');
const path = require('path');
const cors = require('cors');

// 导入必要的模块（与app.js相同）
const supabaseClient = require('../utils/supabaseClient');
const taskProcessor = require('../utils/taskProcessor');

// 创建一个Express应用
const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// 创建处理函数
const serverlessHandler = async (req, res) => {
  try {
    // 设置路由处理
    
    // 根路由 - 返回主页
    if (req.url === '/' || req.url === '') {
      return res.send(`
        <html>
          <head>
            <title>Colorful Docs API</title>
            <style>
              body { font-family: Arial, sans-serif; margin: 40px; }
              h1 { color: #333; }
              p { margin: 20px 0; }
            </style>
          </head>
          <body>
            <h1>Colorful Docs API 服务</h1>
            <p>这是一个 Vercel Serverless 函数，用于处理 Colorful Docs 应用的 API 请求。</p>
            <p>如需访问应用，请使用前端界面。</p>
          </body>
        </html>
      `);
    }
    
    // 处理API请求
    // 注意：主要的API路由已经通过vercel.json定义并指向api目录下的对应处理程序
    
    // 返回404错误，表示路由未找到
    return res.status(404).json({
      success: false,
      error: '请求的资源未找到',
      path: req.url
    });
    
  } catch (error) {
    console.error('Server error:', error);
    
    // 如果尚未发送响应，则发送错误响应
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: '服务器内部错误',
        details: error.message,
        path: req.url
      });
    }
  }
};

// 导出serverless函数处理程序
module.exports = serverlessHandler; 