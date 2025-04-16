/**
 * 文件管理工具
 * 处理文件上传、保存和清理操作
 */

const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const schedule = require('node-schedule');
const { createFileError, logErrorToFile } = require('./errorHandler');

// 配置
const config = {
    // 文件保留时间(毫秒): 2天
    FILE_RETENTION_PERIOD: 2 * 24 * 60 * 60 * 1000,
    // 最大文件大小(字节): 50MB
    MAX_FILE_SIZE: 50 * 1024 * 1024,
    // 允许的文件类型
    ALLOWED_MIME_TYPES: [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-powerpoint',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'text/plain',
        'text/csv',
        'application/json',
        'application/xml',
        'text/xml',
        'image/jpeg',
        'image/png',
        'image/gif',
        'image/svg+xml'
    ],
    // 目录路径
    TEMP_DIR: path.join(process.cwd(), 'uploads', 'temp'),
    RESULTS_DIR: path.join(process.cwd(), 'uploads', 'results')
};

/**
 * 确保目录存在
 * @param {string} directory - 目录路径
 */
function ensureDirectoryExists(directory) {
    try {
        if (!fs.existsSync(directory)) {
            fs.mkdirSync(directory, { recursive: true });
            console.log(`创建目录: ${directory}`);
        }
    } catch (error) {
        const errorMsg = `创建目录失败 ${directory}: ${error.message}`;
        console.error(errorMsg);
        throw createFileError(errorMsg, { directory, originalError: error.message });
    }
}

// 确保上传目录存在
try {
    ensureDirectoryExists(config.TEMP_DIR);
    ensureDirectoryExists(config.RESULTS_DIR);
} catch (error) {
    console.error('初始化文件目录失败:', error);
    // 如果这发生在启动时，我们会继续运行，但后续的文件操作可能会失败
}

// 配置存储
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        try {
            ensureDirectoryExists(config.TEMP_DIR);
            cb(null, config.TEMP_DIR);
        } catch (error) {
            cb(error);
        }
    },
    filename: (req, file, cb) => {
        try {
            // 生成唯一文件名，同时保留原始文件扩展名
            const uniqueFilename = `${uuidv4()}${path.extname(file.originalname)}`;
            cb(null, uniqueFilename);
        } catch (error) {
            cb(createFileError('生成文件名失败', { 
                originalName: file.originalname, 
                error: error.message 
            }));
        }
    }
});

/**
 * 验证文件类型的中间件过滤器
 */
const fileFilter = (req, file, cb) => {
    try {
        // 检查MIME类型是否在允许列表中
        if (config.ALLOWED_MIME_TYPES.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(createFileError('不支持的文件类型', { 
                mimetype: file.mimetype, 
                filename: file.originalname,
                allowedTypes: config.ALLOWED_MIME_TYPES
            }), false);
        }
    } catch (error) {
        cb(error, false);
    }
};

// 配置multer上传
const upload = multer({
    storage: storage,
    limits: {
        fileSize: config.MAX_FILE_SIZE
    },
    fileFilter: fileFilter
});

/**
 * 获取文件信息
 * @param {string} filePath - 文件路径
 * @returns {Object} 文件信息对象
 */
async function getFileInfo(filePath) {
    try {
        const stats = await fs.promises.stat(filePath);
        const fileExt = path.extname(filePath);
        const fileName = path.basename(filePath);
        
        return {
            filename: fileName,
            extension: fileExt,
            size: stats.size,
            path: filePath,
            created: stats.birthtime,
            modified: stats.mtime,
            isExpired: (Date.now() - stats.birthtime) > config.FILE_RETENTION_PERIOD
        };
    } catch (error) {
        throw createFileError(`获取文件信息失败 ${filePath}`, { 
            path: filePath, 
            error: error.message 
        });
    }
}

/**
 * 保存处理结果到文件
 * @param {Object} data - 要保存的数据
 * @param {string} filename - 文件名 (可选)
 * @returns {string} 保存的文件路径
 */
async function saveResultToFile(data, filename = null) {
    try {
        ensureDirectoryExists(config.RESULTS_DIR);
        
        const resultFilename = filename || `result-${uuidv4()}.json`;
        const filePath = path.join(config.RESULTS_DIR, resultFilename);
        
        // 确保数据是字符串格式
        const content = typeof data === 'string' 
            ? data 
            : JSON.stringify(data, null, 2);
        
        await fs.promises.writeFile(filePath, content, 'utf8');
        console.log(`结果已保存到: ${filePath}`);
        return filePath;
    } catch (error) {
        const errorMsg = `保存结果文件失败: ${error.message}`;
        console.error(errorMsg);
        logErrorToFile(createFileError(errorMsg, { data, filename }));
        throw createFileError(errorMsg);
    }
}

/**
 * 从临时目录移动文件到结果目录
 * @param {string} tempFilePath - 临时文件路径
 * @param {string} newFilename - 新文件名 (可选)
 * @returns {string} 新的文件路径
 */
async function moveFileToResults(tempFilePath, newFilename = null) {
    try {
        ensureDirectoryExists(config.RESULTS_DIR);
        
        const filename = newFilename || path.basename(tempFilePath);
        const targetPath = path.join(config.RESULTS_DIR, filename);
        
        await fs.promises.copyFile(tempFilePath, targetPath);
        await fs.promises.unlink(tempFilePath);
        
        console.log(`文件已从 ${tempFilePath} 移动到 ${targetPath}`);
        return targetPath;
    } catch (error) {
        const errorMsg = `移动文件失败 ${tempFilePath}: ${error.message}`;
        console.error(errorMsg);
        logErrorToFile(createFileError(errorMsg, { 
            source: tempFilePath, 
            destination: newFilename 
        }));
        throw createFileError(errorMsg);
    }
}

/**
 * 删除文件
 * @param {string} filePath - 要删除的文件路径
 * @returns {boolean} 是否成功删除
 */
async function deleteFile(filePath) {
    try {
        await fs.promises.unlink(filePath);
        console.log(`文件已删除: ${filePath}`);
        return true;
    } catch (error) {
        // 如果文件不存在，不视为错误
        if (error.code === 'ENOENT') {
            console.log(`文件不存在，无需删除: ${filePath}`);
            return true;
        }
        
        const errorMsg = `删除文件失败 ${filePath}: ${error.message}`;
        console.error(errorMsg);
        logErrorToFile(createFileError(errorMsg, { path: filePath }));
        return false;
    }
}

/**
 * 递归清理目录中的过期文件
 * @param {string} directory - 要清理的目录
 * @returns {Object} 清理统计信息
 */
async function cleanDirectory(directory) {
    try {
        const stats = {
            cleaned: 0,
            skipped: 0,
            errors: 0
        };
        
        // 确保目录存在
        if (!fs.existsSync(directory)) {
            console.log(`目录不存在，无需清理: ${directory}`);
            return stats;
        }
        
        const entries = await fs.promises.readdir(directory, { withFileTypes: true });
        
        for (const entry of entries) {
            const fullPath = path.join(directory, entry.name);
            
            if (entry.isDirectory()) {
                // 递归清理子目录
                const subStats = await cleanDirectory(fullPath);
                stats.cleaned += subStats.cleaned;
                stats.skipped += subStats.skipped;
                stats.errors += subStats.errors;
            } else {
                try {
                    const fileInfo = await getFileInfo(fullPath);
                    
                    if (fileInfo.isExpired) {
                        // 删除过期文件
                        const deleted = await deleteFile(fullPath);
                        if (deleted) {
                            stats.cleaned++;
                        } else {
                            stats.errors++;
                        }
                    } else {
                        stats.skipped++;
                    }
                } catch (error) {
                    console.error(`处理文件失败 ${fullPath}: ${error.message}`);
                    logErrorToFile(error);
                    stats.errors++;
                }
            }
        }
        
        return stats;
    } catch (error) {
        console.error(`清理目录失败 ${directory}: ${error.message}`);
        logErrorToFile(createFileError(`清理目录失败 ${directory}`, { 
            directory, 
            error: error.message 
        }));
        
        return {
            cleaned: 0,
            skipped: 0,
            errors: 1
        };
    }
}

/**
 * 清理所有过期文件
 * @returns {Object} 清理统计信息
 */
async function cleanupExpiredFiles() {
    console.log('开始清理过期文件...');
    const startTime = Date.now();
    
    try {
        // 清理临时目录
        const tempStats = await cleanDirectory(config.TEMP_DIR);
        
        // 清理结果目录
        const resultsStats = await cleanDirectory(config.RESULTS_DIR);
        
        // 合并结果
        const totalStats = {
            cleaned: tempStats.cleaned + resultsStats.cleaned,
            skipped: tempStats.skipped + resultsStats.skipped,
            errors: tempStats.errors + resultsStats.errors,
            elapsedMs: Date.now() - startTime
        };
        
        console.log(`清理完成. 耗时: ${totalStats.elapsedMs}ms`);
        console.log(`已删除文件: ${totalStats.cleaned}`);
        console.log(`已跳过文件: ${totalStats.skipped}`);
        console.log(`遇到的错误: ${totalStats.errors}`);
        
        return totalStats;
    } catch (error) {
        const errorMsg = `清理过期文件过程中出错: ${error.message}`;
        console.error(errorMsg);
        logErrorToFile(createFileError(errorMsg));
        
        return {
            cleaned: 0,
            skipped: 0,
            errors: 1,
            elapsedMs: Date.now() - startTime
        };
    }
}

// 设置每日定时清理任务 (凌晨3点运行)
try {
    const cleanupJob = schedule.scheduleJob('0 3 * * *', async () => {
        console.log('执行定时清理任务...');
        try {
            await cleanupExpiredFiles();
        } catch (error) {
            console.error('定时清理任务失败:', error);
            logErrorToFile(error);
        }
    });
    
    console.log('已设置文件清理定时任务');
} catch (error) {
    console.error('设置清理定时任务失败:', error);
    logErrorToFile(createFileError('设置清理定时任务失败', { error: error.message }));
}

module.exports = {
    upload,
    getFileInfo,
    saveResultToFile,
    moveFileToResults,
    deleteFile,
    cleanupExpiredFiles,
    config
}; 