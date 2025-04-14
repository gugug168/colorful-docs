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

// 创建 Supabase 客户端 - 使用服务角色密钥以获取更高权限
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
        persistSession: false,
        autoRefreshToken: false,
    },
});

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
        // 对文件路径进行清理
        const sanitizedFilePath = sanitizeFilePath(filePath);
        console.log('原始文件路径:', filePath);
        console.log('清理后的文件路径:', sanitizedFilePath);
        
        const options = {
            contentType: 'application/octet-stream',
            upsert: true,
            cacheControl: '3600'
        };
        
        console.log(`尝试上传文件到 ${bucket}/${sanitizedFilePath}`);
        
        const { data, error } = await supabase.storage
            .from(bucket)
            .upload(sanitizedFilePath, fileBuffer, options);

        if (error) {
            console.error('Supabase Storage 上传错误:', error);
            if (error.message && error.message.includes('row-level security policy')) {
                console.error('权限错误: 这可能是由于Supabase的行级安全策略设置导致的。请检查存储桶权限或使用服务角色密钥。');
            }
            throw error;
        }

        // 获取文件公共URL
        const { data: urlData } = supabase.storage
            .from(bucket)
            .getPublicUrl(sanitizedFilePath);

        return {
            success: true,
            path: sanitizedFilePath,
            originalPath: filePath,
            url: urlData.publicUrl,
            data: data
        };
    } catch (error) {
        console.error('上传文件到 Supabase 失败:', error);
        return {
            success: false,
            error: error.message,
            details: JSON.stringify(error)
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
        const updateData = {
            status,
            updated_at: new Date().toISOString(),
            ...data
        };
        
        const { error } = await supabase
            .from('tasks')
            .update(updateData)
            .eq('id', taskId);
            
        if (error) {
            console.error(`更新任务状态失败 (${taskId}):`, error);
            throw error;
        }
        
        console.log(`任务 ${taskId} 状态更新为 ${status}`);
        return {
            success: true
        };
    } catch (error) {
        console.error(`更新任务状态失败 (${taskId}):`, error);
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
        const now = new Date().toISOString();
        
        const { data, error } = await supabase
            .from('tasks')
            .delete()
            .lt('expires_at', now)
            .select();
            
        if (error) {
            console.error('清理过期任务失败:', error);
            throw error;
        }
        
        console.log(`已清理 ${data?.length || 0} 个过期任务`);
        return {
            success: true,
            deletedCount: data?.length || 0
        };
    } catch (error) {
        console.error('清理过期任务失败:', error);
        return {
            success: false,
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