/**
 * 文件下载和内容获取API
 * 支持下载本地文件、远程URL内容和预览内容
 */

const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');
const { URL } = require('url');
const { v4: uuidv4 } = require('uuid');

/**
 * 将远程内容缓存到本地临时文件
 * @param {string} url - 远程文件URL
 * @returns {Promise<object>} - 包含本地文件路径和名称的对象
 */
async function cacheRemoteContent(url) {
    try {
        const timestamp = Date.now();
        
        // 尝试从URL中提取文件名
        let fileName;
        try {
            const urlObj = new URL(url);
            fileName = path.basename(urlObj.pathname);
        } catch (e) {
            // 如果无法解析URL，生成一个随机文件名
            fileName = `download-${timestamp}-${uuidv4().substring(0, 8)}.html`;
        }
        
        // 如果文件名为空，生成一个随机文件名
        if (!fileName) {
            fileName = `download-${timestamp}-${uuidv4().substring(0, 8)}.html`;
        }
        
        // 确保文件扩展名
        if (!path.extname(fileName)) {
            fileName += '.html';
        }
        
        // 使用安全的文件名
        const safeFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
        
        // 确定临时目录
        const tempDir = process.env.NODE_ENV === 'production' ? '/tmp/downloads' : path.join(__dirname, '..', 'downloads');
        
        // 确保目录存在
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }
        
        // 构建本地文件路径
        const localFilePath = path.join(tempDir, safeFileName);
        
        // 获取远程内容
        console.log(`下载远程文件: ${url}`);
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`HTTP错误! 状态: ${response.status}`);
        }
        
        // 获取内容类型
        const contentType = response.headers.get('content-type');
        
        // 获取内容并写入文件
        const content = await response.text();
        fs.writeFileSync(localFilePath, content);
        
        return {
            path: localFilePath,
            fileName: safeFileName,
            content: content,
            contentType: contentType || 'text/html'
        };
    } catch (error) {
        console.error('缓存远程内容失败:', error);
        throw error;
    }
}

/**
 * 处理API请求
 */
module.exports = async (req, res) => {
    try {
        // 启用CORS
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        
        // 处理OPTIONS请求
        if (req.method === 'OPTIONS') {
            return res.status(200).end();
        }
        
        const fileParam = req.query.file;
        const mode = req.query.mode || 'download'; // 'download' 或 'view'
        
        if (!fileParam) {
            return res.status(400).send('缺少文件参数');
        }
        
        console.log(`文件请求: ${fileParam}, 模式: ${mode}`);
        
        // 判断是否为URL
        const isUrl = fileParam.startsWith('http');
        
        let filePath;
        let fileName;
        let fileContent;
        let contentType;
        
        if (isUrl) {
            // 处理远程URL
            try {
                const cacheResult = await cacheRemoteContent(fileParam);
                filePath = cacheResult.path;
                fileName = cacheResult.fileName;
                fileContent = cacheResult.content;
                contentType = cacheResult.contentType;
                console.log(`远程文件已缓存到: ${filePath}`);
            } catch (e) {
                console.error('处理远程URL失败:', e);
                return res.status(500).send(`无法处理远程URL: ${e.message}`);
            }
        } else {
            // 处理本地文件路径
            fileName = path.basename(fileParam);
            
            // 尝试在多个可能的目录中查找文件
            const possibleDirs = [
                process.env.NODE_ENV === 'production' ? '/tmp/downloads' : path.join(__dirname, '..', 'downloads'),
                process.env.NODE_ENV === 'production' ? '/tmp/temp' : path.join(__dirname, '..', 'temp'),
                process.env.NODE_ENV === 'production' ? '/tmp/uploads' : path.join(__dirname, '..', 'uploads'),
                process.env.NODE_ENV === 'production' ? '/var/task/downloads' : path.join(__dirname, '..', 'downloads'),
                process.env.NODE_ENV === 'production' ? '/var/task/temp' : path.join(__dirname, '..', 'temp'),
                process.env.NODE_ENV === 'production' ? '/var/task/uploads' : path.join(__dirname, '..', 'uploads')
            ];
            
            // 先尝试直接使用提供的路径
            if (fs.existsSync(fileParam)) {
                filePath = fileParam;
            } else {
                // 尝试在每个可能的目录中查找文件
                for (const dir of possibleDirs) {
                    const testPath = path.join(dir, fileName);
                    if (fs.existsSync(testPath)) {
                        filePath = testPath;
                        break;
                    }
                }
            }
            
            // 如果还是没找到，尝试直接在文件名目录中查找
            if (!filePath) {
                const baseDir = process.env.NODE_ENV === 'production' ? '/tmp' : path.join(__dirname, '..');
                
                // 递归查找匹配的文件
                const findFiles = (directory, maxDepth = 2, currentDepth = 0) => {
                    if (currentDepth > maxDepth) return null;
                    
                    try {
                        const files = fs.readdirSync(directory);
                        for (const file of files) {
                            const fullPath = path.join(directory, file);
                            
                            try {
                                const stat = fs.statSync(fullPath);
                                
                                if (stat.isDirectory()) {
                                    // 递归搜索子目录
                                    const found = findFiles(fullPath, maxDepth, currentDepth + 1);
                                    if (found) return found;
                                } else if (file === fileName || file.includes(fileName)) {
                                    return fullPath;
                                }
                            } catch (e) {
                                // 忽略单个文件的访问错误
                                console.warn(`无法访问 ${fullPath}: ${e.message}`);
                            }
                        }
                    } catch (e) {
                        console.warn(`无法读取目录 ${directory}: ${e.message}`);
                    }
                    
                    return null;
                };
                
                filePath = findFiles(baseDir);
            }
            
            if (!filePath) {
                // 如果文件确实不存在，返回404错误
                console.error(`找不到文件: ${fileParam} 尝试的路径: ${JSON.stringify(possibleDirs.map(dir => path.join(dir, fileName)), null, 2)}`);
                return res.status(404).send(`找不到文件: ${fileName}`);
            }
            
            // 读取文件内容
            try {
                fileContent = fs.readFileSync(filePath, 'utf8');
                
                // 根据文件扩展名确定内容类型
                const extname = path.extname(filePath).toLowerCase();
                if (extname === '.html') {
                    contentType = 'text/html';
                } else if (extname === '.css') {
                    contentType = 'text/css';
                } else if (extname === '.js') {
                    contentType = 'application/javascript';
                } else if (extname === '.json') {
                    contentType = 'application/json';
                } else if (['.jpg', '.jpeg'].includes(extname)) {
                    contentType = 'image/jpeg';
                } else if (extname === '.png') {
                    contentType = 'image/png';
                } else if (extname === '.gif') {
                    contentType = 'image/gif';
                } else if (extname === '.svg') {
                    contentType = 'image/svg+xml';
                } else if (extname === '.pdf') {
                    contentType = 'application/pdf';
                } else {
                    contentType = 'application/octet-stream';
                }
            } catch (e) {
                console.error(`读取文件内容失败: ${e.message}`);
                // 继续执行，将使用文件流模式
            }
        }
        
        console.log(`提供文件: ${filePath} (${fileName}), 模式: ${mode}`);
        
        // 根据模式处理请求
        if (mode === 'view' && fileContent && contentType) {
            // 视图模式 - 直接返回内容
            res.setHeader('Content-Type', contentType);
            return res.send(fileContent);
        } else {
            // 下载模式 - 发送文件作为附件
            res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);
            res.setHeader('Content-Type', 'application/octet-stream');
            
            // 发送文件
            const fileStream = fs.createReadStream(filePath);
            fileStream.pipe(res);
            
            // 错误处理
            fileStream.on('error', (error) => {
                console.error('文件流错误:', error);
                if (!res.headersSent) {
                    res.status(500).send(`读取文件错误: ${error.message}`);
                } else {
                    res.end();
                }
            });
        }
    } catch (error) {
        console.error('文件处理错误:', error);
        if (!res.headersSent) {
            res.status(500).send(`处理文件请求时发生错误: ${error.message}`);
        } else {
            res.end();
        }
    }
}; 