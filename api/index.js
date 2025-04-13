// API入口点，仅用于返回API基本信息

// 设置更详细的日志
const debug = (...args) => {
  console.log(new Date().toISOString(), ...args);
};

module.exports = async (req, res) => {
  try {
    // 启用CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    // 处理OPTIONS请求
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }
    
    debug(`API索引请求: ${req.method} ${req.url}`);

    // 只处理GET请求
    if (req.method !== 'GET') {
      return res.status(405).json({ success: false, error: '方法不允许' });
    }

    // 返回API信息
    const apiInfo = {
      name: "文档美化系统API",
      version: "1.0.0",
      status: "online",
      description: "此端点提供API基本信息。具体功能请访问 /api/status, /api/check-task 等端点。",
      timestamp: new Date().toISOString()
    };
    
    return res.status(200).json(apiInfo);

  } catch (error) {
    console.error('处理API索引请求时发生错误:', error);
    res.status(500).json({
      success: false,
      error: '服务器内部错误',
      message: error.message
    });
  }
}; 