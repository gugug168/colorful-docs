/**
 * 表单数据验证工具
 * 提供各种表单字段验证和错误处理功能
 */
const { createValidationError } = require('./errorHandler');

/**
 * 验证必填字段
 * @param {string} value - 要验证的值
 * @param {string} fieldName - 字段名称（用于错误信息）
 * @returns {boolean} - 验证是否通过
 * @throws {Error} - 验证失败时抛出错误
 */
function validateRequired(value, fieldName) {
    if (value === undefined || value === null || value === '') {
        throw createValidationError(`${fieldName}不能为空`, { field: fieldName });
    }
    return true;
}

/**
 * 验证字符串长度
 * @param {string} value - 要验证的字符串
 * @param {string} fieldName - 字段名称（用于错误信息）
 * @param {Object} options - 验证选项
 * @param {number} [options.min] - 最小长度
 * @param {number} [options.max] - 最大长度
 * @returns {boolean} - 验证是否通过
 * @throws {Error} - 验证失败时抛出错误
 */
function validateLength(value, fieldName, options = {}) {
    // 如果值为空且不是必填项，则跳过验证
    if ((value === undefined || value === null || value === '') && !options.required) {
        return true;
    }
    
    // 如果是必填项且为空，则验证失败
    if (options.required) {
        validateRequired(value, fieldName);
    }
    
    const strValue = String(value);
    
    if (options.min !== undefined && strValue.length < options.min) {
        throw createValidationError(`${fieldName}长度不能少于${options.min}个字符`, { 
            field: fieldName, min: options.min, actual: strValue.length 
        });
    }
    
    if (options.max !== undefined && strValue.length > options.max) {
        throw createValidationError(`${fieldName}长度不能超过${options.max}个字符`, { 
            field: fieldName, max: options.max, actual: strValue.length 
        });
    }
    
    return true;
}

/**
 * 验证电子邮件格式
 * @param {string} value - 要验证的邮箱地址
 * @param {string} fieldName - 字段名称（用于错误信息）
 * @param {Object} options - 验证选项
 * @param {boolean} [options.required=false] - 是否为必填项
 * @returns {boolean} - 验证是否通过
 * @throws {Error} - 验证失败时抛出错误
 */
function validateEmail(value, fieldName, options = {}) {
    // 如果值为空且不是必填项，则跳过验证
    if ((value === undefined || value === null || value === '') && !options.required) {
        return true;
    }
    
    // 如果是必填项且为空，则验证失败
    if (options.required) {
        validateRequired(value, fieldName);
    }
    
    // 邮箱正则表达式
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    
    if (!emailRegex.test(value)) {
        throw createValidationError(`${fieldName}格式不正确，请输入有效的电子邮件地址`, { field: fieldName, value });
    }
    
    return true;
}

/**
 * 验证URL格式
 * @param {string} value - 要验证的URL
 * @param {string} fieldName - 字段名称（用于错误信息）
 * @param {Object} options - 验证选项
 * @param {boolean} [options.required=false] - 是否为必填项
 * @returns {boolean} - 验证是否通过
 * @throws {Error} - 验证失败时抛出错误
 */
function validateUrl(value, fieldName, options = {}) {
    // 如果值为空且不是必填项，则跳过验证
    if ((value === undefined || value === null || value === '') && !options.required) {
        return true;
    }
    
    // 如果是必填项且为空，则验证失败
    if (options.required) {
        validateRequired(value, fieldName);
    }
    
    // 简单URL正则表达式
    const urlRegex = /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/;
    
    if (!urlRegex.test(value)) {
        throw createValidationError(`${fieldName}格式不正确，请输入有效的URL`, { field: fieldName, value });
    }
    
    return true;
}

/**
 * 验证数字
 * @param {number|string} value - 要验证的数字
 * @param {string} fieldName - 字段名称（用于错误信息）
 * @param {Object} options - 验证选项
 * @param {boolean} [options.required=false] - 是否为必填项
 * @param {number} [options.min] - 最小值
 * @param {number} [options.max] - 最大值
 * @param {boolean} [options.integer=false] - 是否必须为整数
 * @returns {boolean} - 验证是否通过
 * @throws {Error} - 验证失败时抛出错误
 */
function validateNumber(value, fieldName, options = {}) {
    // 如果值为空且不是必填项，则跳过验证
    if ((value === undefined || value === null || value === '') && !options.required) {
        return true;
    }
    
    // 如果是必填项且为空，则验证失败
    if (options.required) {
        validateRequired(value, fieldName);
    }
    
    // 转换为数字
    const numValue = Number(value);
    
    // 检查是否为有效数字
    if (isNaN(numValue)) {
        throw createValidationError(`${fieldName}必须是有效的数字`, { field: fieldName, value });
    }
    
    // 检查是否为整数
    if (options.integer && !Number.isInteger(numValue)) {
        throw createValidationError(`${fieldName}必须是整数`, { field: fieldName, value: numValue });
    }
    
    // 检查最小值
    if (options.min !== undefined && numValue < options.min) {
        throw createValidationError(`${fieldName}不能小于${options.min}`, { 
            field: fieldName, min: options.min, value: numValue 
        });
    }
    
    // 检查最大值
    if (options.max !== undefined && numValue > options.max) {
        throw createValidationError(`${fieldName}不能大于${options.max}`, { 
            field: fieldName, max: options.max, value: numValue 
        });
    }
    
    return true;
}

/**
 * 验证日期
 * @param {string|Date} value - 要验证的日期
 * @param {string} fieldName - 字段名称（用于错误信息）
 * @param {Object} options - 验证选项
 * @param {boolean} [options.required=false] - 是否为必填项
 * @param {Date|string} [options.min] - 最小日期
 * @param {Date|string} [options.max] - 最大日期
 * @param {string} [options.format] - 预期的日期格式说明（仅用于错误信息）
 * @returns {boolean} - 验证是否通过
 * @throws {Error} - 验证失败时抛出错误
 */
function validateDate(value, fieldName, options = {}) {
    // 如果值为空且不是必填项，则跳过验证
    if ((value === undefined || value === null || value === '') && !options.required) {
        return true;
    }
    
    // 如果是必填项且为空，则验证失败
    if (options.required) {
        validateRequired(value, fieldName);
    }
    
    let dateValue;
    
    // 尝试转换为Date对象
    if (value instanceof Date) {
        dateValue = value;
    } else {
        dateValue = new Date(value);
    }
    
    // 检查是否为有效日期
    if (isNaN(dateValue.getTime())) {
        const formatMsg = options.format ? `，格式应为：${options.format}` : '';
        throw createValidationError(`${fieldName}不是有效的日期${formatMsg}`, { field: fieldName, value });
    }
    
    // 检查最小日期
    if (options.min) {
        const minDate = options.min instanceof Date ? options.min : new Date(options.min);
        if (dateValue < minDate) {
            throw createValidationError(`${fieldName}不能早于${minDate.toLocaleDateString()}`, {
                field: fieldName,
                min: minDate.toISOString(),
                value: dateValue.toISOString()
            });
        }
    }
    
    // 检查最大日期
    if (options.max) {
        const maxDate = options.max instanceof Date ? options.max : new Date(options.max);
        if (dateValue > maxDate) {
            throw createValidationError(`${fieldName}不能晚于${maxDate.toLocaleDateString()}`, {
                field: fieldName,
                max: maxDate.toISOString(),
                value: dateValue.toISOString()
            });
        }
    }
    
    return true;
}

/**
 * 验证对象
 * @param {Object} value - 要验证的对象
 * @param {string} fieldName - 字段名称（用于错误信息）
 * @param {Object} schema - 验证模式
 * @param {Object} options - 验证选项
 * @param {boolean} [options.required=false] - 是否为必填项
 * @param {boolean} [options.abortEarly=false] - 是否在第一个错误时中止验证
 * @returns {boolean} - 验证是否通过
 * @throws {Error} - 验证失败时抛出错误
 */
function validateObject(value, fieldName, schema, options = {}) {
    // 如果值为空且不是必填项，则跳过验证
    if ((value === undefined || value === null) && !options.required) {
        return true;
    }
    
    // 如果是必填项且为空，则验证失败
    if (options.required && (value === undefined || value === null)) {
        throw createValidationError(`${fieldName}不能为空`, { field: fieldName });
    }
    
    // 检查是否为对象
    if (typeof value !== 'object' || Array.isArray(value)) {
        throw createValidationError(`${fieldName}必须是一个对象`, { field: fieldName, type: typeof value });
    }
    
    const errors = [];
    
    // 遍历schema验证每个字段
    for (const [key, validator] of Object.entries(schema)) {
        try {
            // 调用验证器函数，传递字段值、字段名和选项
            validator(value[key], `${fieldName}.${key}`, options);
        } catch (error) {
            if (error.type === 'validation_error') {
                if (options.abortEarly) {
                    throw error;
                }
                errors.push(error);
            } else {
                // 非验证错误直接抛出
                throw error;
            }
        }
    }
    
    // 如果有错误，则抛出一个包含所有错误的验证错误
    if (errors.length > 0) {
        throw createValidationError(`${fieldName}验证失败`, { 
            field: fieldName, 
            errors: errors.map(e => ({ message: e.message, details: e.details }))
        });
    }
    
    return true;
}

/**
 * 验证数组
 * @param {Array} value - 要验证的数组
 * @param {string} fieldName - 字段名称（用于错误信息）
 * @param {Object} options - 验证选项
 * @param {boolean} [options.required=false] - 是否为必填项
 * @param {number} [options.minLength] - 最小长度
 * @param {number} [options.maxLength] - 最大长度
 * @param {Function} [options.itemValidator] - 数组项验证器函数
 * @param {boolean} [options.abortEarly=false] - 是否在第一个错误时中止验证
 * @returns {boolean} - 验证是否通过
 * @throws {Error} - 验证失败时抛出错误
 */
function validateArray(value, fieldName, options = {}) {
    // 如果值为空且不是必填项，则跳过验证
    if ((value === undefined || value === null) && !options.required) {
        return true;
    }
    
    // 如果是必填项且为空，则验证失败
    if (options.required && (value === undefined || value === null)) {
        throw createValidationError(`${fieldName}不能为空`, { field: fieldName });
    }
    
    // 检查是否为数组
    if (!Array.isArray(value)) {
        throw createValidationError(`${fieldName}必须是一个数组`, { field: fieldName, type: typeof value });
    }
    
    // 检查最小长度
    if (options.minLength !== undefined && value.length < options.minLength) {
        throw createValidationError(`${fieldName}长度不能少于${options.minLength}项`, {
            field: fieldName,
            minLength: options.minLength,
            actualLength: value.length
        });
    }
    
    // 检查最大长度
    if (options.maxLength !== undefined && value.length > options.maxLength) {
        throw createValidationError(`${fieldName}长度不能超过${options.maxLength}项`, {
            field: fieldName,
            maxLength: options.maxLength,
            actualLength: value.length
        });
    }
    
    // 如果提供了项验证器，则验证每一项
    if (options.itemValidator && typeof options.itemValidator === 'function') {
        const errors = [];
        
        value.forEach((item, index) => {
            try {
                options.itemValidator(item, `${fieldName}[${index}]`, options);
            } catch (error) {
                if (error.type === 'validation_error') {
                    if (options.abortEarly) {
                        throw error;
                    }
                    errors.push({ index, error });
                } else {
                    // 非验证错误直接抛出
                    throw error;
                }
            }
        });
        
        // 如果有错误，则抛出一个包含所有错误的验证错误
        if (errors.length > 0) {
            throw createValidationError(`${fieldName}的${errors.length}个项目验证失败`, {
                field: fieldName,
                errors: errors.map(e => ({ 
                    index: e.index, 
                    message: e.error.message, 
                    details: e.error.details 
                }))
            });
        }
    }
    
    return true;
}

module.exports = {
    validateRequired,
    validateLength,
    validateEmail,
    validateUrl,
    validateNumber,
    validateDate,
    validateObject,
    validateArray
}; 