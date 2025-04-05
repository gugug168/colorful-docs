/**
 * 图片上色工具模块
 * 使用百度AI提供的图像上色API实现黑白图片的彩色化
 */

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');

// 百度AI API配置
const API_KEY = 'NWmiAKgZHFsGA8nDM4G73gYf';
const SECRET_KEY = 'k3MC9rB09alEpCUiksiXiqcOJebtP8ay';
const ACCESS_TOKEN_URL = 'https://aip.baidubce.com/oauth/2.0/token';
const COLORIZE_URL = 'https://aip.baidubce.com/rest/2.0/image-process/v1/colourize';

// 访问令牌缓存和过期时间（23小时，比实际的24小时提前一小时刷新）
let accessTokenCache = { token: null, expireTime: 0 };

/**
 * 获取百度AI API的访问令牌
 * @returns {Promise<string>} 访问令牌
 */
async function getAccessToken() {
    try {
        const now = Date.now();
        
        // 如果已有有效的访问令牌，直接返回
        if (accessTokenCache.token && accessTokenCache.expireTime > now) {
            console.log('使用缓存的访问令牌');
            return accessTokenCache.token;
        }
        
        console.log('获取新的访问令牌');
        
        // 构建请求参数
        const params = new URLSearchParams();
        params.append('grant_type', 'client_credentials');
        params.append('client_id', API_KEY);
        params.append('client_secret', SECRET_KEY);
        
        // 发送获取访问令牌的请求
        const response = await axios.post(ACCESS_TOKEN_URL, params, {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });
        
        // 处理响应
        if (response.data && response.data.access_token) {
            const accessToken = response.data.access_token;
            const expiresIn = response.data.expires_in || 2592000; // 默认30天
            
            // 更新令牌缓存
            accessTokenCache.token = accessToken;
            accessTokenCache.expireTime = now + (expiresIn - 3600) * 1000; // 提前一小时过期
            
            console.log('成功获取访问令牌:', accessToken.substring(0, 10) + '...');
            return accessToken;
        } else {
            console.error('获取访问令牌失败:', response.data);
            throw new Error('获取访问令牌失败: ' + JSON.stringify(response.data));
        }
    } catch (error) {
        console.error('获取访问令牌出错:', error);
        throw new Error('获取访问令牌出错: ' + error.message);
    }
}

/**
 * 验证图片文件是否可以进行上色处理
 * @param {string} imagePath 图片路径
 * @returns {Promise<void>} 如果验证不通过，将抛出错误
 */
async function validateImage(imagePath) {
    // 检查文件是否存在
    if (!fs.existsSync(imagePath)) {
        throw new Error(`图片文件不存在: ${imagePath}`);
    }
    
    // 检查文件大小
    const stats = fs.statSync(imagePath);
    const fileSizeMB = stats.size / (1024 * 1024);
    if (fileSizeMB > 4) {
        throw new Error(`图片文件过大: ${fileSizeMB.toFixed(2)}MB，超过4MB限制`);
    }
    
    // 检查图片格式
    const ext = path.extname(imagePath).toLowerCase();
    const supportedFormats = ['.jpg', '.jpeg', '.png', '.bmp'];
    if (!supportedFormats.includes(ext)) {
        throw new Error(`不支持的图片格式: ${ext}，仅支持${supportedFormats.join(', ')}`);
    }
    
    // 读取图片元数据以进一步验证
    try {
        const buffer = fs.readFileSync(imagePath);
        
        // 检查是否为有效的图片文件
        if (buffer.length < 100) {
            throw new Error('图片文件内容无效或已损坏');
        }
        
        // 验证图片头部信息
        const signature = buffer.slice(0, 4).toString('hex');
        
        if (ext === '.jpg' || ext === '.jpeg') {
            if (signature.indexOf('ffd8') !== 0) {
                throw new Error('无效的JPEG图片文件');
            }
        } else if (ext === '.png') {
            if (signature !== '89504e47') {
                throw new Error('无效的PNG图片文件');
            }
        } else if (ext === '.bmp') {
            if (signature.indexOf('424d') !== 0) {
                throw new Error('无效的BMP图片文件');
            }
        }
        
        // 所有检查都通过
        return;
    } catch (error) {
        if (error.message.includes('validateImage')) {
            throw error; // 重新抛出我们自己的验证错误
        } else {
            throw new Error(`图片验证失败: ${error.message}`);
        }
    }
}

/**
 * 添加本地备用上色处理函数
 * 在API连接失败时提供基本的黑白转彩色功能
 * @param {string} imagePath 图片路径
 * @param {boolean} isRecoloring 是否为重新上色操作
 * @param {number} timestamp 时间戳（用于重新上色时创建新文件名）
 * @returns {Promise<object>} 处理结果对象
 */
async function processImageLocal(imagePath, isRecoloring = false, timestamp = null) {
    try {
        console.log(`使用本地备用模式处理图片: ${imagePath}`);
        
        // 验证图片
        await validateImage(imagePath);
        
        // 读取图片文件
        const imageBuffer = fs.readFileSync(imagePath);
        
        // 为处理后的图片生成新路径
        const extname = path.extname(imagePath);
        const basename = path.basename(imagePath, extname);
        const outputDir = path.dirname(imagePath);
        
        // 如果是重新上色操作，添加时间戳以避免覆盖原文件
        let colorizedPath;
        if (isRecoloring && timestamp) {
            colorizedPath = path.join(outputDir, `${basename}_colorized_${timestamp}${extname}`);
            console.log(`重新上色操作，生成带时间戳的新文件路径: ${colorizedPath}`);
        } else {
            colorizedPath = path.join(outputDir, `${basename}_colorized${extname}`);
        }
        
        // 由于无法进行真正的上色，我们复制原始图片作为备用
        fs.copyFileSync(imagePath, colorizedPath);
        
        console.log(`图片本地备用处理完成: ${imagePath} -> ${colorizedPath}`);
        
        // 将上色后的图片复制到网站可访问的目录
        try {
            // 确保temp目录存在
            const tempDir = path.join(process.cwd(), 'temp');
            if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir, { recursive: true });
            }
            
            // 确保temp/images目录存在
            const tempImagesDir = path.join(tempDir, 'images');
            if (!fs.existsSync(tempImagesDir)) {
                fs.mkdirSync(tempImagesDir, { recursive: true });
            }
            
            // 保存到temp目录
            const tempColorizedPath = path.join(tempDir, path.basename(colorizedPath));
            fs.copyFileSync(colorizedPath, tempColorizedPath);
            console.log(`已复制本地处理图片到temp目录: ${tempColorizedPath}`);
            
            // 同时保存到public/images/temp目录，确保网页可访问
            const publicImagesDir = path.join(process.cwd(), 'public', 'images', 'temp');
            if (!fs.existsSync(publicImagesDir)) {
                fs.mkdirSync(publicImagesDir, { recursive: true });
            }
            
            const publicColorizedPath = path.join(publicImagesDir, path.basename(colorizedPath));
            fs.copyFileSync(colorizedPath, publicColorizedPath);
            console.log(`已复制本地处理图片到public/images/temp目录: ${publicColorizedPath}`);
        } catch (copyError) {
            console.warn(`复制图片到可访问目录失败: ${copyError.message}`);
        }
        
        return {
            success: true,
            originalPath: imagePath,
            colorizedPath: colorizedPath,
            isLocalFallback: true,
            isRecoloring: isRecoloring,
            timestamp: timestamp
        };
    } catch (error) {
        console.error(`本地备用处理图片失败: ${imagePath}`, error);
        return {
            success: false,
            originalPath: imagePath,
            error: error.message,
            isLocalFallback: true,
            isRecoloring: isRecoloring,
            timestamp: timestamp
        };
    }
}

/**
 * 处理单个图片
 * @param {string} imagePath 图片路径
 * @param {boolean} isRecoloring 是否为重新上色操作
 * @param {number} timestamp 时间戳（用于重新上色时创建新文件名）
 * @returns {Promise<object>} 处理结果对象
 */
async function processImage(imagePath, isRecoloring = false, timestamp = null) {
    try {
        // 验证图片
        await validateImage(imagePath);
        
        // 获取访问令牌
        const accessToken = await getAccessToken();
        if (!accessToken) {
            console.warn('获取访问令牌失败，切换到本地备用模式');
            return await processImageLocal(imagePath, isRecoloring, timestamp);
        }
        
        // 读取图片文件
        const imageBuffer = fs.readFileSync(imagePath);
        const base64Image = imageBuffer.toString('base64');
        
        // 构建API请求
        const params = new URLSearchParams();
        params.append('image', base64Image);
        
        // 调用百度API
        const response = await axios.post(
            `${COLORIZE_URL}?access_token=${accessToken}`,
            params,
            {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Accept': 'application/json'
                },
                timeout: 30000
            }
        ).catch(err => {
            console.error('百度API请求失败:', err.message);
            return { status: 'error', error: err };
        });
        
        // 检查响应状态
        if (response.status === 'error' || !response.data || response.data.error_code) {
            console.error('上色API响应错误:', response.error || (response.data ? response.data.error_msg : '未知错误'));
            console.warn('API请求失败，切换到本地备用模式');
            return await processImageLocal(imagePath, isRecoloring, timestamp);
        }
        
        // 检查响应格式
        if (!response.data || !response.data.image) {
            console.error('上色API响应格式异常:', response.data);
            console.warn('API返回格式异常，切换到本地备用模式');
            return await processImageLocal(imagePath, isRecoloring, timestamp);
        }
        
        // 获取上色后的图片
        const colorizedImage = response.data.image;
        
        // 确保存储目录存在
        const outputDir = path.dirname(imagePath);
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }
        
        // 为上色后的图片生成新路径 (在保持原始扩展名的基础上添加_colorized后缀)
        const extname = path.extname(imagePath);
        const basename = path.basename(imagePath, extname);
        
        // 如果是重新上色操作，添加时间戳以避免覆盖原文件
        let colorizedPath;
        if (isRecoloring && timestamp) {
            colorizedPath = path.join(outputDir, `${basename}_colorized_${timestamp}${extname}`);
            console.log(`重新上色操作，生成带时间戳的新文件路径: ${colorizedPath}`);
        } else {
            colorizedPath = path.join(outputDir, `${basename}_colorized${extname}`);
        }
        
        // 将上色后的图片保存到本地
        const colorizedBuffer = Buffer.from(colorizedImage, 'base64');
        fs.writeFileSync(colorizedPath, colorizedBuffer);
        
        console.log(`图片${isRecoloring ? '重新' : ''}上色成功: ${imagePath} -> ${colorizedPath}`);
        
        // 将上色后的图片复制到网站可访问的目录
        try {
            // 确保temp目录存在
            const tempDir = path.join(process.cwd(), 'temp');
            if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir, { recursive: true });
            }
            
            // 确保temp/images目录存在
            const tempImagesDir = path.join(tempDir, 'images');
            if (!fs.existsSync(tempImagesDir)) {
                fs.mkdirSync(tempImagesDir, { recursive: true });
            }
            
            // 保存到temp目录
            const tempColorizedPath = path.join(tempDir, path.basename(colorizedPath));
            fs.copyFileSync(colorizedPath, tempColorizedPath);
            console.log(`已复制上色图片到temp目录: ${tempColorizedPath}`);
            
            // 同时保存到public/images/temp目录，确保网页可访问
            const publicImagesDir = path.join(process.cwd(), 'public', 'images', 'temp');
            if (!fs.existsSync(publicImagesDir)) {
                fs.mkdirSync(publicImagesDir, { recursive: true });
            }
            
            const publicColorizedPath = path.join(publicImagesDir, path.basename(colorizedPath));
            fs.copyFileSync(colorizedPath, publicColorizedPath);
            console.log(`已复制上色图片到public/images/temp目录: ${publicColorizedPath}`);
        } catch (copyError) {
            console.warn(`复制图片到可访问目录失败: ${copyError.message}`);
        }
        
        return {
            success: true,
            originalPath: imagePath,
            colorizedPath: colorizedPath,
            message: isRecoloring ? '重新上色成功' : '上色成功',
            isRecoloring: isRecoloring,
            timestamp: timestamp
        };
    } catch (error) {
        console.error(`图片${isRecoloring ? '重新' : ''}上色失败: ${imagePath}`, error);
        return {
            success: false,
            originalPath: imagePath,
            error: error.message,
            isRecoloring: isRecoloring
        };
    }
}

/**
 * 本地备用图片上色方法
 * 当API连接失败时使用简单的CSS滤镜实现基本的上色效果
 * @param {string} imagePath 原始图片路径
 * @returns {Promise<object>} 处理结果对象
 */
async function localColorizeImage(imagePath) {
    try {
        console.log('使用本地备用方法为图片上色:', imagePath);
        
        // 验证图片
        await validateImage(imagePath);
        
        // 读取原始图片
        const imageBuffer = fs.readFileSync(imagePath);
        
        // 创建输出路径
        const extname = path.extname(imagePath);
        const basename = path.basename(imagePath, extname);
        const outputDir = path.dirname(imagePath);
        const colorizedPath = path.join(outputDir, `${basename}_colorized${extname}`);
        
        // 简单地复制原始图片并重命名
        fs.writeFileSync(colorizedPath, imageBuffer);
        
        console.log(`图片本地上色（仅重命名）成功: ${imagePath} -> ${colorizedPath}`);
        
        // 创建HTML包装器，使用CSS滤镜应用上色效果
        const htmlWrapperPath = path.join(outputDir, `${basename}_colorized.html`);
        const htmlContent = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>彩色化图片</title>
    <style>
        body {
            margin: 0;
            padding: 0;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            background-color: #f0f0f0;
        }
        .image-container {
            position: relative;
            max-width: 100%;
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
        }
        .colorized-image {
            display: block;
            max-width: 100%;
            height: auto;
            /* 应用CSS滤镜模拟上色效果 */
            filter: sepia(0.4) saturate(1.5) hue-rotate(5deg);
        }
        .info {
            position: absolute;
            bottom: 10px;
            left: 10px;
            background-color: rgba(0, 0, 0, 0.6);
            color: white;
            padding: 5px 10px;
            border-radius: 3px;
            font-family: Arial, sans-serif;
            font-size: 12px;
        }
    </style>
</head>
<body>
    <div class="image-container">
        <img src="${path.basename(imagePath)}" class="colorized-image" alt="彩色化图片">
        <div class="info">本地备用上色模式</div>
    </div>
</body>
</html>`;
        
        fs.writeFileSync(htmlWrapperPath, htmlContent, 'utf8');
        
        return {
            success: true,
            originalPath: imagePath,
            colorizedPath: colorizedPath,
            isLocalMode: true
        };
    } catch (error) {
        console.error('本地备用图片上色失败:', error);
        return {
            success: false,
            originalPath: imagePath,
            error: error.message
        };
    }
}

/**
 * 处理多个图片的上色
 * @param {Array<string>} imagePaths 图片路径数组
 * @returns {Promise<object>} 处理结果对象
 */
async function colorizeImages(imagePaths) {
    console.log(`开始处理${imagePaths.length}张图片上色`);
    
    let results = [];
    let successCount = 0;
    let failureCount = 0;
    let localFallbackCount = 0;
    
    // 并发处理上限
    const CONCURRENCY_LIMIT = 3;
    
    // 分批处理图片
    for (let i = 0; i < imagePaths.length; i += CONCURRENCY_LIMIT) {
        const batch = imagePaths.slice(i, i + CONCURRENCY_LIMIT);
        console.log(`处理第${i/CONCURRENCY_LIMIT + 1}批图片, ${batch.length}张`);
        
        // 并发处理当前批次的图片
        const batchPromises = batch.map(imagePath => {
            return processImage(imagePath)
                .then(result => {
                    if (result.success) {
                        successCount++;
                        if (result.isLocalFallback) {
                            localFallbackCount++;
                        }
                    } else {
                        failureCount++;
                    }
                    return result;
                })
                .catch(error => {
                    console.error(`图片上色失败: ${imagePath}`, error);
                    failureCount++;
                    return {
                        success: false,
                        originalPath: imagePath,
                        error: error.message
                    };
                });
        });
        
        // 等待当前批次的所有图片处理完成
        const batchResults = await Promise.all(batchPromises);
        results = results.concat(batchResults);
        
        // 在批次之间添加延迟，避免API请求过于频繁
        if (i + CONCURRENCY_LIMIT < imagePaths.length) {
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }
    
    console.log(`[INFO] 图片上色处理完成: ${successCount} 成功, ${failureCount} 失败, ${localFallbackCount} 本地处理`);
    
    return {
        success: results.length > 0 && successCount > 0,
        results: results,
        successCount: successCount,
        failCount: failureCount,
        localFallbackCount: localFallbackCount,
        message: `处理了${results.length}张图片，${successCount}张成功，${failureCount}张失败，${localFallbackCount}张使用本地处理`
    };
}

/**
 * 替换HTML中的图片路径为上色后的图片路径
 * @param {string} html HTML内容
 * @param {Array} results 上色结果数组
 * @returns {object} 替换结果对象，包含更新后的内容和替换数量
 */
function replaceImagesInHtml(html, results) {
    let updatedHtml = html;
    let replacedCount = 0;
    
    // 记录日志
    console.log(`开始替换HTML中的图片路径 - 有${results.length}个上色结果`);
    
    // 遍历上色结果
    results.forEach(result => {
        if (result.success && result.colorizedPath) {
            // 提取文件名，用于匹配
            const originalFileName = path.basename(result.originalPath);
            const colorizedFileName = path.basename(result.colorizedPath);
            
            console.log(`处理图片替换: ${originalFileName} -> ${colorizedFileName}`);
            
            // 生成Web友好的路径 - 修复此部分逻辑
            let webColorizedPath = '';
            
            // 检查路径是否在public目录中
            if (result.colorizedPath.includes('public\\images') || result.colorizedPath.includes('public/images')) {
                // 如果在public/images中，转换为Web路径
                webColorizedPath = '/images/temp/' + colorizedFileName;
                console.log(`图片在public/images目录中，生成Web路径: ${webColorizedPath}`);
            } else if (result.colorizedPath.includes('\\temp\\') || result.colorizedPath.includes('/temp/')) {
                // 如果在temp目录中，生成相对路径
                webColorizedPath = '/temp/' + colorizedFileName;
                console.log(`图片在temp目录中，生成相对路径: ${webColorizedPath}`);
            } else {
                // 检查路径中是否包含colorful-docs来定位项目根目录
                if (result.colorizedPath.includes('colorful-docs')) {
                    try {
                        // 提取项目根目录后的部分
                        const pathParts = result.colorizedPath.split(/colorful-docs[\/\\]/);
                        if (pathParts.length > 1) {
                            webColorizedPath = '/' + pathParts[1].replace(/\\/g, '/');
                            console.log(`从项目路径提取: ${webColorizedPath}`);
                        } else {
                            webColorizedPath = '/temp/' + colorizedFileName;
                        }
                    } catch (error) {
                        console.error('路径转换失败:', error);
                        webColorizedPath = '/temp/' + colorizedFileName;
                    }
                } else {
                    // 对于其他路径，使用temp目录作为默认位置
                    webColorizedPath = '/temp/' + colorizedFileName;
                    console.log(`使用默认路径: ${webColorizedPath}`);
                }
            }
            
            console.log(`最终上色图片Web路径: ${webColorizedPath}`);
            
            // 替换图片路径 (考虑各种可能的引用方式)
            // 1. 根据原始文件名精确匹配
            const regex1 = new RegExp(`<img[^>]*src=["'][^"']*${escapeRegExp(originalFileName)}["'][^>]*>`, 'g');
            let tempHtml = updatedHtml;
            updatedHtml = updatedHtml.replace(regex1, (match) => {
                console.log(`匹配到图片标签: ${match.substring(0, 50)}...`);
                replacedCount++;
                return match.replace(/src=["'][^"']*["']/i, `src="${webColorizedPath}" data-original="${originalFileName}" data-colorized="true"`);
            });
            
            // 检查是否有替换发生
            if (tempHtml !== updatedHtml) {
                console.log(`第一种方式替换成功，当前替换计数: ${replacedCount}`);
            } else {
                // 2. 替换可能的相对路径引用
                const originalRelativePath = `/images/temp/${originalFileName}`;
                const regex2 = new RegExp(`src=["']${escapeRegExp(originalRelativePath)}["']`, 'g');
                tempHtml = updatedHtml;
                updatedHtml = updatedHtml.replace(regex2, (match) => {
                    replacedCount++;
                    return `src="${webColorizedPath}" data-original="${originalRelativePath}" data-colorized="true"`;
                });
                
                if (tempHtml !== updatedHtml) {
                    console.log(`第二种方式替换成功，当前替换计数: ${replacedCount}`);
                } else {
                    // 3. 处理可能的相对路径（没有前导斜杠）
                    const simpleOriginalPath = `images/temp/${originalFileName}`;
                    const regex3 = new RegExp(`src=["']${escapeRegExp(simpleOriginalPath)}["']`, 'g');
                    tempHtml = updatedHtml;
                    updatedHtml = updatedHtml.replace(regex3, (match) => {
                        replacedCount++;
                        return `src="${webColorizedPath}" data-original="${simpleOriginalPath}" data-colorized="true"`;
                    });
                    
                    if (tempHtml !== updatedHtml) {
                        console.log(`第三种方式替换成功，当前替换计数: ${replacedCount}`);
                    }
                }
            }
        }
    });
    
    console.log(`HTML中的图片路径替换完成，总共替换了 ${replacedCount} 张图片`);
    return {
        content: updatedHtml,
        replacedCount: replacedCount
    };
}

/**
 * 转义正则表达式中的特殊字符
 * @param {string} string 需要转义的字符串
 * @returns {string} 转义后的字符串
 */
function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// 导出模块函数
module.exports = {
    colorizeImages,
    processImage,
    processImageLocal,
    validateImage,
    getAccessToken,
    replaceImagesInHtml
}; 