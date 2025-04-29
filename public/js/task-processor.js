/**
 * 任务处理脚本
 * 用于在客户端检测和触发任务处理，确保任务完成后能够显示结果
 */

// 任务状态常量
const TASK_STATUS = {
    PENDING: 'pending',
    PROCESSING: 'processing',
    COMPLETED: 'completed',
    FAILED: 'failed'
};

// 监听文档加载完成
document.addEventListener('DOMContentLoaded', function() {
    console.log('任务处理脚本已加载');
    // 自动启动任务处理器
    initTaskProcessor();
    
    // 监听任务进度弹窗
    setupTaskModalObserver();
});

/**
 * 监听任务进度弹窗，确保设置data-task-id属性
 */
function setupTaskModalObserver() {
    // 使用MutationObserver监听DOM变化
    const observer = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
            // 检查新增的节点
            if (mutation.addedNodes && mutation.addedNodes.length > 0) {
                for (let i = 0; i < mutation.addedNodes.length; i++) {
                    const node = mutation.addedNodes[i];
                    // 如果是元素节点
                    if (node.nodeType === 1) {
                        // 查找任务进度弹窗
                        const modal = node.id === 'taskProgressModal' ? 
                            node : node.querySelector('#taskProgressModal');
                        
                        if (modal) {
                            console.log('检测到任务进度弹窗');
                            // 如果弹窗未设置data-task-id属性，但存在全局任务ID变量
                            if (!modal.getAttribute('data-task-id') && window.currentTaskId) {
                                console.log('设置任务进度弹窗data-task-id属性:', window.currentTaskId);
                                modal.setAttribute('data-task-id', window.currentTaskId);
                            }
                        }
                    }
                }
            }
        });
    });
    
    // 监听弹窗容器的变化
    observer.observe(document.body, { childList: true, subtree: true });
    
    // 监听Bootstrap事件 - 弹窗显示
    document.addEventListener('shown.bs.modal', function(event) {
        if (event.target.id === 'taskProgressModal') {
            console.log('任务进度弹窗显示事件');
            if (!event.target.getAttribute('data-task-id') && window.currentTaskId) {
                console.log('设置任务进度弹窗data-task-id属性(事件):', window.currentTaskId);
                event.target.setAttribute('data-task-id', window.currentTaskId);
            }
        }
    });
    
    console.log('任务进度弹窗监听已设置');
}

/**
 * 初始化任务处理器
 */
function initTaskProcessor() {
    // 初始化任务状态跟踪对象
    window.taskStatus = window.taskStatus || {};
    
    // 初始化任务开始时间跟踪
    window.taskCheckStartTimes = window.taskCheckStartTimes || {};
    
    // 初始化任务重试计数
    window.taskRetryCount = window.taskRetryCount || {};
    
    // 检查是否有待处理状态的任务
    const taskCheckInterval = setInterval(function() {
        // 获取页面上的待处理任务ID
        const pendingTaskIds = getActiveTaskIds();
        
        if (pendingTaskIds.length > 0) {
            console.log('检测到待处理的任务:', pendingTaskIds);
            
            // 检查这些任务是否真的还在处理中
            let hasRealProcessingTask = false;
            
            // 检查是否有正在处理中的任务
            const processingTasks = Object.keys(window.taskStatus).filter(
                taskId => window.taskStatus[taskId] === TASK_STATUS.PROCESSING
            );
            
            if (processingTasks.length > 0) {
                console.log('标记为处理中的任务:', processingTasks);
                
                // 检查这些处理中的任务是否已经超时（超过3分钟）
                const currentTime = Date.now();
                const stillProcessing = processingTasks.filter(taskId => {
                    if (window.taskCheckStartTimes && window.taskCheckStartTimes[taskId]) {
                        const elapsedTime = currentTime - window.taskCheckStartTimes[taskId];
                        const isTimeout = elapsedTime > 3 * 60 * 1000; // 3分钟
                        
                        if (isTimeout) {
                            console.log(`任务 ${taskId} 已经处理超过3分钟，认为已超时`);
                            // 将任务标记为失败
                            window.taskStatus[taskId] = TASK_STATUS.FAILED;
                            // 清理任务开始时间
                            delete window.taskCheckStartTimes[taskId];
                            
                            // 确保在main.js中也标记为停止
                            if (window.activeTaskChecks) {
                                window.activeTaskChecks[taskId] = false;
                            }
                            
                            // 更新UI显示任务失败
                            const taskElements = document.querySelectorAll(`[data-task-id="${taskId}"]`);
                            taskElements.forEach(el => {
                                const statusEl = el.querySelector('.task-status');
                                if (statusEl) {
                                    statusEl.textContent = '处理失败（超时）';
                                    statusEl.classList.remove('text-warning');
                                    statusEl.classList.add('text-danger');
                                }
                            });
                            
                            // 如果正在显示进度弹窗，更新弹窗状态
                            const taskModal = document.getElementById('taskProgressModal');
                            if (taskModal && taskModal.getAttribute('data-task-id') === taskId) {
                                const statusText = taskModal.querySelector('#taskStatusText');
                                if (statusText) {
                                    statusText.textContent = '处理超时，请重试';
                                }
                                
                                const progressBar = taskModal.querySelector('.progress-bar');
                                if (progressBar) {
                                    progressBar.classList.remove('progress-bar-striped', 'progress-bar-animated', 'bg-warning', 'bg-success');
                                    progressBar.classList.add('bg-danger');
                                    progressBar.style.width = '100%';
                                }
                                
                                const errorText = taskModal.querySelector('#errorText');
                                if (errorText) {
                                    errorText.textContent = '任务处理超时，请重新提交或稍后再试';
                                    errorText.style.display = 'block';
                                }
                            }
                            
                            // 尝试通过API取消该任务
                            cancelTimeoutTask(taskId);
                            
                            return false;
                        }
                        
                        // 检查该任务是否已被main.js标记为停止
                        const isStoppedInMainJs = window.activeTaskChecks && window.activeTaskChecks[taskId] === false;
                        if (isStoppedInMainJs) {
                            console.log(`任务 ${taskId} 已被main.js标记为停止，从处理队列移除`);
                            window.taskStatus[taskId] = TASK_STATUS.FAILED;
                            delete window.taskCheckStartTimes[taskId];
                            return false;
                        }
                        
                        return true;
                    }
                    // 如果没有开始时间，则认为不在处理中
                    return false;
                });
                
                hasRealProcessingTask = stillProcessing.length > 0;
                
                if (hasRealProcessingTask) {
                    console.log('当前有任务正在处理中，等待完成...');
                    
                    // 增加安全措施：如果某个任务处理时间过长（超过5分钟），强制清理所有任务
                    const oldestProcessingTask = stillProcessing.reduce((oldest, taskId) => {
                        const startTime = window.taskCheckStartTimes[taskId] || Date.now();
                        return (!oldest || startTime < window.taskCheckStartTimes[oldest]) ? taskId : oldest;
                    }, null);
                    
                    if (oldestProcessingTask) {
                        const oldestElapsedTime = currentTime - window.taskCheckStartTimes[oldestProcessingTask];
                        if (oldestElapsedTime > 5 * 60 * 1000) { // 5分钟
                            console.warn('检测到任务处理时间过长，强制清理所有任务状态');
                            cleanupTaskTracking();
                            hasRealProcessingTask = false;
                        }
                    }
                } else {
                    console.log('没有实际处理中的任务，可以开始新任务处理');
                }
            }
            
            // 检查特定任务是否一直处于待处理状态
            pendingTaskIds.forEach(taskId => {
                if (!window.taskRetryCount[taskId]) {
                    window.taskRetryCount[taskId] = 0;
                }
                
                // 如果一个任务已经尝试了超过10次还是待处理，标记为失败
                if (window.taskRetryCount[taskId] > 10) {
                    console.log(`任务 ${taskId} 重试超过10次，标记为失败。日志如下：${getTaskLog(taskId)}`);
                    window.taskStatus[taskId] = TASK_STATUS.FAILED;
                    delete window.taskRetryCount[taskId];
                    
                    // 确保在main.js中也标记为停止
                    if (window.activeTaskChecks) {
                        window.activeTaskChecks[taskId] = false;
                    }
                    
                    // 更新UI显示任务失败
                    const taskElements = document.querySelectorAll(`[data-task-id="${taskId}"]`);
                    taskElements.forEach(el => {
                        const statusEl = el.querySelector('.task-status');
                        if (statusEl) {
                            statusEl.textContent = '处理失败（重试超限）';
                            statusEl.classList.remove('text-warning');
                            statusEl.classList.add('text-danger');
                        }
                    });
                } else {
                    window.taskRetryCount[taskId]++;
                }
            });
            
            if (!hasRealProcessingTask) {
                // 没有正在处理的任务，触发API处理下一个任务
                triggerTaskProcessing();
            }
        } else {
            // 没有待处理任务，清理所有跟踪状态
            cleanupTaskTracking();
        }
    }, 5000); // 每5秒检查一次
    
    // 将定时器ID保存到window对象，以便需要时可以清除
    window.taskProcessorInterval = taskCheckInterval;
    
    console.log('任务处理器已初始化，将每5秒检查一次待处理任务');
    
    // 立即触发一次任务处理
    setTimeout(triggerTaskProcessing, 1000);
}

/**
 * 清理所有任务跟踪状态
 */
function cleanupTaskTracking() {
    // 仅保留已完成和失败的任务状态，清理其他状态
    for (const taskId in window.taskStatus) {
        if (window.taskStatus[taskId] !== TASK_STATUS.COMPLETED && 
            window.taskStatus[taskId] !== TASK_STATUS.FAILED) {
            delete window.taskStatus[taskId];
        }
    }
    
    // 清理所有任务开始时间
    window.taskCheckStartTimes = {};
    
    // 清理所有任务重试计数
    window.taskRetryCount = {};
    
    // 确保main.js中的活跃任务检查也被清理
    if (window.activeTaskChecks) {
        window.activeTaskChecks = {};
    }
    
    console.log('已清理任务跟踪状态');
}

/**
 * 尝试通过API取消超时任务
 * @param {string} taskId - 任务ID
 */
function cancelTimeoutTask(taskId) {
    console.log(`尝试取消超时任务: ${taskId}`);
    
    fetch(`/api/cancelTask/${taskId}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        }
    })
    .then(response => response.json())
    .then(data => {
        console.log(`取消任务 ${taskId} 结果:`, data);
        // 确保在全局作用域也标记为失败
        if (window.activeTaskChecks) {
            window.activeTaskChecks[taskId] = false;
        }
    })
    .catch(error => {
        console.error(`取消任务 ${taskId} 请求失败:`, error);
    });
}

/**
 * 获取当前活跃的任务ID列表
 * @returns {Array} 当前活跃的任务ID数组
 */
function getActiveTaskIds() {
    // 从DOM元素和全局变量中收集任务ID
    const taskIds = [];
    
    // 从DOM中查找带有data-task-id属性的元素
    document.querySelectorAll('[data-task-id]').forEach(el => {
        const taskId = el.getAttribute('data-task-id');
        if (taskId && !taskIds.includes(taskId)) {
            taskIds.push(taskId);
        }
    });
    
    // 从会话存储中获取当前任务ID
    try {
        const currentTaskId = sessionStorage.getItem('currentTaskId');
        
        // 检查任务是否已在其他地方被标记为停止
        if (currentTaskId && !taskIds.includes(currentTaskId)) {
            // 检查任务当前状态
            const currentStatus = window.taskStatus[currentTaskId];
            // 检查main.js中的activeTaskChecks是否已将任务标记为停止
            const isStoppedInMainJs = window.activeTaskChecks && window.activeTaskChecks[currentTaskId] === false;
            
            // 只有在状态为待处理或处理中，且未被main.js标记为停止时才添加
            if ((!currentStatus || 
                currentStatus === TASK_STATUS.PENDING || 
                currentStatus === TASK_STATUS.PROCESSING) && 
                !isStoppedInMainJs) {
                taskIds.push(currentTaskId);
            }
        }
    } catch (e) {
        console.error('从会话存储获取任务ID失败:', e);
    }
    
    // 过滤掉已知完成、失败或已停止检查的任务
    return taskIds.filter(taskId => {
        const status = window.taskStatus[taskId];
        const isStoppedInMainJs = window.activeTaskChecks && window.activeTaskChecks[taskId] === false;
        
        // 修改：首先检查是否需要验证数据库中的任务状态
        if (!status || status === TASK_STATUS.PENDING || status === TASK_STATUS.PROCESSING) {
            // 任务处于待处理或处理中状态，主动检查一下数据库中的真实状态
            checkTaskRealStatus(taskId);
            
            // 重新获取状态值，这样即使checkTaskRealStatus是异步的，在下次循环中也能获取到更新后的状态
            const updatedStatus = window.taskStatus[taskId];
            
            // 修改：根据更新后的状态决定是否将任务视为活跃
            return (updatedStatus === TASK_STATUS.PENDING || updatedStatus === TASK_STATUS.PROCESSING) && !isStoppedInMainJs;
        }
        
        return false; // 其他情况不视为活跃任务
    });
}

/**
 * 检查任务在数据库中的真实状态
 * @param {string} taskId - 任务ID
 */
function checkTaskRealStatus(taskId) {
    // 如果此任务已经在检查，则不重复检查
    if (window.checkingTaskStatus && window.checkingTaskStatus[taskId]) {
        return;
    }
    
    // 初始化检查状态跟踪
    window.checkingTaskStatus = window.checkingTaskStatus || {};
    window.checkingTaskStatus[taskId] = true;
    
    // 添加时间戳防止缓存
    const timestamp = new Date().getTime();
    
    // 发起一次数据库状态检查
    fetch(`/check-task/${taskId}?t=${timestamp}`, {
        headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
        }
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`获取任务真实状态失败: ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        console.log(`任务${taskId}数据库状态:`, data);
        
        // 如果数据库中任务已完成，更新本地状态
        if (data.status === 'completed') {
            console.log(`任务${taskId}在数据库中已完成，更新本地状态`);
            window.taskStatus[taskId] = TASK_STATUS.COMPLETED;
            
            // 清理任务超时跟踪
            if (window.taskCheckStartTimes && window.taskCheckStartTimes[taskId]) {
                delete window.taskCheckStartTimes[taskId];
            }
            
            // 确保在main.js中也标记为停止
            if (window.activeTaskChecks) {
                window.activeTaskChecks[taskId] = false;
            }
            
            // 如果有结果，获取并显示
            if (data.result) {
                fetchTaskResult(taskId);
            }
        }
        // 任务已失败
        else if (data.status === 'failed') {
            console.log(`任务${taskId}在数据库中已失败，更新本地状态`);
            window.taskStatus[taskId] = TASK_STATUS.FAILED;
            
            // 清理任务超时跟踪
            if (window.taskCheckStartTimes && window.taskCheckStartTimes[taskId]) {
                delete window.taskCheckStartTimes[taskId];
            }
            
            // 确保在main.js中也标记为停止
            if (window.activeTaskChecks) {
                window.activeTaskChecks[taskId] = false;
            }
        }
    })
    .catch(error => {
        console.error(`检查任务${taskId}真实状态失败:`, error);
    })
    .finally(() => {
        // 完成检查
        window.checkingTaskStatus[taskId] = false;
    });
}

/**
 * 获取任务的日志信息
 * @param {string} taskId - 任务ID
 * @returns {string} 任务日志信息
 */
function getTaskLog(taskId) {
    // 尝试从页面中获取任务日志信息
    try {
        // 查找任务相关的日志元素
        const logElement = document.querySelector(`#task-log-${taskId}`);
        if (logElement) {
            return logElement.textContent || '';
        }
        
        // 从sessionStorage中尝试获取日志
        const taskLog = sessionStorage.getItem(`taskLog_${taskId}`);
        if (taskLog) {
            return taskLog;
        }
    } catch (e) {
        console.error('获取任务日志失败:', e);
    }
    
    return '无可用日志';
}

/**
 * 触发任务处理API
 */
function triggerTaskProcessing() {
    console.log('触发任务处理API...');
    
    // 添加时间戳防止缓存
    const timestamp = new Date().getTime();
    
    // 调用任务处理API
    fetch(`/api/processTasks?t=${timestamp}`, {
        method: 'GET',
        headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
        }
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`HTTP错误! 状态: ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        console.log('任务处理API响应:', data);
        
        if (data.taskId) {
            // 设置当前任务ID到全局变量
            window.currentTaskId = data.taskId;
            
            // 保存到会话存储
            try {
                sessionStorage.setItem('currentTaskId', data.taskId);
                // 确保任务类型也被保存 - 设置为beautify_html
                if (!sessionStorage.getItem('taskType_' + data.taskId)) {
                    sessionStorage.setItem('taskType_' + data.taskId, 'beautify_html');
                }
            } catch (e) {
                console.error('保存任务ID到会话存储失败:', e);
            }
            
            // 将任务ID设置到任务进度弹窗
            const taskModal = document.getElementById('taskProgressModal');
            if (taskModal) {
                console.log('更新进度弹窗任务ID:', data.taskId);
                taskModal.setAttribute('data-task-id', data.taskId);
            }
            
            // 有任务正在处理
            window.taskStatus[data.taskId] = TASK_STATUS.PROCESSING;
            
            // 初始化任务超时跟踪
            if (window.taskCheckStartTimes && !window.taskCheckStartTimes[data.taskId]) {
                window.taskCheckStartTimes[data.taskId] = Date.now();
                console.log(`设置任务 ${data.taskId} 开始检查时间为当前时间`);
            }
            
            // 确保main.js中的checkTaskStatus函数只被调用一次
            if (window.checkTaskStatus && !window.activeTaskChecks[data.taskId]) {
                console.log(`通过main.js检查任务${data.taskId}状态...`);
                window.checkTaskStatus(data.taskId);
            } else {
                console.log(`任务${data.taskId}已经在检查中或checkTaskStatus不可用`);
            }
            
            // 如果任务已处理完成
            if (data.success && data.processed) {
                console.log('任务已成功处理，获取结果:', data.taskId);
                window.taskStatus[data.taskId] = TASK_STATUS.COMPLETED;
                
                // 清理任务超时跟踪
                if (window.taskCheckStartTimes && window.taskCheckStartTimes[data.taskId]) {
                    delete window.taskCheckStartTimes[data.taskId];
                }
                
                // 获取任务详细结果
                fetchTaskResult(data.taskId);
            }
        } else if (data.message) {
            console.log(`API消息: ${data.message}`);
            
            // 修改：如果API返回"没有待处理任务"，主动检查所有待处理任务的真实状态
            if (data.message === '没有待处理任务') {
                const pendingTaskIds = getActiveTaskIds();
                if (pendingTaskIds.length > 0) {
                    console.log(`API返回没有待处理任务，但前端仍有${pendingTaskIds.length}个待处理任务，主动检查状态`);
                    pendingTaskIds.forEach(taskId => {
                        // 主动检查任务状态
                        checkTaskRealStatus(taskId);
                    });
                    
                    // 短暂延迟后再次检查待处理任务（等待异步状态检查完成）
                    setTimeout(() => {
                        const updatedPendingTaskIds = getActiveTaskIds();
                        if (updatedPendingTaskIds.length === 0) {
                            console.log('所有任务已完成或被移除，清理状态');
                            cleanupTaskTracking();
                        }
                    }, 2000);
                }
            }
            
            // 检查是否有错误信息
            if (data.error) {
                console.error('任务处理API错误:', data.error);
                // 如果是特定任务的错误，标记为失败
                if (data.failedTaskId) {
                    window.taskStatus[data.failedTaskId] = TASK_STATUS.FAILED;
                    // 清理任务超时跟踪
                    if (window.taskCheckStartTimes && window.taskCheckStartTimes[data.failedTaskId]) {
                        delete window.taskCheckStartTimes[data.failedTaskId];
                    }
                    // 确保在main.js中也标记为停止
                    if (window.activeTaskChecks) {
                        window.activeTaskChecks[data.failedTaskId] = false;
                    }
                }
            }
        }
    })
    .catch(error => {
        console.error('调用任务处理API失败:', error);
        // 等待短暂时间后再次尝试
        setTimeout(() => {
            const pendingTaskIds = getActiveTaskIds();
            if (pendingTaskIds.length > 0) {
                triggerTaskProcessing();
            }
        }, 3000);
    });
}

/**
 * 获取任务结果并显示
 * @param {string} taskId - 任务ID
 */
function fetchTaskResult(taskId) {
    console.log(`获取任务${taskId}详细结果...`);
    
    // 添加时间戳防止缓存
    const timestamp = new Date().getTime();
    
    // 请求任务详情
    fetch(`/check-task/${taskId}?t=${timestamp}`, {
        headers: {
            'Cache-Control': 'no-cache'
        }
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`获取任务详情失败: ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        console.log(`任务${taskId}详情:`, data);
        
        // 如果任务已完成且有结果路径
        if (data.status === 'completed' && data.result) {
            const resultPath = data.result.path || data.result.outputPath;
            if (resultPath) {
                console.log(`任务${taskId}有结果路径:`, resultPath);
                
                // 如果存在loadBeautifiedResult函数，调用它显示结果
                if (window.loadBeautifiedResult) {
                    console.log('调用loadBeautifiedResult显示结果');
                    window.loadBeautifiedResult(resultPath);
                }
                
                // 保存结果到beautyResult全局变量
                window.beautyResult = {
                    outputFileName: resultPath.split('/').pop(),
                    path: resultPath
                };
                
                // 更新任务进度弹窗
                const modal = document.getElementById('taskProgressModal');
                if (modal) {
                    // 更新进度条
                    const progressBar = modal.querySelector('.progress-bar');
                    if (progressBar) {
                        progressBar.style.width = '100%';
                        progressBar.classList.remove('progress-bar-striped', 'progress-bar-animated');
                        progressBar.classList.add('bg-success');
                    }
                    
                    // 更新状态文本
                    const statusText = modal.querySelector('#taskStatusText');
                    if (statusText) {
                        statusText.textContent = '处理完成！';
                    }
                    
                    // 显示完成信息
                    const completeInfo = modal.querySelector('#taskCompleteInfo');
                    if (completeInfo) {
                        completeInfo.classList.remove('d-none');
                    }
                    
                    // 显示查看按钮
                    const viewBtn = modal.querySelector('#viewPreviewBtn');
                    if (viewBtn) {
                        viewBtn.classList.remove('d-none');
                        viewBtn.onclick = function() {
                            // 打开新窗口查看文档
                            window.open(`/view-document/${encodeURIComponent(resultPath)}`, '_blank');
                        };
                    }
                    
                    // 显示下载按钮
                    const downloadBtn = modal.querySelector('#downloadResultBtn');
                    if (downloadBtn) {
                        downloadBtn.classList.remove('d-none');
                        downloadBtn.onclick = function() {
                            // 下载文档
                            window.location.href = `/download?file=${encodeURIComponent(resultPath)}`;
                        };
                    }
                }
            }
        }
    })
    .catch(error => {
        console.error(`获取任务${taskId}结果失败:`, error);
    });
}

/**
 * 更新UI上的任务状态显示
 * 注意：此函数本地更新UI，不会触发额外的任务检查
 * @param {string} taskId - 任务ID，不提供则更新所有任务
 * @param {Object} response - 响应对象，包含status和statusText
 */
function updateTaskStatusUI(taskId, response) {
    // 避免空响应或未定义响应导致错误
    if (!response) {
        console.warn('updateTaskStatusUI被调用时response为undefined');
        return;
    }
    
    // 如果调用来自定时器检查，且main.js中的updateTaskStatusUI可用，则使用main.js的实现
    if (typeof window.updateTaskStatusUI === 'function' && window.updateTaskStatusUI !== updateTaskStatusUI) {
        // 避免在main.js中继续调用checkTaskStatus而创建重复检查
        const originalResponse = {...response};
        
        // 提供必要的响应，避免触发新的任务检查
        window.updateTaskStatusUI(taskId, originalResponse);
        return;
    }
    
    // 本地UI更新逻辑
    if (taskId && response) {
        // 更新特定任务的状态
        const taskElement = document.querySelector(`[data-task-id="${taskId}"]`);
        if (taskElement) {
            const statusElement = taskElement.querySelector('.task-status');
            if (statusElement) {
                const status = response.status || '';
                const statusText = response.statusText || '';
                
                statusElement.textContent = statusText;
                
                // 更新状态颜色
                statusElement.classList.remove('text-warning', 'text-danger', 'text-success');
                if (status === 'processing') {
                    statusElement.classList.add('text-warning');
                } else if (status === 'completed') {
                    statusElement.classList.add('text-success');
                    
                    // 如果页面上有刷新按钮，触发刷新
                    const refreshButton = taskElement.querySelector('.refresh-task');
                    if (refreshButton) {
                        refreshButton.click();
                    }
                } else if (status === 'failed' || statusText.includes('错误') || statusText.includes('失败')) {
                    statusElement.classList.add('text-danger');
                }
            }
        }
        
        // 更新模态框状态(如果有)
        const taskProgressModal = document.getElementById('taskProgressModal');
        if (taskProgressModal) {
            // 如果是同一个任务或者模态框没有设置任务ID
            const modalTaskId = taskProgressModal.getAttribute('data-task-id');
            if (!modalTaskId || modalTaskId === taskId) {
                const statusText = taskProgressModal.querySelector('#taskStatusText');
                if (statusText) {
                    if (response.status === 'processing') {
                        statusText.textContent = '正在处理您的文档，请稍候...';
                    } else if (response.status === 'completed') {
                        statusText.textContent = '文档处理完成！';
                        
                        // 显示完成信息区域
                        const completeInfo = taskProgressModal.querySelector('#taskCompleteInfo');
                        if (completeInfo) {
                            completeInfo.classList.remove('d-none');
                        }
                        
                        // 更新进度条
                        const progressBar = taskProgressModal.querySelector('.progress-bar');
                        if (progressBar) {
                            progressBar.style.width = '100%';
                            progressBar.classList.remove('progress-bar-striped', 'progress-bar-animated');
                            progressBar.classList.add('bg-success');
                        }
                    }
                }
            }
        }
    } else {
        // 根据跟踪状态更新所有任务的UI
        for (const taskId in window.taskStatus) {
            const taskElement = document.querySelector(`[data-task-id="${taskId}"]`);
            if (taskElement) {
                const statusElement = taskElement.querySelector('.task-status');
                if (statusElement) {
                    let statusObj = {
                        status: 'pending',
                        statusText: '待处理'
                    };
                    
                    switch(window.taskStatus[taskId]) {
                        case TASK_STATUS.PROCESSING:
                            statusObj = {
                                status: 'processing',
                                statusText: '处理中'
                            };
                            break;
                        case TASK_STATUS.COMPLETED:
                            statusObj = {
                                status: 'completed',
                                statusText: '已完成'
                            };
                            break;
                        case TASK_STATUS.FAILED:
                            statusObj = {
                                status: 'failed',
                                statusText: '处理失败'
                            };
                            break;
                    }
                    
                    statusElement.textContent = statusObj.statusText;
                    
                    // 更新状态颜色
                    statusElement.classList.remove('text-warning', 'text-danger', 'text-success');
                    if (statusObj.status === 'processing') {
                        statusElement.classList.add('text-warning');
                    } else if (statusObj.status === 'completed') {
                        statusElement.classList.add('text-success');
                    } else if (statusObj.status === 'failed') {
                        statusElement.classList.add('text-danger');
                    }
                }
            }
        }
    }
} 