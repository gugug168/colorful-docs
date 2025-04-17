/**
 * 任务处理API端点
 * 用于处理Supabase中的pending状态任务
 */

const { supabase } = require('../utils/supabaseClient');
const { processTask } = require('../utils/taskProcessor');

/**
 * 处理请求
 */
module.exports = async (req, res) => {
    console.log('任务处理API被调用');
    
    // 验证密钥 (简单保护，防止未授权访问)
    const apiKey = req.headers['x-api-key'] || req.query.apiKey;
    const expectedKey = process.env.TASK_PROCESSOR_API_KEY;
    
    if (expectedKey && apiKey !== expectedKey) {
        console.error('API密钥验证失败');
        return res.status(401).json({ success: false, error: '未授权访问' });
    }
    
    try {
        // 从Supabase获取pending状态的任务
        console.log('查询pending状态的任务...');
        const { data: tasks, error } = await supabase
            .from('tasks')
            .select('*')
            .eq('status', 'pending')
            .order('created_at', { ascending: true }) // 先处理最早创建的任务
            .limit(1); // 一次处理一个任务

        if (error) {
            console.error('查询任务失败:', error);
            return res.status(500).json({ success: false, error: '查询任务失败' });
        }

        // 如果没有pending任务
        if (!tasks || tasks.length === 0) {
            console.log('没有找到pending状态的任务');
            return res.status(200).json({ success: true, message: '没有待处理任务' });
        }

        // 处理找到的第一个pending任务
        const task = tasks[0];
        console.log(`开始处理任务 ${task.id}...`);

        // 调用任务处理器
        const result = await processTask(task.id);

        // 返回处理结果
        return res.status(200).json({
            success: true,
            processed: true,
            taskId: task.id,
            result: result
        });
    } catch (error) {
        console.error('处理任务时出错:', error);
        return res.status(500).json({
            success: false,
            error: `处理任务时出错: ${error.message}`
        });
    }
}; 