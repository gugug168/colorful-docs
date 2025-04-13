// Vercel Serverless Function for checking task status
const { createClient } = require('@supabase/supabase-js');

// 创建Supabase客户端
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = async (req, res) => {
  // 启用CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // 处理OPTIONS请求
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  try {
    // 获取任务ID
    const taskId = req.query.taskId;
    
    if (!taskId) {
      return res.status(400).json({
        success: false,
        error: '缺少任务ID'
      });
    }
    
    console.log(`检查任务状态: ${taskId}`);
    
    // 直接从Supabase获取任务状态
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('id', taskId)
      .single();
      
    if (error) {
      console.error(`获取任务失败 (${taskId}):`, error);
      return res.status(404).json({
        success: false,
        error: `任务不存在或已过期: ${error.message}`
      });
    }
    
    // 计算进度
    let progress = 0;
    switch (data.status) {
      case 'pending':
        progress = 0;
        break;
      case 'processing':
        // 计算处理时间占比
        const processingStartTime = new Date(data.updated_at).getTime();
        const now = Date.now();
        const elapsed = now - processingStartTime;
        // 假设平均处理时间为60秒
        progress = Math.min(Math.floor((elapsed / 60000) * 100), 95);
        break;
      case 'completed':
        progress = 100;
        break;
      case 'failed':
        progress = 0;
        break;
    }
    
    console.log(`任务${taskId}状态: ${data.status}, 进度: ${progress}%`);
    
    // 返回任务状态和结果
    return res.status(200).json({
      success: true,
      taskId: data.id,
      status: data.status,
      result: data.result,
      error: data.error,
      progress: progress,
      createdAt: data.created_at,
      updatedAt: data.updated_at
    });
    
  } catch (error) {
    console.error('获取任务状态出错:', error);
    return res.status(500).json({ 
      success: false,
      error: error.message
    });
  }
}; 