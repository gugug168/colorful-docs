/**
 * 取消任务API
 * 用于取消处理中或僵死的任务
 */

const { supabase } = require('../utils/supabaseClient');

/**
 * 处理请求
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
    
    // 检查请求方法
    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, error: '方法不允许，请使用POST请求' });
    }
    
    // 获取任务ID
    const url = req.url;
    const taskIdMatch = url.match(/\/cancelTask\/([^\/\?]+)/);
    
    if (!taskIdMatch || !taskIdMatch[1]) {
        return res.status(400).json({ success: false, error: '缺少任务ID' });
    }
    
    const taskId = taskIdMatch[1];
    console.log(`收到取消任务请求: ${taskId}`);
    
    try {
        // 检查任务是否存在
        const { data: task, error: getError } = await supabase
            .from('tasks')
            .select('*')
            .eq('id', taskId)
            .single();
        
        if (getError) {
            console.error('查询任务失败:', getError);
            return res.status(500).json({ success: false, error: '查询任务失败' });
        }
        
        if (!task) {
            return res.status(404).json({ success: false, error: '任务不存在' });
        }
        
        // 更新任务状态为失败
        const { error: updateError } = await supabase
            .from('tasks')
            .update({ 
                status: 'failed',
                error: '用户取消或任务超时',
                updated_at: new Date().toISOString()
            })
            .eq('id', taskId);
        
        if (updateError) {
            console.error('更新任务状态失败:', updateError);
            return res.status(500).json({ success: false, error: '更新任务状态失败' });
        }
        
        console.log(`成功取消任务: ${taskId}`);
        
        // 返回成功响应
        return res.status(200).json({
            success: true,
            message: `任务 ${taskId} 已取消`,
            taskId: taskId
        });
    } catch (error) {
        console.error('取消任务时出错:', error);
        return res.status(500).json({
            success: false,
            error: `取消任务时出错: ${error.message}`
        });
    }
}; 