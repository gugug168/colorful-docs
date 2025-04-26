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
    
    // 设置较长的响应超时时间
    res.setTimeout(55000, () => {
        console.log('响应超时，但后台任务会继续执行');
        // 当请求即将超时时，发送一个200响应，避免客户端收到504
        if (!res.headersSent) {
            res.status(200).json({
                success: true,
                message: '任务已接收，正在后台继续处理',
                isAsync: true
            });
        }
    });
    
    // 验证密钥 (简单保护，防止未授权访问)
    const apiKey = req.headers['x-api-key'] || req.query.apiKey;
    const expectedKey = process.env.TASK_PROCESSOR_API_KEY;
    
    if (expectedKey && apiKey !== expectedKey) {
        console.error('API密钥验证失败');
        return res.status(401).json({ success: false, error: '未授权访问' });
    }
    
    try {
        // 添加请求参数日志
        console.log('请求方法:', req.method);
        console.log('请求查询参数:', JSON.stringify(req.query));
        console.log('是否有请求体:', !!req.body);
        
        // 从Supabase获取pending状态的任务
        console.log('查询pending状态的任务...');
        
        let supabaseQuery;
        try {
            supabaseQuery = await supabase
                .from('tasks')
                .select('*')
                .eq('status', 'pending')
                .order('created_at', { ascending: true }) // 先处理最早创建的任务
                .limit(1);
        } catch (queryError) {
            console.error('Supabase查询出错:', queryError);
            return res.status(500).json({ 
                success: false, 
                error: '数据库查询失败', 
                details: queryError.message 
            });
        }
        
        const { data: tasks, error } = supabaseQuery;

        if (error) {
            console.error('查询任务失败:', error);
            return res.status(500).json({ 
                success: false, 
                error: '查询任务失败', 
                details: error.message,
                hint: '请检查Supabase连接和权限'
            });
        }

        // 如果没有pending任务
        if (!tasks || tasks.length === 0) {
            console.log('没有找到pending状态的任务');
            return res.status(200).json({ 
                success: true, 
                message: '没有待处理任务' 
            });
        }

        // 处理找到的第一个pending任务
        const task = tasks[0];
        console.log(`找到待处理任务: ID=${task.id}, 创建时间=${task.created_at}`);

        // 使用Promise.race和超时控制处理超时
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('任务处理超时')), 50000); // 50秒超时
        });
        
        // 创建处理任务的Promise
        const processingPromise = (async () => {
            console.log(`开始处理任务 ${task.id}...`);
            return await processTask(task.id);
        })();
        
        // 使用Promise.race来实现超时控制
        let result;
        try {
            result = await Promise.race([processingPromise, timeoutPromise]);
            console.log(`任务 ${task.id} 处理完成，结果:`, result.success ? '成功' : '失败');
        } catch (timeoutError) {
            console.log(`任务 ${task.id} 处理超时，但会在后台继续处理`);
            if (!res.headersSent) {
                return res.status(202).json({
                    success: true,
                    processed: false,
                    taskId: task.id,
                    message: '任务处理超时，但会在后台继续处理',
                    isAsync: true
                });
            }
            return;
        }
        
        // 如果已经发送了超时响应，直接返回
        if (res.headersSent) {
            console.log('响应已发送，不再发送新响应');
            return;
        }

        // 返回处理结果
        return res.status(200).json({
            success: true,
            processed: true,
            taskId: task.id,
            result: result
        });
    } catch (error) {
        console.error('处理任务时出错:', error);
        console.error('错误堆栈:', error.stack);
        
        // 如果已经发送了超时响应，直接返回
        if (res.headersSent) {
            console.log('响应已发送，不再发送错误响应');
            return;
        }
        
        return res.status(500).json({
            success: false,
            error: `处理任务时出错: ${error.message}`,
            details: error.stack
        });
    }
}; 