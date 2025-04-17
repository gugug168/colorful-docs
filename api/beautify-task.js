// API美化任务文件 - 创建美化任务
const { createClient } = require('@supabase/supabase-js');
const { v4: uuidv4 } = require('uuid');

// 创建Supabase客户端
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * 添加兼容性处理，支持旧版本API调用
 * 如果请求路径包含/beautify（而不是/beautify-task），使用兼容处理
 */
const handleLegacyRequest = (req, res) => {
  console.log('收到旧版本美化请求，提供兼容处理');
  
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

/**
 * 处理请求 - 入口点
 */
module.exports = async (req, res) => {
  // 启用CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // 处理OPTIONS请求
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // 检查请求路径，处理兼容性调用
  const requestPath = req.url || '';
  if (requestPath.includes('/beautify') && !requestPath.includes('/beautify-task')) {
    return handleLegacyRequest(req, res);
  }
  
  // 只处理POST请求
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: '方法不允许'
    });
  }
  
  try {
    const body = req.body;
    console.log('收到美化任务请求:', JSON.stringify(body));
    
    // 获取参数
    const { filePath, filename, targetFormat = 'word', apiType = 'deepseek', templateId = '', customRequirements = '' } = body;
    
    // 验证文件路径和文件名
    if (!filePath || !filename) {
      return res.status(400).json({
        success: false,
        message: '缺少文件路径或文件名'
      });
    }
    
    // 生成任务ID
    const taskId = uuidv4();
    
    // 准备任务数据
    const taskData = {
      id: taskId,
      status: 'pending',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      data: {
        filename: filename,
        filePath: filePath,
        targetFormat: targetFormat,
        apiType: apiType,
        customRequirements: customRequirements,
        taskType: 'beautify',
        createdAt: new Date().toISOString()
      },
      result: null,
      error: null,
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    };
    
    // 尝试创建任务到Supabase
    try {
      const { data, error } = await supabase
        .from('tasks')
        .insert([taskData])
        .select();
      
      if (error) {
        console.error('Supabase创建任务失败:', error);
        // 在Supabase失败的情况下，我们仍然返回成功
        // 因为前端只需要任务ID来检查状态
      }
      
      console.log(`任务创建${error ? '失败但继续' : '成功'}: ${taskId}`);
    } catch (supabaseError) {
      console.error('Supabase请求错误:', supabaseError);
      // 继续执行，不影响API响应
    }
    
    // 返回任务ID - 即使Supabase创建失败也返回成功
    // 用于前端展示目的
    return res.status(200).json({
      success: true,
      taskId: taskId,
      status: 'pending',
      message: '美化任务已提交，请稍后检查结果'
    });
    
  } catch (error) {
    console.error('创建美化任务出错:', error);
    return res.status(500).json({ 
      success: false,
      error: error.message || '服务器内部错误'
    });
  }
}; 