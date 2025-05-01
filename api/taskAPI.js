// 统一任务管理API
const supabaseClient = require('../utils/supabaseClient');
const taskProcessor = require('../utils/taskProcessor');
const path = require('path');
const fs = require('fs');

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

module.exports = async (req, res) => {
  // 根据action参数执行不同的功能
  const { action, taskId } = req.query;
  
  console.log(`处理任务API请求: action=${action}, taskId=${taskId}`);
  
  try {
    // 检查任务状态
    if (action === 'check' && taskId) {
      const taskResult = await supabaseClient.getTask(taskId);
      
      if (!taskResult.success) {
        return res.status(404).json({ 
          success: false, 
          error: `任务不存在或已过期: ${taskResult.error}` 
        });
      }
      
      const task = taskResult.task;
      
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
    }
    
    // 更新任务
    else if (action === 'update' && taskId) {
      const { status, result, error } = req.body;
      
      if (!status) {
        return res.status(400).json({
          success: false,
          error: '缺少状态参数'
        });
      }
      
      const updateResult = await supabaseClient.updateTask(taskId, {
        status,
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
    }
    
    // 处理任务队列
    else if (action === 'process') {
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
      await supabaseClient.updateTask(task.id, {
        status: 'processing',
        updated_at: new Date().toISOString()
      });
      
      // 处理不同类型的任务
      if (task.taskType === 'beautify') {
        // 在后台处理美化任务
        taskProcessor.processBeautifyTask(task.id);
      }
      
      return res.json({
        success: true,
        message: `正在处理任务 ${task.id}`,
        taskId: task.id,
        taskType: task.taskType
      });
    }
    
    // 创建美化任务
    else if (action === 'beautify') {
      const { filePath, filename, targetFormat = 'word', apiType = 'deepseek', templateId = '', customRequirements = '', htmlContent } = req.body;
      
      // 验证参数
      if ((!filePath && !htmlContent) || !filename) {
        return res.status(400).json({
          success: false,
          message: '缺少必要参数'
        });
      }
      
      // 准备任务数据
      const taskData = {
        filename: filename,
        filePath: filePath,
        htmlContent: htmlContent,
        targetFormat: targetFormat,
        apiType: apiType,
        templateId: templateId,
        customRequirements: customRequirements,
        taskType: 'beautify',
        createdAt: new Date().toISOString()
      };
      
      // 创建任务
      const taskResult = await supabaseClient.createTask(taskData);
      
      if (!taskResult.success) {
        throw new Error(`创建任务失败: ${taskResult.error}`);
      }
      
      return res.json({
        success: true,
        taskId: taskResult.taskId,
        status: 'pending',
        message: '美化任务已提交，请稍后检查结果'
      });
    }
    
    // 取消任务
    else if (action === 'cancel' && taskId) {
      const cancelResult = await supabaseClient.updateTask(taskId, {
        status: 'cancelled',
        error: '用户取消了任务',
        updated_at: new Date().toISOString()
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