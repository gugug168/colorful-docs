// 兼容性API路由 - 处理旧版本请求
module.exports = async (req, res) => {
  // 启用CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // 处理OPTIONS请求
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  console.log('收到旧版本美化请求，重定向到新API');
  
  // 从请求中提取数据
  const body = req.body || {};
  const { filename, targetFormat, customRequirements } = body;
  
  // 返回响应，引导前端使用新API
  return res.status(200).json({
    success: true,
    taskId: 'mock-task-' + Date.now(),
    status: 'pending',
    message: '请使用/api/beautify-task端点替代/beautify'
  });
}; 