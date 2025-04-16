/**
 * 任务处理器
 * 用于处理异步任务队列
 */

const supabaseClient = require('./supabaseClient');
const aiOptimizer = require('./aiOptimizer');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// 全局API配置 - 应从app.js中导入或通过环境变量设置
let globalApiConfig = {
    apiKey: process.env.DEEPSEEK_API_KEY || '',
    apiType: 'deepseek',
    apiParams: {
        deepseek: { temperature: 0.7, max_tokens: 8000 }
    }
};

/**
 * 设置全局API配置
 * @param {Object} config - API配置
 */
function setApiConfig(config) {
    globalApiConfig = config;
}

/**
 * 处理美化任务
 * @param {string} taskId - 任务ID
 * @returns {Promise<Object>} - 处理结果
 */
async function processBeautifyTask(taskId) {
    console.log(`开始处理美化任务: ${taskId}`);
    
    try {
        // 更新任务状态为处理中
        await supabaseClient.updateTaskStatus(taskId, 'processing');
        
        // 获取任务数据
        const taskResult = await supabaseClient.getTask(taskId);
        if (!taskResult.success) {
            throw new Error(`获取任务数据失败: ${taskResult.error}`);
        }
        
        const task = taskResult.task;
        const { filename, targetFormat, htmlContent, customRequirements, colorizedImages } = task.data;
        
        // 设置超时机制 - 5分钟后自动标记为失败
        const timeoutId = setTimeout(async () => {
            console.log(`任务 ${taskId} 执行超时，标记为失败`);
            await supabaseClient.updateTaskStatus(taskId, 'failed', {
                error: '任务执行超时，已自动终止'
            });
        }, 5 * 60 * 1000); // 5分钟
        
        // 生成优化提示
        const optimizationPrompt = aiOptimizer.generateOptimizationPrompt(targetFormat, customRequirements);
        
        // 根据当前配置选择AI服务
        const aiProvider = globalApiConfig.apiType.toLowerCase();
        console.log(`使用AI提供商: ${aiProvider} 处理任务 ${taskId}`);
        
        let optimizedHTML;
        let usedBackupMode = false;
        
        try {
            if (aiProvider === 'deepseek') {
                // 使用DeepSeek处理HTML
                optimizedHTML = await aiOptimizer.processWithDeepseek(
                    htmlContent,
                    optimizationPrompt,
                    globalApiConfig.apiKey,
                    globalApiConfig.apiParams.deepseek
                );
            } else if (aiProvider === 'baidu') {
                // 使用百度文心处理HTML
                optimizedHTML = await aiOptimizer.beautifyWithBaidu(
                    htmlContent,
                    optimizationPrompt,
                    globalApiConfig.apiKey,
                    globalApiConfig.apiSecret,
                    globalApiConfig.apiParams.baidu || { temperature: 0.7, max_tokens: 4000 }
                );
            } else {
                // 默认使用DeepSeek
                console.log(`不支持的AI提供商: ${aiProvider}，改用DeepSeek`);
                optimizedHTML = await aiOptimizer.processWithDeepseek(
                    htmlContent,
                    optimizationPrompt,
                    globalApiConfig.apiKey,
                    globalApiConfig.apiParams.deepseek
                );
            }
            
            if (!optimizedHTML) {
                throw new Error('AI处理返回了空内容');
            }
            
        } catch (aiError) {
            console.error(`任务 ${taskId} AI处理失败:`, aiError);
            console.log('使用本地备用模式处理HTML...');
            
            // 使用本地备用美化功能
            optimizedHTML = aiOptimizer.beautifyWithRules(htmlContent, targetFormat, customRequirements);
            usedBackupMode = true;
            
            // 如果本地处理也失败，则标记任务为失败
            if (!optimizedHTML) {
                clearTimeout(timeoutId);
                await supabaseClient.updateTaskStatus(taskId, 'failed', {
                    error: `AI处理失败，备用模式也失败: ${aiError.message}`
                });
                return {
                    success: false,
                    error: `AI处理失败，备用模式也失败: ${aiError.message}`
                };
            }
            
            console.log(`任务 ${taskId} 本地备用模式成功处理了HTML内容`);
        }
        
        // 处理上色图片 - 替换HTML中的图片路径
        if (colorizedImages && Array.isArray(colorizedImages) && colorizedImages.length > 0) {
            const imageColorizer = require('./imageColorizer');
            console.log(`任务 ${taskId} 应用 ${colorizedImages.length} 张上色图片到美化结果`);
            const replaceResult = imageColorizer.replaceImagesInHtml(optimizedHTML, colorizedImages);
            optimizedHTML = replaceResult.content;
            console.log(`任务 ${taskId} 成功替换了 ${replaceResult.replacedCount} 张上色图片`);
        }
        
        // 保存处理后的HTML到temp目录
        const timestamp = Date.now();
        // 使用/tmp目录(Vercel环境可写目录)
        const tempDir = process.env.NODE_ENV === 'production' ? '/tmp/temp' : path.join(__dirname, '..', 'temp');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }
        
        // 生成唯一文件名
        const outputFileName = `beautified-${taskId}-${timestamp}.html`;
        const outputPath = path.join(tempDir, outputFileName);
        
        // 保存HTML到文件
        fs.writeFileSync(outputPath, optimizedHTML);
        console.log(`任务 ${taskId} 美化后的HTML已保存到: ${outputPath}`);
        
        // 复制到downloads目录供下载
        const downloadsDir = process.env.NODE_ENV === 'production' ? '/tmp/downloads' : path.join(__dirname, '..', 'downloads');
        if (!fs.existsSync(downloadsDir)) {
            fs.mkdirSync(downloadsDir, { recursive: true });
        }
        
        const downloadPath = path.join(downloadsDir, outputFileName);
        fs.copyFileSync(outputPath, downloadPath);
        console.log(`任务 ${taskId} 已复制到下载目录: ${downloadPath}`);
        
        // 清除超时
        clearTimeout(timeoutId);
        
        // 准备结果对象，以防上传失败时仍能保存结果
        const resultObject = {
            path: outputPath, // 默认使用本地路径
            outputFileName: outputFileName,
            html: optimizedHTML.substring(0, 1000) + '...', // 只保存部分HTML内容
            type: targetFormat,
            originalname: filename,
            wasBackupMode: usedBackupMode,
            completedAt: new Date().toISOString()
        };
        
        // 将文件上传到Supabase存储
        let fileUrl = '';
        try {
            const fileContent = fs.readFileSync(outputPath);
            const uploadResult = await supabaseClient.uploadFile(
                fileContent,
                `beautified/${outputFileName}`,
                'uploads'
            );
            
            if (uploadResult.success) {
                fileUrl = uploadResult.url;
                resultObject.path = fileUrl; // 更新结果对象使用远程URL
                console.log(`任务 ${taskId} 文件已上传到Supabase: ${fileUrl}`);
            } else {
                console.warn(`任务 ${taskId} 文件上传到Supabase失败，将使用本地路径: ${uploadResult.error}`);
            }
        } catch (uploadError) {
            console.error(`上传文件到Supabase失败: ${uploadError.message}`);
            // 继续使用本地路径，不中断流程
        }
        
        // 使用事务或重试机制确保任务状态更新成功
        let updateSuccess = false;
        let updateAttempts = 0;
        const maxUpdateAttempts = 3;
        
        while (!updateSuccess && updateAttempts < maxUpdateAttempts) {
            try {
                updateAttempts++;
                // 更新任务状态为已完成，保存结果对象
                const updateResult = await supabaseClient.updateTaskStatus(taskId, 'completed', {
                    result: resultObject
                });
                
                if (updateResult.success) {
                    updateSuccess = true;
                    console.log(`任务 ${taskId} 状态更新成功, 结果已保存到数据库`);
                } else {
                    console.warn(`任务 ${taskId} 状态更新失败（尝试 ${updateAttempts}/${maxUpdateAttempts}）: ${updateResult.error}`);
                    await new Promise(resolve => setTimeout(resolve, 1000)); // 等待1秒后重试
                }
            } catch (updateError) {
                console.error(`更新任务状态出错（尝试 ${updateAttempts}/${maxUpdateAttempts}）: ${updateError.message}`);
                await new Promise(resolve => setTimeout(resolve, 1000)); // 等待1秒后重试
            }
        }
        
        if (!updateSuccess) {
            console.error(`无法更新任务 ${taskId} 状态，已达到最大重试次数`);
        }
        
        console.log(`任务 ${taskId} 处理完成`);
        return {
            success: true,
            taskId,
            outputFileName,
            fileUrl: fileUrl || `/download/${outputFileName}`
        };
    } catch (error) {
        console.error(`处理任务 ${taskId} 失败:`, error);
        
        // 使用事务或重试机制确保错误状态更新成功
        let updateSuccess = false;
        let updateAttempts = 0;
        const maxUpdateAttempts = 3;
        
        while (!updateSuccess && updateAttempts < maxUpdateAttempts) {
            try {
                updateAttempts++;
                // 更新任务状态为失败
                const updateResult = await supabaseClient.updateTaskStatus(taskId, 'failed', {
                    error: error.message
                });
                
                if (updateResult.success) {
                    updateSuccess = true;
                } else {
                    console.warn(`更新失败状态失败（尝试 ${updateAttempts}/${maxUpdateAttempts}）: ${updateResult.error}`);
                    await new Promise(resolve => setTimeout(resolve, 1000)); // 等待1秒后重试
                }
            } catch (updateError) {
                console.error(`更新失败状态出错（尝试 ${updateAttempts}/${maxUpdateAttempts}）: ${updateError.message}`);
                await new Promise(resolve => setTimeout(resolve, 1000)); // 等待1秒后重试
            }
        }
        
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * 启动任务处理器
 * 定期检查并处理队列中的任务
 */
function startTaskProcessor() {
    // 清理过期任务
    cleanupExpiredTasks();
    
    // 每10秒检查一次队列
    setInterval(async () => {
        try {
            // 获取待处理任务
            const { data, error } = await supabaseClient.supabase
                .from('tasks')
                .select('*')
                .eq('status', 'pending')
                .order('created_at', { ascending: true })
                .limit(1);
                
            if (error) {
                console.error('获取待处理任务失败:', error);
                return;
            }
            
            if (data && data.length > 0) {
                const task = data[0];
                console.log(`发现待处理任务: ${task.id}, 类型: ${task.data.taskType || '美化'}`);
                
                // 根据任务类型处理
                if (task.data.taskType === 'colorize') {
                    // 处理上色任务
                    // 未来可以添加其他任务处理器
                } else {
                    // 默认处理美化任务
                    processBeautifyTask(task.id);
                }
            }
        } catch (error) {
            console.error('任务处理器执行失败:', error);
        }
    }, 10000); // 每10秒检查一次
    
    // 每小时执行一次过期任务清理
    setInterval(cleanupExpiredTasks, 60 * 60 * 1000);
    
    console.log('任务处理器已启动');
}

/**
 * 清理过期任务
 */
async function cleanupExpiredTasks() {
    try {
        const result = await supabaseClient.cleanupExpiredTasks();
        if (result.success && result.deletedCount > 0) {
            console.log(`已清理 ${result.deletedCount} 个过期任务`);
        }
    } catch (error) {
        console.error('清理过期任务失败:', error);
    }
}

module.exports = {
    processBeautifyTask,
    startTaskProcessor,
    setApiConfig
}; 