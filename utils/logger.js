/**
 * 日志工具模块
 * 提供统一的日志记录功能
 */

const fs = require('fs');
const path = require('path');
const { format } = require('util');

// 确保日志目录存在
const logsDir = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}

// 日志级别
const LogLevel = {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3
};

// 当前日志级别
let currentLogLevel = LogLevel.INFO;

// 日志文件路径
const logFilePath = path.join(logsDir, 'app.log');
const errorLogFilePath = path.join(logsDir, 'error.log');

/**
 * 获取当前日期时间字符串
 * @returns {string} 格式化的日期时间
 */
function getTimestamp() {
    const now = new Date();
    return now.toISOString().replace('T', ' ').substring(0, 19);
}

/**
 * 将消息写入日志文件
 * @param {string} filePath 日志文件路径
 * @param {string} message 日志消息
 */
function writeToLogFile(filePath, message) {
    try {
        const logEntry = `${getTimestamp()} ${message}\n`;
        fs.appendFileSync(filePath, logEntry);
    } catch (error) {
        console.error(`写入日志文件 ${filePath} 失败:`, error);
    }
}

/**
 * 格式化日志消息
 * @param {string} level 日志级别
 * @param {string} message 日志消息
 * @param {...any} args 额外参数
 * @returns {string} 格式化后的日志消息
 */
function formatLogMessage(level, message, ...args) {
    let formattedMessage = message;
    
    if (args.length > 0) {
        // 处理对象参数
        const formattedArgs = args.map(arg => {
            if (arg instanceof Error) {
                return arg.stack || `${arg.name}: ${arg.message}`;
            } else if (typeof arg === 'object') {
                try {
                    return JSON.stringify(arg);
                } catch (e) {
                    return '[无法序列化的对象]';
                }
            }
            return arg;
        });
        
        formattedMessage = format(message, ...formattedArgs);
    }
    
    return `[${level}] ${formattedMessage}`;
}

/**
 * 记录调试级别日志
 * @param {string} message 日志消息
 * @param {...any} args 额外参数
 */
function debug(message, ...args) {
    if (currentLogLevel <= LogLevel.DEBUG) {
        const logMessage = formatLogMessage('DEBUG', message, ...args);
        console.debug(logMessage);
        writeToLogFile(logFilePath, logMessage);
    }
}

/**
 * 记录信息级别日志
 * @param {string} message 日志消息
 * @param {...any} args 额外参数
 */
function info(message, ...args) {
    if (currentLogLevel <= LogLevel.INFO) {
        const logMessage = formatLogMessage('INFO', message, ...args);
        console.info(logMessage);
        writeToLogFile(logFilePath, logMessage);
    }
}

/**
 * 记录警告级别日志
 * @param {string} message 日志消息
 * @param {...any} args 额外参数
 */
function warn(message, ...args) {
    if (currentLogLevel <= LogLevel.WARN) {
        const logMessage = formatLogMessage('WARN', message, ...args);
        console.warn(logMessage);
        writeToLogFile(logFilePath, logMessage);
    }
}

/**
 * 记录错误级别日志
 * @param {string} message 日志消息
 * @param {...any} args 额外参数
 */
function error(message, ...args) {
    if (currentLogLevel <= LogLevel.ERROR) {
        const logMessage = formatLogMessage('ERROR', message, ...args);
        console.error(logMessage);
        writeToLogFile(logFilePath, logMessage);
        writeToLogFile(errorLogFilePath, logMessage);
    }
}

/**
 * 设置日志级别
 * @param {number} level 日志级别
 */
function setLogLevel(level) {
    if (Object.values(LogLevel).includes(level)) {
        currentLogLevel = level;
        info(`日志级别设置为: ${Object.keys(LogLevel).find(key => LogLevel[key] === level)}`);
    } else {
        warn(`无效的日志级别: ${level}`);
    }
}

module.exports = {
    debug,
    info,
    warn,
    error,
    setLogLevel,
    LogLevel
}; 