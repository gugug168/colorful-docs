// API入口点，仅用于返回API基本信息

// 设置更详细的日志
const debug = (...args) => {
  console.log(new Date().toISOString(), ...args);
};

// 引入其他API处理模块以适应Vercel的路由架构
// 这样在Vercel上，/api/* 请求会被正确路由到相应的处理程序
const processTasks = require('./processTasks');
const checkTask = require('./check-task');
const task = require('./task');
const upload = require('./upload');
const beautifyTask = require('./beautify-task');
const templates = require('./templates');
const download = require('./download');
const cancelTask = require('./cancelTask');

/**
 * API路由适配器
 * 根据请求路径将请求分发到对应的处理函数
 */
module.exports = async (req, res) => {
  // 获取请求路径
  const url = req.url || '';
  console.log(`[API] ${req.method} ${url}`);
  
  // 简单请求分发，按路径匹配
  if (url.includes('/processTasks') || url.includes('/process-tasks')) {
    return await processTasks(req, res);
  } else if (url.includes('/check-task/') || url.includes('/check-task')) {
    return await checkTask(req, res);
  } else if (url.includes('/task')) {
    return await task(req, res);
  } else if (url.includes('/upload')) {
    return await upload(req, res);
  } else if (url.includes('/beautify-task') || url.includes('/beautify')) {
    return await beautifyTask(req, res);
  } else if (url.includes('/templates')) {
    return await templates(req, res);
  } else if (url.includes('/download')) {
    return await download(req, res);
  } else if (url.includes('/cancelTask/')) {
    return await cancelTask(req, res);
  }
  
  // 未匹配到路由，返回404
  res.statusCode = 404;
  res.end(JSON.stringify({ error: 'API路由未找到' }));
}; 