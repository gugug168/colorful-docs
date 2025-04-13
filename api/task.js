const { createClient } = require('@supabase/supabase-js');
const { nanoid } = require('nanoid');
const { processBeautifyTask } = require('../utils/taskProcessor');

// 创建Supabase客户端
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

module.exports = async (req, res) => {
  // 获取任务状态
  if (req.method === 'GET') {
    try {
      const taskId = req.query.taskId;
      
      if (!taskId) {
        return res.status(400).json({ success: false, error: '缺少任务ID' });
      }
      
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('id', taskId)
        .single();
        
      if (error) {
        return res.status(500).json({ success: false, error: error.message });
      }
      
      if (!data) {
        return res.status(404).json({ success: false, error: '未找到任务' });
      }
      
      return res.status(200).json({
        success: true,
        task: {
          id: data.id,
          status: data.status,
          type: data.type,
          progress: data.progress || 0,
          result: data.result || null,
          error: data.error || null,
          createdAt: data.created_at,
          updatedAt: data.updated_at
        }
      });
    } catch (err) {
      console.error('获取任务状态错误:', err);
      return res.status(500).json({ success: false, error: '获取任务失败: ' + err.message });
    }
  }
  
  // 创建新任务
  if (req.method === 'POST') {
    try {
      const { type, fileUrl, fileName, fileKey, options } = req.body;
      
      if (!type || !fileUrl || !fileName) {
        return res.status(400).json({ 
          success: false, 
          error: '缺少必要参数: type, fileUrl, fileName' 
        });
      }
      
      // 验证任务类型
      const validTaskTypes = ['beautify', 'optimize', 'summarize'];
      if (!validTaskTypes.includes(type)) {
        return res.status(400).json({ 
          success: false, 
          error: `无效的任务类型，支持的类型: ${validTaskTypes.join(', ')}` 
        });
      }
      
      // 生成任务ID
      const taskId = nanoid();
      
      // 创建任务记录
      const { data, error } = await supabase
        .from('tasks')
        .insert([{
          id: taskId,
          type,
          status: 'pending',
          file_url: fileUrl,
          file_name: fileName,
          file_key: fileKey,
          options: options || {},
          progress: 0,
          created_at: new Date().toISOString()
        }])
        .select()
        .single();
        
      if (error) {
        console.error('创建任务错误:', error);
        return res.status(500).json({ success: false, error: error.message });
      }
      
      // 对于美化任务，立即启动处理（异步）
      if (type === 'beautify') {
        // 不等待任务完成，异步处理
        processBeautifyTask(taskId).catch(err => {
          console.error(`处理任务 ${taskId} 错误:`, err);
        });
      }
      
      return res.status(200).json({
        success: true,
        message: '任务已创建并加入队列',
        taskId,
        status: 'pending'
      });
      
    } catch (err) {
      console.error('创建任务错误:', err);
      return res.status(500).json({ success: false, error: '创建任务失败: ' + err.message });
    }
  }

  // 不支持其他HTTP方法
  return res.status(405).json({ success: false, error: '方法不允许' });
}; 