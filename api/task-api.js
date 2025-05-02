// 任务管理API - 管理任务的创建、检查、更新、处理和取消
const supabaseClient = require('../utils/supabaseClient');
const taskProcessor = require('../utils/taskProcessor');

// 计算任务进度
function getTaskProgress(task) {
  switch (task.status) {
    case 'pending':
      return 0;
    case 'processing':
      // 计算处理时间占比
      const processingStartTime = new Date(task.updated_at).getTime();
      const now = Date.now();
      const elapsed = now - processingStartTime;
      // 假设平均处理时间为60秒
      const progress = Math.min(Math.floor((elapsed / 60000) * 100), 95);
      return progress;
    case 'completed':
      return 100;
    case 'failed':
      return 0;
    default:
      return 0;
  }
}

// 检查任务状态
async function handleCheckTask(req, res, taskId) {
  try {
    // 获取任务信息
    const taskResult = await supabaseClient.getTask(taskId);
    
    if (!taskResult.success) {
      return res.status(404).json({ 
        success: false, 
        error: `任务不存在或已过期: ${taskResult.error}` 
      });
    }
    
    const task = taskResult.task;
    
    // 返回任务状态和结果
    return res.json({
      success: true,
      taskId: task.id,
      status: task.status,
      result: task.result,
      error: task.error,
      progress: getTaskProgress(task),
      createdAt: task.created_at,
      updatedAt: task.updated_at
    });
    
  } catch (error) {
    console.error('获取任务状态出错:', error);
    return res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
}

// 更新任务
async function handleUpdateTask(req, res, taskId) {
  try {
    const { status, result, error } = req.body;
    
    if (!status) {
      return res.status(400).json({
        success: false,
        error: '缺少状态参数'
      });
    }
    
    const updateResult = await supabaseClient.updateTaskStatus(taskId, status, {
      result,
      error
    });
    
    if (!updateResult.success) {
      return res.status(500).json({
        success: false,
        error: updateResult.error
      });
    }
    
    return res.json({
      success: true,
      taskId,
      status
    });
    
  } catch (error) {
    console.error('更新任务状态出错:', error);
    return res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
}

// 处理任务队列
async function handleProcessTasks(req, res) {
  try {
    // 获取待处理任务
    const tasksResult = await supabaseClient.getPendingTasks();
    
    if (!tasksResult.success) {
      return res.status(500).json({
        success: false,
        error: tasksResult.error
      });
    }
    
    const tasks = tasksResult.tasks;
    
    if (tasks.length === 0) {
      return res.json({
        success: true,
        message: '没有待处理的任务'
      });
    }
    
    // 处理第一个待处理任务
    const task = tasks[0];
    
    // 更新任务状态为处理中
    await supabaseClient.updateTaskStatus(task.id, 'processing');
    
    console.log(`开始处理任务 ${task.id}，类型:`, task.data?.taskType || '未知');
    
    // 处理不同类型的任务
    // 检查task.data.taskType
    const taskType = task.data?.taskType || 'beautify';
    
    // 不同任务类型的处理
    if (taskType === 'beautify' || taskType === 'beautify_html') {
      // 在后台处理美化任务
      console.log(`使用taskProcessor.processBeautifyTask处理任务 ${task.id}`);
      taskProcessor.processBeautifyTask(task.id);
    } else {
      // 处理其他类型任务
      console.log(`使用taskProcessor.processTask处理任务 ${task.id}`);
      taskProcessor.processTask(task.id);
    }
    
    return res.json({
      success: true,
      message: `正在处理任务 ${task.id}`,
      taskId: task.id,
      taskType: taskType
    });
    
  } catch (error) {
    console.error('处理任务队列出错:', error);
    return res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
}

// 取消任务
async function handleCancelTask(req, res, taskId) {
  try {
    const cancelResult = await supabaseClient.updateTaskStatus(taskId, 'cancelled', {
      error: '用户取消了任务'
    });
    
    if (!cancelResult.success) {
      return res.status(500).json({
        success: false,
        error: cancelResult.error
      });
    }
    
    return res.json({
      success: true,
      taskId,
      message: '任务已取消'
    });
    
  } catch (error) {
    console.error('取消任务出错:', error);
    return res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
}

// 任务状态API
async function handleTaskStatus(req, res) {
  try {
    const taskId = req.query.taskId;
    
    if (!taskId) {
      return res.status(400).json({
        success: false,
        error: '缺少必要的taskId参数'
      });
    }
    
    // 获取任务信息
    const taskResult = await supabaseClient.getTask(taskId);
    
    if (!taskResult.success) {
      return res.status(404).json({ 
        success: false, 
        error: `任务不存在或已过期: ${taskResult.error}` 
      });
    }
    
    const task = taskResult.task;
    
    // 返回任务状态和结果
    return res.json({
      success: true,
      taskId: task.id,
      status: task.status,
      result: task.result,
      error: task.error,
      progress: getTaskProgress(task),
      createdAt: task.created_at,
      updatedAt: task.updated_at
    });
    
  } catch (error) {
    console.error('API获取任务状态出错:', error);
    return res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
}

// 主处理函数
module.exports = async (req, res) => {
  // 获取操作类型和任务ID
  const action = req.query.action || '';
  const taskId = req.query.taskId || '';
  
  console.log(`处理任务API请求: action=${action}, taskId=${taskId}`);
  
  try {
    // 根据action参数执行不同的操作
    
    // 检查任务状态
    if (action === 'check' && taskId) {
      return await handleCheckTask(req, res, taskId);
    }
    
    // 更新任务
    else if (action === 'update' && taskId) {
      return await handleUpdateTask(req, res, taskId);
    }
    
    // 处理任务队列
    else if (action === 'process') {
      return await handleProcessTasks(req, res);
    }
    
    // 取消任务
    else if (action === 'cancel' && taskId) {
      return await handleCancelTask(req, res, taskId);
    }
    
    // 任务状态API
    else if (action === 'status') {
      return await handleTaskStatus(req, res);
    }
    
    // 未知操作
    else {
      return res.status(400).json({
        success: false,
        error: '未知的操作类型或缺少必要参数'
      });
    }
  } catch (error) {
    console.error('任务API处理错误:', error);
    return res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
}; 