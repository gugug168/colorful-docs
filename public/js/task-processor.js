/**
 * 任务处理脚本
 * 用于在客户端检测和触发任务处理
 */

// 监听文档加载完成
document.addEventListener('DOMContentLoaded', function() {
    console.log('任务处理脚本已加载');
    // 自动启动任务处理器
    initTaskProcessor();
});

/**
 * 初始化任务处理器
 */
function initTaskProcessor() {
    // 检查是否有正在检查状态的任务
    const taskCheckInterval = setInterval(function() {
        // 获取页面上正在检查的任务ID
        const taskIds = getActiveTaskIds();
        
        if (taskIds.length > 0) {
            console.log('检测到正在查询的任务:', taskIds);
            // 对于每个任务，触发任务处理API
            taskIds.forEach(taskId => {
                triggerTaskProcessing(taskId);
            });
        }
    }, 5000); // 每5秒检查一次
    
    // 将定时器ID保存到window对象，以便需要时可以清除
    window.taskProcessorInterval = taskCheckInterval;
    
    console.log('任务处理器已初始化，将每5秒检查一次待处理任务');
}

/**
 * 获取页面上正在检查状态的任务ID
 * @returns {Array} 任务ID数组
 */
function getActiveTaskIds() {
    // 从页面状态中获取所有正在查询的任务ID
    const taskIds = [];
    
    // 检查是否有全局taskChecks对象
    if (window.taskChecks) {
        for (const taskId in window.taskChecks) {
            // 确保是"pending"状态的任务
            const taskStatusElement = document.querySelector(`[data-task-id="${taskId}"] .task-status`);
            if (taskStatusElement && taskStatusElement.textContent.includes('待处理')) {
                taskIds.push(taskId);
            }
        }
    }
    
    // 如果还在显示任务进度模态框，并且有任务ID
    const taskProgressModal = document.getElementById('taskProgressModal');
    if (taskProgressModal && window.getComputedStyle(taskProgressModal).display !== 'none') {
        const taskIdFromModal = taskProgressModal.getAttribute('data-task-id');
        if (taskIdFromModal && !taskIds.includes(taskIdFromModal)) {
            taskIds.push(taskIdFromModal);
        }
    }
    
    return taskIds;
}

/**
 * 触发任务处理API
 * @param {string} taskId - 任务ID
 */
function triggerTaskProcessing(taskId) {
    console.log(`触发任务${taskId}处理...`);
    
    // 调用任务处理API
    fetch('/api/processTasks')
        .then(response => response.json())
        .then(data => {
            console.log('任务处理API响应:', data);
        })
        .catch(error => {
            console.error('调用任务处理API失败:', error);
        });
} 