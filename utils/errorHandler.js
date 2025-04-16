/**
 * 错误处理工具
 * 提供统一的错误创建、记录和处理功能
 */
const fs = require('fs');
const path = require('path');

// 错误类型
const ERROR_TYPES = {
    VALIDATION: 'validation_error',
    FILE: 'file_error',
    DATABASE: 'database_error',
    NETWORK: 'network_error',
    AUTHORIZATION: 'auth_error',
    GENERAL: 'general_error'
};

// 错误日志文件路径
const LOG_DIR = path.join(process.cwd(), 'logs');
const ERROR_LOG_FILE = path.join(LOG_DIR, 'errors.log');

// 确保日志目录存在
function ensureLogDirectory() {
    if (!fs.existsSync(LOG_DIR)) {
        fs.mkdirSync(LOG_DIR, { recursive: true });
    }
}

/**
 * 记录错误到日志文件
 * @param {Error} error - 错误对象
 * @param {string} [source] - 错误来源
 */
function logErrorToFile(error, source = 'unknown') {
    try {
        ensureLogDirectory();
        
        const timestamp = new Date().toISOString();
        const errorType = error.type || ERROR_TYPES.GENERAL;
        const errorMessage = error.message || '未知错误';
        const errorDetails = error.details ? JSON.stringify(error.details) : '';
        const errorStack = error.stack || '';
        
        const logEntry = `[${timestamp}] [${errorType}] [${source}] ${errorMessage}\n` +
                        `Details: ${errorDetails}\n` +
                        `Stack: ${errorStack}\n` +
                        '---------------------------------------------------\n';
        
        fs.appendFileSync(ERROR_LOG_FILE, logEntry);
    } catch (logError) {
        console.error('记录错误日志失败:', logError);
    }
}

/**
 * 创建通用错误对象
 * @param {string} message - 错误消息
 * @param {Object} details - 错误详情
 * @param {string} type - 错误类型
 * @returns {Error} - 错误对象
 */
function createError(message, details = {}, type = ERROR_TYPES.GENERAL) {
    const error = new Error(message);
    error.type = type;
    error.details = details;
    error.timestamp = new Date().toISOString();
    
    return error;
}

/**
 * 创建验证错误
 * @param {string} message - 错误消息
 * @param {Object} details - 错误详情
 * @returns {Error} - 验证错误对象
 */
function createValidationError(message, details = {}) {
    return createError(message, details, ERROR_TYPES.VALIDATION);
}

/**
 * 创建文件错误
 * @param {string} message - 错误消息
 * @param {Object} details - 错误详情
 * @returns {Error} - 文件错误对象
 */
function createFileError(message, details = {}) {
    return createError(message, details, ERROR_TYPES.FILE);
}

/**
 * 创建数据库错误
 * @param {string} message - 错误消息
 * @param {Object} details - 错误详情
 * @returns {Error} - 数据库错误对象
 */
function createDatabaseError(message, details = {}) {
    return createError(message, details, ERROR_TYPES.DATABASE);
}

/**
 * 创建网络错误
 * @param {string} message - 错误消息
 * @param {Object} details - 错误详情
 * @returns {Error} - 网络错误对象
 */
function createNetworkError(message, details = {}) {
    return createError(message, details, ERROR_TYPES.NETWORK);
}

/**
 * 创建授权错误
 * @param {string} message - 错误消息
 * @param {Object} details - 错误详情
 * @returns {Error} - 授权错误对象
 */
function createAuthError(message, details = {}) {
    return createError(message, details, ERROR_TYPES.AUTHORIZATION);
}

/**
 * 处理API错误并返回适当的响应
 * @param {Error} error - 错误对象
 * @param {Object} res - Express响应对象
 */
function handleApiError(error, res) {
    // 记录错误
    logErrorToFile(error, 'api');
    
    // 根据错误类型返回适当的HTTP状态码
    let statusCode = 500;
    
    switch (error.type) {
        case ERROR_TYPES.VALIDATION:
            statusCode = 400; // Bad Request
            break;
        case ERROR_TYPES.AUTHORIZATION:
            statusCode = 401; // Unauthorized
            break;
        case ERROR_TYPES.FILE:
            statusCode = 400; // Bad Request for file errors
            break;
        case ERROR_TYPES.DATABASE:
            statusCode = 500; // Internal Server Error
            break;
        case ERROR_TYPES.NETWORK:
            statusCode = 503; // Service Unavailable
            break;
        default:
            statusCode = 500; // Internal Server Error
    }
    
    // 返回错误响应
    return res.status(statusCode).json({
        success: false,
        error: {
            message: error.message,
            type: error.type,
            details: process.env.NODE_ENV === 'production' ? undefined : error.details
        }
    });
}

/**
 * Express错误中间件
 * @param {Error} err - 错误对象
 * @param {Object} req - 请求对象
 * @param {Object} res - 响应对象
 * @param {Function} next - 下一个中间件函数
 */
function errorMiddleware(err, req, res, next) {
    // 如果是我们创建的错误（有type属性），使用handleApiError处理
    if (err.type) {
        return handleApiError(err, res);
    }
    
    // 其他错误处理为通用错误
    const generalError = createError(
        err.message || '服务器内部错误',
        { originalError: err.toString() }
    );
    
    return handleApiError(generalError, res);
}

module.exports = {
    ERROR_TYPES,
    createError,
    createValidationError,
    createFileError,
    createDatabaseError,
    createNetworkError,
    createAuthError,
    logErrorToFile,
    handleApiError,
    errorMiddleware
}; 