// Vercel Serverless Function for updating task status
const { createClient } = require('@supabase/supabase-js');

// 调试日志
const debug = (...args) => console.log(new Date().toISOString(), ...args);

// 创建Supabase客户端
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let supabase;
try {
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('缺少Supabase配置');
  }
  supabase = createClient(supabaseUrl, supabaseKey);
} catch (err) {
  console.error('Supabase客户端创建失败:', err);
  // 创建虚拟客户端，避免空引用错误
  supabase = {
    from: () => ({
      update: () => ({ data: null, error: { message: 'Supabase未配置' } })
    })
  };
}

module.exports = async (req, res) => {
  // 启用CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // 处理OPTIONS请求
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // 只处理POST请求
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      success: false,
      error: '方法不允许'
    });
  }
  
  try {
    // 获取任务ID和更新数据
    const taskId = req.query.taskId;
    const { status, error } = req.body || {};
    
    if (!taskId) {
      return res.status(400).json({ 
        success: false,
        error: '缺少任务ID参数'
      });
    }
    
    if (!status) {
      return res.status(400).json({ 
        success: false,
        error: '缺少状态参数'
      });
    }
    
    debug(`更新任务状态: ${taskId} -> ${status}`);
    
    // 准备更新数据
    const updateData = {
      status,
      updated_at: new Date().toISOString()
    };
    
    // 如果提供了错误信息，也更新错误字段
    if (error) {
      updateData.error = error;
    }
    
    // 更新任务状态
    const result = await supabase
      .from('tasks')
      .update(updateData)
      .eq('id', taskId);
    
    if (result.error) {
      console.error(`更新任务 ${taskId} 失败:`, result.error);
      return res.status(500).json({
        success: false,
        error: result.error.message
      });
    }
    
    debug(`任务 ${taskId} 状态已更新为 ${status}`);
    
    // 返回成功响应
    return res.status(200).json({
      success: true,
      message: `任务状态已更新为 ${status}`,
      taskId,
      status
    });
    
  } catch (error) {
    console.error('更新任务状态出错:', error);
    return res.status(500).json({ 
      success: false,
      error: error.message || '服务器内部错误'
    });
  }
}; 