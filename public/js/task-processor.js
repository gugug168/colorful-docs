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
    
    // 检查是否有待处理状态的任务
    const taskCheckInterval = setInterval(function() {
        // 获取页面上的待处理任务ID
        const pendingTaskIds = getActiveTaskIds();
        
        if (pendingTaskIds.length > 0) {
            console.log('检测到待处理的任务:', pendingTaskIds);
            
            // 检查是否有正在处理中的任务
            const processingTasks = Object.keys(window.taskStatus).filter(
                taskId => window.taskStatus[taskId] === TASK_STATUS.PROCESSING
            );
            
            if (processingTasks.length === 0) {
                // 没有正在处理的任务，触发API处理下一个任务
                triggerTaskProcessing();
            } else {
                console.log('当前有任务正在处理中，等待完成...');
            }
        }
    }, 5000); // 每5秒检查一次
    
    // 将定时器ID保存到window对象，以便需要时可以清除
    window.taskProcessorInterval = taskCheckInterval;
    
    console.log('任务处理器已初始化，将每5秒检查一次待处理任务');
    
    // 立即触发一次任务处理
    setTimeout(triggerTaskProcessing, 1000);
}

/**
 * 获取页面上待处理状态的任务ID
 * @returns {Array} 任务ID数组
 */
function getActiveTaskIds() {
    const taskIds = [];
    
    // 从DOM中获取所有任务元素
    const taskElements = document.querySelectorAll('[data-task-id]');
    
    taskElements.forEach(element => {
        const taskId = element.getAttribute('data-task-id');
        const taskStatusElement = element.querySelector('.task-status');
        
        // 只添加状态为"待处理"的任务
        if (taskStatusElement && (
            taskStatusElement.textContent.includes('待处理') || 
            taskStatusElement.textContent.includes('排队中')
        )) {
            // 检查任务是否已被跟踪为完成或失败
            if (!window.taskStatus[taskId] || 
                window.taskStatus[taskId] === TASK_STATUS.PENDING) {
                taskIds.push(taskId);
            }
        }
    });
    
    // 如果还在显示任务进度模态框，并且有任务ID
    const taskProgressModal = document.getElementById('taskProgressModal');
    if (taskProgressModal && window.getComputedStyle(taskProgressModal).display !== 'none') {
        const taskIdFromModal = taskProgressModal.getAttribute('data-task-id');
        if (taskIdFromModal && !taskIds.includes(taskIdFromModal) && 
            (!window.taskStatus[taskIdFromModal] || 
             window.taskStatus[taskIdFromModal] === TASK_STATUS.PENDING)) {
            taskIds.push(taskIdFromModal);
        }
    }
    
    // 也从全局taskChecks对象中获取任务
    if (window.taskChecks) {
        for (const taskId in window.taskChecks) {
            if (!taskIds.includes(taskId) && 
                (!window.taskStatus[taskId] || window.taskStatus[taskId] === TASK_STATUS.PENDING)) {
                taskIds.push(taskId);
            }
        }
    }
    
    // 从会话存储中获取当前任务ID（如果有）
    try {
        const currentTaskId = sessionStorage.getItem('currentTaskId');
        if (currentTaskId && !taskIds.includes(currentTaskId) && 
            (!window.taskStatus[currentTaskId] || window.taskStatus[currentTaskId] === TASK_STATUS.PENDING)) {
            taskIds.push(currentTaskId);
        }
    } catch (e) {
        console.error('从会话存储获取任务ID失败:', e);
    }
    
    return taskIds;
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
            'Cache-Control': 'no-cache'
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