/**
 * 任务处理API端点
 * 用于处理Supabase中的pending状态任务
 */

const { createClient } = require('@supabase/supabase-js');
const { processTask } = require('../utils/taskProcessor');

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

/**
 * 处理请求
 */
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
        console.log('查找待处理任务...');
        
        // 查询待处理的任务
        let { data: pendingTasks, error } = await supabase
            .from('tasks')
            .select('*')
            .eq('status', 'pending')
            .order('created_at', { ascending: true })
            .limit(1);
        
        if (error) {
            console.error('查询待处理任务失败:', error);
            return res.status(500).json({
                success: false,
                error: error.message
            });
        }
        
        // 如果没有待处理任务
        if (!pendingTasks || pendingTasks.length === 0) {
            console.log('没有待处理任务');
            return res.status(200).json({
                success: true,
                message: '没有待处理任务'
            });
        }
        
        // 获取第一个待处理任务
        const task = pendingTasks[0];
        console.log(`找到待处理任务: ${task.id}`);
        
        // 更新任务状态为处理中
        const { error: updateError } = await supabase
            .from('tasks')
            .update({ status: 'processing', updated_at: new Date().toISOString() })
            .eq('id', task.id);
        
        if (updateError) {
            console.error(`更新任务 ${task.id} 状态失败:`, updateError);
            // 继续处理，不中断流程
        }
        
        // 返回任务ID
        return res.status(200).json({
            success: true,
            message: '发现待处理任务',
            taskId: task.id,
            task: {
                id: task.id,
                type: task.type || task.data?.taskType || 'beautify',
                status: 'processing',
                data: task.data
            }
        });
    } catch (error) {
        console.error('处理任务API错误:', error);
        return res.status(500).json({
            success: false,
            error: error.message || '服务器内部错误'
        });
    }
}; 