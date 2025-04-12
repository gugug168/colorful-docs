/**
 * Supabase 客户端配置
 * 用于连接 Supabase 服务并处理文件存储
 */

const { createClient } = require('@supabase/supabase-js');

// 从环境变量获取 Supabase 配置
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

// 创建 Supabase 客户端
const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * 上传文件到 Supabase Storage
 * @param {Buffer} fileBuffer - 文件数据
 * @param {string} filePath - 存储路径，包括文件名
 * @param {string} bucket - 存储桶名称
 * @returns {Promise<Object>} - 上传结果
 */
async function uploadFile(fileBuffer, filePath, bucket = 'uploads') {
    try {
        const { data, error } = await supabase.storage
            .from(bucket)
            .upload(filePath, fileBuffer, {
                contentType: 'application/octet-stream',
                upsert: true
            });

        if (error) {
            console.error('Supabase Storage 上传错误:', error);
            throw error;
        }

        // 获取文件公共URL
        const { data: urlData } = supabase.storage
            .from(bucket)
            .getPublicUrl(filePath);

        return {
            success: true,
            path: filePath,
            url: urlData.publicUrl,
            data: data
        };
    } catch (error) {
        console.error('上传文件到 Supabase 失败:', error);
        return {
            success: false,
            error: error.message
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

module.exports = {
    supabase,
    uploadFile,
    getFile,
    getPublicUrl,
    listFiles,
    deleteFile
}; 