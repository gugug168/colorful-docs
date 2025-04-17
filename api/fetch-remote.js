/**
 * 远程内容获取API
 * 用于代理获取远程URL的内容，特别是Supabase存储的文件
 */

const fetch = require('node-fetch');
const path = require('path');
const fs = require('fs');
const os = require('os');

/**
 * 将远程URL内容缓存到本地临时文件
 * @param {string} url - 远程文件URL
 * @param {string} fileName - 文件名
 * @returns {Promise<string>} - 本地文件路径
 */
async function cacheRemoteFile(url, fileName) {
    try {
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`HTTP错误! 状态: ${response.status}`);
        }
        
        // 获取内容
        const content = await response.text();
        
        // 确定临时目录
        const tempDir = process.env.NODE_ENV === 'production' ? '/tmp/cache' : path.join(__dirname, '..', 'temp', 'cache');
        
        // 确保目录存在
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }
        
        // 创建唯一文件名
        const timestamp = Date.now();
        const safeFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
        const localFilePath = path.join(tempDir, `${timestamp}-${safeFileName}`);
        
        // 写入文件
        fs.writeFileSync(localFilePath, content);
        
        return localFilePath;
    } catch (error) {
        console.error('缓存远程文件失败:', error);
        throw error;
    }
}

/**
 * 处理API请求
 */
module.exports = async (req, res) => {
    try {
        const url = req.query.url;
        
        if (!url) {
            return res.status(400).json({ error: '缺少url参数' });
        }
        
        console.log(`从远程URL获取内容: ${url}`);
        
        // 从URL中提取文件名
        let fileName;
        try {
            const urlObj = new URL(url);
            fileName = path.basename(urlObj.pathname);
        } catch (e) {
            fileName = `remote-${Date.now()}.html`;
        }
        
        // 直接请求远程内容
        const response = await fetch(url);
        
        if (!response.ok) {
            // 尝试缓存文件
            try {
                const localPath = await cacheRemoteFile(url, fileName);
                console.log(`已将远程内容缓存到: ${localPath}`);
                
                // 返回本地缓存文件内容
                const content = fs.readFileSync(localPath, 'utf8');
                res.setHeader('Content-Type', 'text/html');
                return res.send(content);
            } catch (cacheError) {
                console.error('获取并缓存远程内容失败:', cacheError);
                return res.status(response.status).json({ 
                    error: `远程服务器返回错误: ${response.status}`,
                    message: `无法获取远程内容: ${cacheError.message}`
                });
            }
        }
        
        // 根据内容类型设置响应头
        const contentType = response.headers.get('content-type');
        if (contentType) {
            res.setHeader('Content-Type', contentType);
        } else {
            // 默认为HTML
            res.setHeader('Content-Type', 'text/html');
        }
        
        // 读取内容
        const content = await response.text();
        
        // 尝试将内容缓存到本地文件
        try {
            const localPath = await cacheRemoteFile(url, fileName);
            console.log(`已将远程内容缓存到: ${localPath}`);
        } catch (e) {
            console.error('缓存远程内容失败:', e);
            // 继续执行，不影响主流程
        }
        
        // 返回内容
        return res.send(content);
    } catch (error) {
        console.error('获取远程内容失败:', error);
        return res.status(500).json({ 
            error: '获取远程内容失败',
            message: error.message
        });
    }
}; 