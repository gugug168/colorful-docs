const axios = require('axios');

/**
 * DeepSeek API连接测试端点
 */
module.exports = async (req, res) => {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  
  if (!apiKey) {
    return res.status(500).json({ 
      success: false,
      error: '缺少API密钥配置',
      message: '未配置DEEPSEEK_API_KEY环境变量' 
    });
  }
  
  console.log('开始测试DeepSeek API连接...');
  const startTime = Date.now();
  
  try {
    const response = await axios.post(
      'https://api.deepseek.com/v1/chat/completions',
      {
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: 'You are a helpful assistant.' },
          { role: 'user', content: 'Say "API CONNECTION SUCCESSFUL" if you can respond.' }
        ],
        temperature: 0.1,
        max_tokens: 20
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        timeout: 15000 // 15秒超时
      }
    );
    
    const endTime = Date.now();
    const responseTime = endTime - startTime;
    
    console.log(`DeepSeek API响应时间: ${responseTime}ms`);
    
    return res.json({
      success: true,
      message: 'DeepSeek API连接正常',
      responseTime: responseTime,
      status: response.status,
      data: response.data,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('DeepSeek API连接测试失败:', error.message);
    
    const errorResponse = {
      success: false,
      message: 'DeepSeek API连接失败',
      error: error.message,
      timestamp: new Date().toISOString()
    };
    
    if (error.response) {
      errorResponse.status = error.response.status;
      errorResponse.data = error.response.data;
    } else if (error.request) {
      errorResponse.reason = '请求超时或网络问题';
    }
    
    return res.status(500).json(errorResponse);
  }
}; 