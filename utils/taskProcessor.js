/**
 * 任务处理器
 * 用于处理异步任务队列
 */

const supabaseClient = require('./supabaseClient');
const aiOptimizer = require('./aiOptimizer');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { processHtmlWithAI } = require('./aiOptimizer');
const { 
    uploadFile, 
    updateTaskStatus, 
    getTask,
    cleanupExpiredTasks
} = require('./supabaseClient');
const { saveOutputFile } = require('./fileManager');
const { htmlBeautify } = require('./htmlUtils');

// 全局API配置 - 应从app.js中导入或通过环境变量设置
let globalApiConfig = {
    apiKey: process.env.DEEPSEEK_API_KEY || '',
    apiType: 'deepseek',
    apiParams: {
        deepseek: { temperature: 0.7, max_tokens: 8000 }
    }
};

// 记录API配置状态（隐藏敏感信息）
console.log('API配置状态:');
console.log(`- API类型: ${globalApiConfig.apiType}`);
console.log(`- OpenAI API: ${globalApiConfig.apiKey ? '已配置' : '未配置'}`);
console.log(`- Azure API: ${globalApiConfig.azureApiKey ? '已配置' : '未配置'}`);
console.log(`- Azure Endpoint: ${globalApiConfig.azureEndpoint ? '已配置' : '未配置'}`);
console.log(`- Azure 部署名称: ${globalApiConfig.azureDeploymentName ? '已配置' : '未配置'}`);
console.log(`- Anthropic API: ${globalApiConfig.anthropicApiKey ? '已配置' : '未配置'}`);
console.log(`- Gemini API: ${globalApiConfig.geminiApiKey ? '已配置' : '未配置'}`);

/**
 * 设置全局API配置
 * @param {Object} config - API配置
 */
function setApiConfig(config) {
    // 保存以前的配置用于日志
    const previousConfig = { ...globalApiConfig };
    
    if (config.apiType) globalApiConfig.apiType = config.apiType;
    if (config.apiKey) globalApiConfig.apiKey = config.apiKey;
    if (config.azureApiKey) globalApiConfig.azureApiKey = config.azureApiKey;
    if (config.azureEndpoint) globalApiConfig.azureEndpoint = config.azureEndpoint;
    if (config.azureDeploymentName) globalApiConfig.azureDeploymentName = config.azureDeploymentName;
    if (config.anthropicApiKey) globalApiConfig.anthropicApiKey = config.anthropicApiKey;
    if (config.geminiApiKey) globalApiConfig.geminiApiKey = config.geminiApiKey;
    
    // 记录配置变更（不显示实际密钥）
    console.log('API配置已更新:');
    if (previousConfig.apiType !== globalApiConfig.apiType) {
        console.log(`- API类型: ${previousConfig.apiType} -> ${globalApiConfig.apiType}`);
    }
    if (previousConfig.apiKey !== globalApiConfig.apiKey) {
        console.log('- OpenAI API密钥已更新');
    }
    if (previousConfig.azureApiKey !== globalApiConfig.azureApiKey) {
        console.log('- Azure API密钥已更新');
    }
    if (previousConfig.azureEndpoint !== globalApiConfig.azureEndpoint) {
        console.log('- Azure Endpoint已更新');
    }
    if (previousConfig.azureDeploymentName !== globalApiConfig.azureDeploymentName) {
        console.log('- Azure部署名称已更新');
    }
    if (previousConfig.anthropicApiKey !== globalApiConfig.anthropicApiKey) {
        console.log('- Anthropic API密钥已更新');
    }
    if (previousConfig.geminiApiKey !== globalApiConfig.geminiApiKey) {
        console.log('- Gemini API密钥已更新');
    }
}

// 添加sanitizeFileName函数用于生成短文件名
function sanitizeFileName(fileName, ts) {
    const timestamp = ts || Date.now();
    // 获取文件扩展名
    const extname = path.extname(fileName) || '.tmp';
    
    // 生成短文件名 - 使用时间戳和哈希
    return `doc-${timestamp}-${crypto.createHash('md5').update(fileName).digest('hex').substring(0, 10)}${extname}`;
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
        
        // 更详细地记录任务数据，排除HTML内容
        const { filename, targetFormat, customRequirements, colorizedImages } = task.data;
        console.log(`任务 ${taskId} 详情: 文件名="${filename || '未指定'}", 目标格式="${targetFormat || 'auto'}", 自定义需求="${customRequirements || '无'}"`);
        console.log(`任务 ${taskId} 包含${colorizedImages?.length || 0}张上色图片`);
        
        // 检查HTML内容是否有效
        if (!task.data.htmlContent) {
            console.error(`任务 ${taskId} 缺少HTML内容`);
            await supabaseClient.updateTaskStatus(taskId, 'failed', {
                error: 'HTML内容为空，无法处理任务'
            });
            return {
                success: false,
                error: 'HTML内容为空，无法处理任务'
            };
        }
        
        const htmlContent = task.data.htmlContent;
        console.log(`任务 ${taskId} 的HTML内容长度: ${htmlContent.length}`);
        
        // 设置超时机制 - 5分钟后自动标记为失败
        const timeoutId = setTimeout(async () => {
            console.log(`任务 ${taskId} 执行超时，标记为失败`);
            await supabaseClient.updateTaskStatus(taskId, 'failed', {
                error: '任务执行超时，已自动终止'
            });
        }, 5 * 60 * 1000); // 5分钟
        
        // 生成优化提示
        const optimizationPrompt = aiOptimizer.generateOptimizationPrompt(targetFormat, customRequirements);
        console.log(`任务 ${taskId} 的优化提示: "${optimizationPrompt.substring(0, 100)}${optimizationPrompt.length > 100 ? '...' : ''}"`);
        
        // 根据当前配置选择AI服务
        const aiProvider = globalApiConfig.apiType.toLowerCase();
        console.log(`使用AI提供商: ${aiProvider} 处理任务 ${taskId}`);
        
        let optimizedHTML;
        let usedBackupMode = false;
        
        try {
            // 记录API配置状态
            console.log(`任务 ${taskId} 的API配置检查:`);
            
            // 确保API密钥有效
            const apiKey = globalApiConfig.apiKey;
            if (!apiKey || typeof apiKey !== 'string' || apiKey.trim() === '' || apiKey.length < 10) {
                console.warn(`任务 ${taskId} 的API密钥无效或未提供，详情: 类型=${typeof apiKey}, 长度=${apiKey ? apiKey.length : 0}`);
                throw new Error('API密钥无效或未提供');
            } else {
                // 隐藏显示API密钥
                console.log(`任务 ${taskId} 使用有效的API密钥: ${apiKey.substring(0, 3)}...${apiKey.substring(apiKey.length - 3)}`);
            }
            
            // 参数检查与日志
            const apiParams = aiProvider === 'deepseek' 
                ? (globalApiConfig.apiParams?.deepseek || { temperature: 0.7, max_tokens: 8000 })
                : (globalApiConfig.apiParams?.baidu || { temperature: 0.7, max_tokens: 4000 });
                
            console.log(`任务 ${taskId} 的API参数: ${JSON.stringify(apiParams)}`);
            
            if (aiProvider === 'deepseek') {
                // 使用DeepSeek处理HTML
                console.log(`任务 ${taskId} 开始使用DeepSeek处理，HTML长度=${htmlContent.length}`);
                try {
                    optimizedHTML = await aiOptimizer.processWithDeepseek(
                        htmlContent,
                        optimizationPrompt,
                        apiKey,
                        apiParams
                    );
                    
                    if (!optimizedHTML) {
                        console.error(`任务 ${taskId} DeepSeek返回了空内容`);
                        throw new Error('DeepSeek API返回了空内容');
                    }
                    
                    console.log(`任务 ${taskId} DeepSeek处理成功，结果长度=${optimizedHTML.length}`);
                } catch (deepseekError) {
                    console.error(`任务 ${taskId} DeepSeek处理失败:`, deepseekError);
                    // 详细记录DeepSeek错误
                    console.error(`任务 ${taskId} DeepSeek错误详情: 类型=${deepseekError.constructor.name}, 消息="${deepseekError.message}", 堆栈=${deepseekError.stack}`);
                    throw deepseekError; // 重新抛出以便上层处理
                }
            } else if (aiProvider === 'baidu') {
                // 使用百度文心处理HTML
                console.log(`任务 ${taskId} 开始使用百度文心处理，HTML长度=${htmlContent.length}`);
                try {
                    optimizedHTML = await aiOptimizer.beautifyWithBaidu(
                        htmlContent,
                        optimizationPrompt,
                        apiKey,
                        globalApiConfig.apiSecret,
                        apiParams
                    );
                    
                    if (!optimizedHTML) {
                        console.error(`任务 ${taskId} 百度文心返回了空内容`);
                        throw new Error('百度文心API返回了空内容');
                    }
                    
                    console.log(`任务 ${taskId} 百度文心处理成功，结果长度=${optimizedHTML.length}`);
                } catch (baiduError) {
                    console.error(`任务 ${taskId} 百度文心处理失败:`, baiduError);
                    console.error(`任务 ${taskId} 百度文心错误详情: 类型=${baiduError.constructor.name}, 消息="${baiduError.message}", 堆栈=${baiduError.stack}`);
                    throw baiduError; // 重新抛出以便上层处理
                }
            } else {
                // 默认使用DeepSeek
                console.log(`不支持的AI提供商: ${aiProvider}，改用DeepSeek处理任务 ${taskId}`);
                try {
                    optimizedHTML = await aiOptimizer.processWithDeepseek(
                        htmlContent,
                        optimizationPrompt,
                        apiKey,
                        globalApiConfig.apiParams.deepseek
                    );
                    
                    if (!optimizedHTML) {
                        console.error(`任务 ${taskId} DeepSeek返回了空内容`);
                        throw new Error('DeepSeek API返回了空内容');
                    }
                    
                    console.log(`任务 ${taskId} DeepSeek处理成功，结果长度=${optimizedHTML.length}`);
                } catch (deepseekError) {
                    console.error(`任务 ${taskId} DeepSeek处理失败:`, deepseekError);
                    console.error(`任务 ${taskId} DeepSeek错误详情: 类型=${deepseekError.constructor.name}, 消息="${deepseekError.message}", 堆栈=${deepseekError.stack}`);
                    throw deepseekError; // 重新抛出以便上层处理
                }
            }
            
            if (!optimizedHTML) {
                throw new Error('AI处理返回了空内容');
            }
            
        } catch (aiError) {
            console.error(`任务 ${taskId} AI处理失败:`, aiError);
            console.error(`任务 ${taskId} AI错误堆栈:`, aiError.stack);
            
            // 不再尝试备用美化功能，而是直接将任务标记为失败
            clearTimeout(timeoutId);
            await supabaseClient.updateTaskStatus(taskId, 'failed', {
                error: `AI处理失败: ${aiError.message}`
            });
            return {
                success: false,
                error: `AI处理失败: ${aiError.message}`
            };
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
        
        // 生成唯一文件名 - 使用sanitizeFileName生成短文件名
        const safeFilename = sanitizeFileName(filename || 'beautified', timestamp);
        const outputFileName = `beautified-${taskId}-${safeFilename}`;
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
            completedAt: new Date().toISOString(),
            taskType: 'beautify' // 添加明确的任务类型
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
 * 处理AI优化任务
 * @param {Object} task - 任务对象
 * @returns {Promise<Object>} - 处理结果
 */
async function processAiOptimizationTask(task) {
    let isCompleted = false;
    const timeoutId = setTimeout(() => {
        if (!isCompleted) {
            console.error(`AI优化任务 ${task.id} 执行超时`);
            updateTaskStatus(task.id, 'failed', {
                error: "任务执行超时，请稍后重试。AI处理大文件可能需要更长时间。"
            }).catch(e => console.error('更新超时状态失败:', e));
        }
    }, 600000); // 10分钟超时
    
    try {
        console.log(`开始处理AI优化任务 ${task.id}`);
        console.log(`任务类型: ${task.type}, 文件: ${task.filename || '未知'}`);
        
        // 检查任务必要字段
        if (!task.type) throw new Error("任务缺少类型字段");
        if (!task.id) throw new Error("任务缺少ID字段");
        
        // 更新任务状态为处理中
        await updateTaskStatus(task.id, 'processing');
        
        // 检查文件路径
        if (!task.filepath) {
            throw new Error("任务缺少文件路径");
        }
        
        // 读取文件内容
        console.log(`读取文件内容: ${task.filepath}`);
        
        if (!fs.existsSync(task.filepath)) {
            throw new Error(`文件不存在: ${task.filepath}`);
        }
        
        const fileContent = fs.readFileSync(task.filepath, 'utf8');
        
        // 文件大小检查
        const fileSizeKB = Buffer.byteLength(fileContent, 'utf8') / 1024;
        console.log(`文件大小: ${fileSizeKB.toFixed(2)} KB`);
        
        // 设置更合理的文件大小限制
        const MAX_SIZE_KB = 5000; // 5MB
        
        if (fileSizeKB > MAX_SIZE_KB) {
            throw new Error(`文件过大 (${fileSizeKB.toFixed(2)} KB)，超过处理限制 (${MAX_SIZE_KB} KB)`);
        }
        
        // 根据文件类型进行优化处理
        if (task.type === 'optimize_html') {
            console.log(`使用AI优化HTML文件: ${task.filename || path.basename(task.filepath)}`);
            
            // 确认HTML格式
            const htmlValidator = require('html-validator');
            let validationResult;
            try {
                // 使用简单验证，避免过长时间
                if (fileContent.trim().length > 0 && (
                    !fileContent.includes('<html') && 
                    !fileContent.includes('<body') && 
                    !fileContent.includes('<head')
                )) {
                    console.warn(`文件可能不是有效的HTML: ${task.filename}`);
                }
            } catch (validationError) {
                console.warn(`HTML验证失败 (非致命): ${validationError.message}`);
            }
            
            // 获取AI配置
            let aiConfig = {
                ...globalApiConfig,
                backupMode: false, // 默认不使用备用模式
                custom_instruction: task.custom_instruction || '',
                optimization_level: task.optimization_level || 'balanced'
            };
            
            // 如果主要API未配置，尝试使用备用API
            if (
                (aiConfig.apiType === 'openai' && !aiConfig.apiKey) ||
                (aiConfig.apiType === 'azure' && (!aiConfig.azureApiKey || !aiConfig.azureEndpoint)) ||
                (aiConfig.apiType === 'anthropic' && !aiConfig.anthropicApiKey) ||
                (aiConfig.apiType === 'gemini' && !aiConfig.geminiApiKey)
            ) {
                console.warn(`主要API (${aiConfig.apiType}) 未配置，尝试备用模式`);
                
                // 尝试查找可用的备用API
                if (aiConfig.apiKey) {
                    aiConfig.apiType = 'openai';
                    aiConfig.backupMode = true;
                } else if (aiConfig.azureApiKey && aiConfig.azureEndpoint) {
                    aiConfig.apiType = 'azure';
                    aiConfig.backupMode = true;
                } else if (aiConfig.anthropicApiKey) {
                    aiConfig.apiType = 'anthropic';
                    aiConfig.backupMode = true;
                } else if (aiConfig.geminiApiKey) {
                    aiConfig.apiType = 'gemini';
                    aiConfig.backupMode = true;
                } else {
                    throw new Error("所有API均未配置，无法处理AI任务");
                }
                
                console.log(`已切换到备用API: ${aiConfig.apiType}`);
            }
            
            // 使用AI处理HTML内容
            console.log(`开始AI优化，使用${aiConfig.apiType}模型处理...`);
            const aiResult = await processHtmlWithAI(
                fileContent, 
                aiConfig, 
                task.optimization_level || 'balanced'
            );
            
            if (!aiResult.success) {
                throw new Error(`AI处理失败: ${aiResult.error}`);
            }
            
            // 生成输出文件名
            const originalFileName = task.filename || path.basename(task.filepath);
            const outputFileName = `optimized_${originalFileName}`;
            const outputPath = path.join(path.dirname(task.filepath), outputFileName);
            
            // 保存优化后的文件
            console.log(`保存AI优化后的HTML到: ${outputPath}`);
            saveOutputFile(outputPath, aiResult.optimizedHtml);
            
            // 上传到存储
            const uploadPath = `results/${task.id}/${outputFileName}`;
            console.log(`上传结果文件到: ${uploadPath}`);
            const uploadResult = await uploadFile(Buffer.from(aiResult.optimizedHtml), uploadPath);
            
            if (!uploadResult.success) {
                throw new Error(`上传结果失败: ${uploadResult.error}`);
            }
            
            // 标记任务完成
            isCompleted = true;
            clearTimeout(timeoutId);
            
            console.log(`AI优化任务 ${task.id} 完成，更新状态`);
            // 更新任务状态为已完成
            await updateTaskStatus(task.id, 'completed', {
                result: {
                    path: uploadResult.url,
                    outputFileName,
                    html: aiResult.optimizedHtml.slice(0, 1000) + (aiResult.optimizedHtml.length > 1000 ? '...' : ''), // 只保存部分HTML用于预览
                    originalname: originalFileName,
                    wasBackupMode: aiConfig.backupMode,
                    type: task.type,
                    usedModel: aiResult.usedModel || aiConfig.apiType,
                    completedAt: new Date().toISOString()
                }
            });
            
            return {
                success: true,
                path: uploadResult.url,
                message: 'HTML已成功通过AI优化'
            };
        } else {
            throw new Error(`不支持的任务类型: ${task.type}`);
        }
    } catch (error) {
        console.error(`处理AI任务失败 (${task.id}):`, error);
        console.error('错误堆栈:', error.stack);
        
        // 尝试获取更详细的错误信息
        let detailedError = error.message;
        try {
            if (error.code) detailedError += ` (代码: ${error.code})`;
            if (error.response && error.response.data) {
                detailedError += ` - API错误: ${JSON.stringify(error.response.data)}`;
            }
        } catch (e) {
            // 忽略序列化错误
        }
        
        // 更新任务状态为失败
        try {
            isCompleted = true;
            clearTimeout(timeoutId);
            
            await updateTaskStatus(task.id, 'failed', {
                error: detailedError
            });
        } catch (updateError) {
            console.error(`更新任务状态失败 (${task.id}):`, updateError);
        }
        
        return {
            success: false,
            error: detailedError
        };
    } finally {
        // 确保超时被清除
        if (timeoutId) clearTimeout(timeoutId);
        
        // 清理临时文件（如果需要）
        try {
            // 添加清理逻辑
            console.log(`任务 ${task.id} 处理完成，执行清理工作`);
        } catch (cleanupError) {
            console.error('清理临时文件失败:', cleanupError);
        }
    }
}

/**
 * 处理任务，根据任务类型调用不同的处理函数
 * @param {string} taskId - 任务ID
 * @returns {Promise<Object>} - 处理结果
 */
async function processTask(taskId) {
    try {
        console.log(`开始获取任务 ${taskId} 详情`);
        const task = await getTask(taskId);
        
        if (!task) {
            console.error(`任务 ${taskId} 不存在`);
            return {
                success: false,
                error: '任务不存在'
            };
        }
        
        console.log(`任务信息: ID=${task.id}, 类型=${task.type}, 状态=${task.status}`);
        
        // 检查任务状态，避免重复处理
        if (task.status === 'completed') {
            console.log(`任务 ${taskId} 已完成，无需再次处理`);
            return {
                success: true,
                message: '任务已完成'
            };
        }
        
        if (task.status === 'failed') {
            console.log(`任务 ${taskId} 之前已失败，将重新尝试处理`);
        }
        
        if (task.status === 'processing') {
            console.log(`任务 ${taskId} 正在处理中，检查是否超时...`);
            
            // 检查任务是否已经处理时间过长（超过15分钟）
            const updatedAt = new Date(task.updated_at);
            const now = new Date();
            const diffMinutes = (now - updatedAt) / (1000 * 60);
            
            if (diffMinutes < 15) {
                console.log(`任务 ${taskId} 处理中 (${diffMinutes.toFixed(2)}分钟)，未超时`);
                return {
                    success: false,
                    error: '任务正在处理中'
                };
            } else {
                console.warn(`任务 ${taskId} 处理超时 (${diffMinutes.toFixed(2)}分钟)，将重新尝试`);
            }
        }
        
        // 检查并设置默认任务类型
        if (!task.type) {
            console.warn(`任务 ${taskId} 未指定类型，从data属性中查找...`);
            
            // 尝试从data属性中获取任务类型
            if (task.data && task.data.taskType) {
                task.type = task.data.taskType === 'beautify' ? 'beautify_html' : task.data.taskType;
                console.log(`从data属性中找到任务类型: ${task.type}`);
            } else {
                // 设置默认任务类型
                task.type = 'beautify_html';
                console.warn(`未能找到任务类型，设置为默认类型: beautify_html`);
                
                // 尝试更新数据库中的任务类型
                try {
                    await updateTaskStatus(taskId, task.status, {
                        type: task.type
                    });
                    console.log(`已更新任务 ${taskId} 的类型为 ${task.type}`);
                } catch (updateError) {
                    console.error(`更新任务类型失败 (${taskId}):`, updateError);
                }
            }
        }
        
        // 根据任务类型调用不同的处理函数
        switch (task.type) {
            case 'beautify_html':
                return await processBeautifyTask(taskId);
            case 'optimize_html':
                return await processAiOptimizationTask(task);
            case 'beautify':  // 兼容beautify类型
                console.log(`兼容处理beautify类型任务 ${taskId}`);
                return await processBeautifyTask(taskId);
            default:
                throw new Error(`不支持的任务类型: ${task.type}`);
        }
    } catch (error) {
        console.error(`处理任务 ${taskId} 失败:`, error);
        console.error('错误堆栈:', error.stack);
        
        // 尝试更新任务状态为失败（如果可能）
        try {
            await updateTaskStatus(taskId, 'failed', {
                error: error.message
            });
        } catch (updateError) {
            console.error(`更新任务状态失败 (${taskId}):`, updateError);
        }
        
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * 定期清理过期任务
 * 每小时运行一次
 */
function setupTaskCleanup() {
    console.log('设置定期任务清理定时任务');
    
    // 立即清理一次
    cleanupExpiredTasks()
        .then(result => {
            console.log(`初始任务清理完成: ${result.cleanedCount} 个任务已清理`);
        })
        .catch(error => {
            console.error('初始任务清理失败:', error);
        });
    
    // 设置每小时清理一次
    const ONE_HOUR = 60 * 60 * 1000;
    setInterval(() => {
        console.log('执行定期任务清理...');
        cleanupExpiredTasks()
            .then(result => {
                console.log(`定期任务清理完成: ${result.cleanedCount} 个任务已清理`);
            })
            .catch(error => {
                console.error('定期任务清理失败:', error);
            });
    }, ONE_HOUR);
}

// 启动时设置定期清理
setupTaskCleanup();

module.exports = {
    processTask,
    setApiConfig,
    processBeautifyTask,
    processAiOptimizationTask
}; 