/**
 * Supabase 客户端配置
 * 用于连接 Supabase 服务并处理文件存储
 */

const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');
const path = require('path');

// 从环境变量获取 Supabase 配置
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || supabaseKey;

// 记录环境变量配置，帮助调试（注意隐藏密钥部分）
console.log('Supabase配置状态:');
console.log(`- URL: ${supabaseUrl ? '已配置' : '未配置'}`);
console.log(`- 匿名密钥: ${supabaseKey ? '已配置(' + supabaseKey.substring(0, 5) + '...' + supabaseKey.substring(supabaseKey.length-5) + ')' : '未配置'}`);
console.log(`- 服务密钥: ${supabaseServiceKey !== supabaseKey ? '已配置(独立)' : '使用匿名密钥'}`);

// 创建 Supabase 客户端 - 使用服务角色密钥以获取更高权限
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
        persistSession: false,
        autoRefreshToken: false,
    },
});

// 验证Supabase客户端是否成功创建
if (!supabase) {
    console.error('❌ Supabase客户端创建失败! 请检查环境变量配置。');
} else {
    console.log('✓ Supabase客户端创建成功');
}

/**
 * 清理文件路径，确保它是有效的 Supabase 存储键
 * @param {string} filePath - 原始文件路径
 * @returns {string} - 清理后的文件路径
 */
function sanitizeFilePath(filePath) {
    // 分离文件路径和扩展名
    const extname = path.extname(filePath);
    const basename = path.basename(filePath, extname);
    const dirname = path.dirname(filePath);
    
    // 生成 MD5 哈希作为文件名
    const hash = crypto.createHash('md5').update(basename).digest('hex');
    
    // 重建文件路径，只使用哈希作为文件名
    const sanitizedBasename = hash.substring(0, 20); // 使用部分哈希值
    const sanitizedFilePath = path.join(dirname, sanitizedBasename + extname);
    
    // 确保路径分隔符是正斜杠（/），因为Supabase要求这样
    return sanitizedFilePath.replace(/\\/g, '/');
}

/**
 * 上传文件到 Supabase Storage
 * @param {Buffer} fileBuffer - 文件数据
 * @param {string} filePath - 存储路径，包括文件名
 * @param {string} bucket - 存储桶名称
 * @returns {Promise<Object>} - 上传结果
 */
async function uploadFile(fileBuffer, filePath, bucket = 'uploads') {
    try {
        if (!fileBuffer) {
            throw new Error('文件数据为空，无法上传');
        }
        
        // 日志文件大小
        console.log(`上传文件 ${filePath} 大小: ${fileBuffer.length} 字节`);
        
        // 检查是否超过Supabase的文件大小限制 (默认50MB)
        const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
        if (fileBuffer.length > MAX_FILE_SIZE) {
            console.error(`文件过大: ${(fileBuffer.length/1024/1024).toFixed(2)}MB 超过Supabase限制 (50MB)`);
            return {
                success: false,
                error: `文件过大: ${(fileBuffer.length/1024/1024).toFixed(2)}MB 超过限制 (50MB)`,
                details: '请减小文件大小或使用外部存储服务'
            };
        }
        
        // 对文件路径进行清理
        const sanitizedFilePath = sanitizeFilePath(filePath);
        console.log('原始文件路径:', filePath);
        console.log('清理后的文件路径:', sanitizedFilePath);
        
        // 检查sanitizedFilePath的有效性
        if (!sanitizedFilePath || sanitizedFilePath.length < 5) {
            throw new Error('生成的文件路径无效: ' + sanitizedFilePath);
        }
        
        const options = {
            contentType: 'application/octet-stream',
            upsert: true,
            cacheControl: '3600'
        };
        
        console.log(`尝试上传文件到 ${bucket}/${sanitizedFilePath}`);
        
        // 确保bucket存在
        try {
            const { data: bucketData, error: bucketError } = await supabase.storage.getBucket(bucket);
            if (bucketError) {
                console.warn(`获取存储桶 ${bucket} 信息失败:`, bucketError);
                console.log('将尝试继续上传，但可能存在权限问题');
            } else {
                console.log(`存储桶 ${bucket} 存在，继续上传`);
            }
        } catch (bucketCheckError) {
            console.warn(`检查存储桶 ${bucket} 时出错:`, bucketCheckError);
        }
        
        // 添加超时控制
        const uploadPromise = supabase.storage
            .from(bucket)
            .upload(sanitizedFilePath, fileBuffer, options);
            
        // 设置超时
        const timeout = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('上传超时，请重试')), 60000)); // 60秒超时
            
        // 使用Promise.race来实现超时控制
        const { data, error } = await Promise.race([uploadPromise, timeout]);

        if (error) {
            console.error('Supabase Storage 上传错误:', error);
            console.error('错误代码:', error.code);
            console.error('错误消息:', error.message);
            console.error('错误详情:', JSON.stringify(error));
            
            if (error.message && error.message.includes('row-level security policy')) {
                console.error('权限错误: 这可能是由于Supabase的行级安全策略设置导致的。请检查存储桶权限或使用服务角色密钥。');
            }
            
            if (error.statusCode === 413 || (error.message && error.message.includes('too large'))) {
                console.error('文件大小超过限制。Supabase免费计划限制为50MB。');
            }
            
            throw error;
        }

        // 获取文件公共URL
        const { data: urlData } = supabase.storage
            .from(bucket)
            .getPublicUrl(sanitizedFilePath);

        console.log(`✓ 文件成功上传到 ${bucket}/${sanitizedFilePath}`);
        console.log(`✓ 公共URL: ${urlData.publicUrl}`);
        
        return {
            success: true,
            path: sanitizedFilePath,
            originalPath: filePath,
            url: urlData.publicUrl,
            data: data
        };
    } catch (error) {
        console.error('上传文件到 Supabase 失败:', error);
        console.error('错误堆栈:', error.stack);
        
        // 尝试更详细的错误信息
        let errorDetails = error.message;
        try {
            if (error.error) errorDetails += ` | API错误: ${JSON.stringify(error.error)}`;
            if (error.status) errorDetails += ` | 状态码: ${error.status}`;
        } catch (e) {
            // 忽略序列化错误
        }
        
        return {
            success: false,
            error: error.message,
            details: errorDetails
        };
    }
}

/**
 * 从 Supabase Storage 获取文件
 * @param {string} filePath - 文件路径
 * @param {string} bucket - 存储桶名称
 * @returns {Promise<Object>} - 下载结果
 */
async function getFile(filePath, bucket = 'uploads') {
    try {
        const { data, error } = await supabase.storage
            .from(bucket)
            .download(filePath);

        if (error) {
            console.error('Supabase Storage 下载错误:', error);
            throw error;
        }

        return {
            success: true,
            data: data,
            blob: new Blob([data]),
        };
    } catch (error) {
        console.error('从 Supabase 获取文件失败:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * 获取文件公共URL
 * @param {string} filePath - 文件路径
 * @param {string} bucket - 存储桶名称
 * @returns {string} - 公共URL
 */
function getPublicUrl(filePath, bucket = 'uploads') {
    const { data } = supabase.storage
        .from(bucket)
        .getPublicUrl(filePath);
    
    return data.publicUrl;
}

/**
 * 列出存储桶中的文件
 * @param {string} folder - 文件夹路径
 * @param {string} bucket - 存储桶名称
 * @returns {Promise<Object>} - 文件列表
 */
async function listFiles(folder = '', bucket = 'uploads') {
    try {
        const { data, error } = await supabase.storage
            .from(bucket)
            .list(folder);

        if (error) {
            console.error('Supabase Storage 列表错误:', error);
            throw error;
        }

        return {
            success: true,
            files: data
        };
    } catch (error) {
        console.error('列出 Supabase 文件失败:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * 删除 Supabase Storage 中的文件
 * @param {string} filePath - 文件路径
 * @param {string} bucket - 存储桶名称
 * @returns {Promise<Object>} - 删除结果
 */
async function deleteFile(filePath, bucket = 'uploads') {
    try {
        const { error } = await supabase.storage
            .from(bucket)
            .remove([filePath]);

        if (error) {
            console.error('Supabase Storage 删除错误:', error);
            throw error;
        }

        return {
            success: true
        };
    } catch (error) {
        console.error('删除 Supabase 文件失败:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * 创建异步处理任务
 * @param {Object} taskData - 任务数据
 * @returns {Promise<Object>} - 创建结果
 */
async function createTask(taskData) {
    try {
        // 生成任务ID
        const taskId = crypto.randomUUID();
        
        // 设置任务数据
        const task = {
            id: taskId,
            status: 'pending', // pending, processing, completed, failed
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            data: taskData,
            result: null,
            error: null,
            expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24小时后过期
        };
        
        // 插入任务到Supabase
        const { data, error } = await supabase
            .from('tasks')
            .insert([task])
            .select();
            
        if (error) {
            console.error('创建任务失败:', error);
            throw error;
        }
        
        console.log(`创建任务成功, ID: ${taskId}`);
        return {
            success: true,
            taskId: taskId,
            task: data[0]
        };
    } catch (error) {
        console.error('创建任务失败:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * 更新任务状态
 * @param {string} taskId - 任务ID
 * @param {string} status - 新状态
 * @param {Object} data - 更新数据
 * @returns {Promise<Object>} - 更新结果
 */
async function updateTaskStatus(taskId, status, data = {}) {
    try {
        console.log(`开始更新任务 ${taskId} 状态为 ${status}`);
        
        // 准备更新数据
        const updateData = {
            status,
            updated_at: new Date().toISOString(),
        };
        
        // 结果数据需要特殊处理，确保JSON格式正确
        if (data.result) {
            try {
                // 检查result对象是否可以正确序列化
                const resultStr = JSON.stringify(data.result);
                updateData.result = data.result;
                console.log(`任务 ${taskId} 结果数据大小: ${resultStr.length} 字节`);
                
                // 检查数据大小是否超过Supabase限制(1MB)
                if (resultStr.length > 1024 * 1024) {
                    console.warn(`结果数据过大 (${(resultStr.length/1024/1024).toFixed(2)}MB)，将自动截断`);
                    // 预先处理，避免后续失败
                    if (data.result.html && typeof data.result.html === 'string') {
                        // 截断HTML内容
                        data.result.html = data.result.html.substring(0, 1000) + '... [内容过长已截断]';
                        updateData.result = data.result;
                    }
                }
            } catch (jsonError) {
                console.error(`任务 ${taskId} 结果数据无法序列化:`, jsonError);
                
                // 尝试创建可序列化的简化版本
                const safeResult = {
                    path: data.result.path || null,
                    outputFileName: data.result.outputFileName || null,
                    type: data.result.type || null,
                    originalname: data.result.originalname || null,
                    wasBackupMode: data.result.wasBackupMode || false,
                    completedAt: data.result.completedAt || new Date().toISOString(),
                    // 添加一个标志，表示这是简化版
                    isSimplified: true,
                    error: jsonError.message
                };
                
                updateData.result = safeResult;
                console.log(`任务 ${taskId} 使用简化的结果数据`);
            }
        }
        
        // 错误数据
        if (data.error) {
            updateData.error = data.error;
            // 确保错误信息不会太长
            if (typeof updateData.error === 'string' && updateData.error.length > 1000) {
                updateData.error = updateData.error.substring(0, 1000) + '... [错误信息过长已截断]';
            }
        }
        
        // 记录更新的数据结构（不包含实际内容）
        console.log(`任务 ${taskId} 更新数据结构:`, Object.keys(updateData));
        
        // 执行更新
        const { error } = await supabase
            .from('tasks')
            .update(updateData)
            .eq('id', taskId);
            
        if (error) {
            console.error(`更新任务状态失败 (${taskId}):`, error);
            console.error(`错误详情:`, JSON.stringify(error));
            
            // 检查是否是数据太大导致的错误
            if (error.message && (
                error.message.includes('payload') || 
                error.message.includes('too large') || 
                error.message.includes('exceeded')
            )) {
                console.warn(`任务 ${taskId} 数据太大，尝试极度精简数据后重新更新`);
                
                // 极度精简数据
                const minimalData = {
                    status,
                    updated_at: new Date().toISOString(),
                };
                
                // 如果是completed状态，添加最小结果
                if (status === 'completed' && data.result) {
                    minimalData.result = {
                        path: data.result.path || null,
                        outputFileName: data.result.outputFileName || null,
                        isExtremelySimplifed: true
                    };
                }
                
                // 如果是失败状态，添加最小错误信息
                if (status === 'failed' && data.error) {
                    minimalData.error = typeof data.error === 'string' 
                        ? data.error.substring(0, 500) 
                        : '任务失败 (详细信息过大)';
                }
                
                // 重新尝试更新
                const retryResult = await supabase
                    .from('tasks')
                    .update(minimalData)
                    .eq('id', taskId);
                    
                if (retryResult.error) {
                    console.error(`极度精简数据后更新仍失败 (${taskId}):`, retryResult.error);
                    throw new Error(`更新失败，即使极度精简数据后: ${retryResult.error.message}`);
                } else {
                    console.log(`任务 ${taskId} 使用极度精简数据更新成功`);
                    return { success: true, wasSimplified: true };
                }
            }
            
            throw error;
        }
        
        console.log(`✓ 任务 ${taskId} 状态成功更新为 ${status}`);
        return {
            success: true
        };
    } catch (error) {
        console.error(`更新任务状态失败 (${taskId}):`, error);
        console.error('错误堆栈:', error.stack);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * 获取任务信息
 * @param {string} taskId - 任务ID
 * @returns {Promise<Object>} - 任务信息
 */
async function getTask(taskId) {
    try {
        const { data, error } = await supabase
            .from('tasks')
            .select('*')
            .eq('id', taskId)
            .single();
            
        if (error) {
            console.error(`获取任务失败 (${taskId}):`, error);
            throw error;
        }
        
        return {
            success: true,
            task: data
        };
    } catch (error) {
        console.error(`获取任务失败 (${taskId}):`, error);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * 清理过期任务
 * @returns {Promise<Object>} - 清理结果
 */
async function cleanupExpiredTasks() {
    try {
        console.log('开始清理过期任务...');
        
        // 添加超时和重试机制
        const MAX_RETRIES = 3;
        let retries = 0;
        let success = false;
        let cleanedCount = 0;
        
        while (!success && retries < MAX_RETRIES) {
            try {
                retries++;
                console.log(`尝试清理过期任务 (尝试 ${retries}/${MAX_RETRIES})...`);
                
                // 使用指数退避策略
                if (retries > 1) {
                    const waitTime = Math.pow(2, retries - 1) * 1000;
                    console.log(`等待 ${waitTime}ms 后重试...`);
                    await new Promise(resolve => setTimeout(resolve, waitTime));
                }
                
                // 实际的清理逻辑
                const { data, error } = await supabase
                    .from('tasks')
                    .delete()
                    .lt('expires_at', new Date().toISOString())
                    .select();
                    
                if (error) {
                    console.error(`清理过期任务失败 (尝试 ${retries}/${MAX_RETRIES}):`, error);
                    throw error;
                }
                
                cleanedCount = data?.length || 0;
                success = true;
                console.log(`成功清理了 ${cleanedCount} 个过期任务`);
            } catch (retryError) {
                console.warn(`清理过期任务失败 (尝试 ${retries}/${MAX_RETRIES}): ${retryError.message}`);
                if (retryError.message && retryError.message.includes('fetch failed')) {
                    console.warn('检测到网络连接问题，将在下次尝试重试');
                }
                // 如果已经达到最大重试次数，则跳出循环
                if (retries >= MAX_RETRIES) {
                    console.error(`已达到最大重试次数(${MAX_RETRIES})，清理任务失败`);
                }
            }
        }
        
        return { 
            success, 
            cleanedCount
        };
    } catch (error) {
        console.error('清理过期任务失败:', {
            message: error.message,
            details: error.stack,
            hint: '请检查Supabase连接和权限',
            code: error.code || ''
        });
        
        // 返回明确的结果对象
        return { 
            success: false, 
            cleanedCount: 0,
            error: error.message
        };
    }
}

module.exports = {
    supabase,
    uploadFile,
    getFile,
    getPublicUrl,
    listFiles,
    deleteFile,
    createTask,
    updateTaskStatus,
    getTask,
    cleanupExpiredTasks
}; 