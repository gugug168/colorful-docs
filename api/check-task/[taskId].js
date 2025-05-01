// Vercel API路由 - 检查任务状态
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
      select: () => ({ data: null, error: { message: 'Supabase未配置' } })
    })
  };
}

// 保存最近的任务状态供降级使用
const taskStatusCache = new Map();

module.exports = async (req, res) => {
  // 启用CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // 处理OPTIONS请求
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // 只处理GET请求
  if (req.method !== 'GET') {
    return res.status(405).json({ 
      success: false,
      error: '方法不允许'
    });
  }
  
  try {
    // 获取任务ID
    const { taskId } = req.query;
    
    if (!taskId) {
      return res.status(400).json({ 
        success: false,
        error: '缺少任务ID参数'
      });
    }
    
    debug(`检查任务: ${taskId}`);
    
    // 尝试从Supabase获取任务状态
    let data;
    let error;
    try {
      const result = await supabase
        .from('tasks')
        .select('*')
        .eq('id', taskId)
        .single();
      
      data = result.data;
      error = result.error;
    } catch (supabaseError) {
      console.error('Supabase查询失败:', supabaseError);
      error = { message: supabaseError.message };
    }
    
    // 如果发生错误或任务不存在
    if (error || !data) {
      console.warn(`获取任务 ${taskId} 失败:`, error?.message || '任务不存在');
      
      // 检查缓存
      if (taskStatusCache.has(taskId)) {
        const cachedStatus = taskStatusCache.get(taskId);
        debug(`返回缓存的任务状态: ${cachedStatus.status}`);
        return res.status(200).json({
          success: true,
          ...cachedStatus
        });
      }
      
      // 返回模拟状态（以保证前端不会崩溃）
      return res.status(200).json({
        success: true,
        taskId: taskId,
        status: 'pending',
        result: null,
        error: '无法获取任务状态，可能任务表不存在',
        progress: 0
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
    
    const responseData = {
      taskId: data.id,
      status: data.status,
      result: data.result,
      error: data.error,
      progress: progress,
      createdAt: data.created_at,
      updatedAt: data.updated_at
    };
    
    // 更新缓存
    taskStatusCache.set(taskId, responseData);
    
    // 清理旧缓存项 - 只保留最新的100项
    if (taskStatusCache.size > 100) {
      const oldestKey = [...taskStatusCache.keys()][0];
      taskStatusCache.delete(oldestKey);
    }
    
    debug(`任务${taskId}状态: ${data.status}, 进度: ${progress}%`);
    
    // 返回任务状态
    return res.status(200).json({
      success: true,
      ...responseData
    });
    
  } catch (error) {
    console.error('获取任务状态出错:', error);
    return res.status(500).json({ 
      success: false,
      error: error.message || '服务器内部错误'
    });
  }
}; 