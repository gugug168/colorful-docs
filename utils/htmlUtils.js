/**
 * HTML处理工具
 * 提供HTML格式化、清洁和处理功能
 */

const { createFileError } = require('./errorHandler');

/**
 * 美化HTML代码
 * @param {string} html - 原始HTML代码
 * @param {Object} options - 美化选项
 * @returns {string} - 格式化后的HTML
 */
function htmlBeautify(html, options = {}) {
    try {
        if (!html) {
            return '';
        }

        const defaultOptions = {
            indent_size: 2,
            indent_char: ' ',
            max_preserve_newlines: 1,
            preserve_newlines: true,
            keep_array_indentation: false,
            break_chained_methods: false,
            indent_scripts: 'normal',
            brace_style: 'collapse',
            space_before_conditional: true,
            unescape_strings: false,
            jslint_happy: false,
            end_with_newline: false,
            wrap_line_length: 0,
            indent_inner_html: true,
            comma_first: false,
            e4x: false,
            indent_empty_lines: false
        };

        // 使用简单的HTML格式化逻辑
        const mergedOptions = { ...defaultOptions, ...options };
        
        // 基本格式化
        let formattedHtml = html
            // 规范化空白
            .replace(/>\s+</g, '>\n<')
            // 添加换行到自闭合标签
            .replace(/<(.*?)\/>/g, '<$1/>\n')
            // 添加换行到开始标签
            .replace(/<([^\/\s>]+)(.*?)>/g, function(match) {
                return match + '\n';
            })
            // 添加换行到结束标签
            .replace(/<\/([^>]+)>/g, function(match) {
                return '\n' + match;
            });
        
        // 处理缩进
        const lines = formattedHtml.split('\n');
        let indentLevel = 0;
        let formattedLines = [];
        
        for (let i = 0; i < lines.length; i++) {
            let line = lines[i].trim();
            if (!line) continue;
            
            // 处理结束标签和自闭合标签的缩进
            if (line.match(/<\/([^>]+)>/) || line.match(/<([^>]+)\/>$/)) {
                if (indentLevel > 0) indentLevel--;
            }
            
            // 添加缩进
            if (line.length > 0) {
                const indent = mergedOptions.indent_char.repeat(mergedOptions.indent_size * indentLevel);
                formattedLines.push(indent + line);
            }
            
            // 增加下一行的缩进级别
            if (line.match(/<([^\/\s>]+).*>/) && !line.match(/<\/([^>]+)>$/) && !line.match(/<([^>]+)\/>$/)) {
                indentLevel++;
            }
        }
        
        return formattedLines.join('\n');
    } catch (error) {
        console.error('HTML美化失败:', error);
        return html; // 出错时返回原始HTML
    }
}

/**
 * 清理HTML，移除不安全的脚本和属性
 * @param {string} html - 原始HTML
 * @returns {string} - 清理后的HTML
 */
function sanitizeHtml(html) {
    try {
        if (!html) {
            return '';
        }
        
        // 移除脚本标签
        let sanitized = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
        
        // 移除onclick, onload等事件处理器
        sanitized = sanitized.replace(/\s(on\w+)="[^"]*"/gi, '');
        
        // 移除危险的属性
        sanitized = sanitized.replace(/\s(href|src)="javascript:[^"]*"/gi, ' $1="#"');
        
        // 移除iframe
        sanitized = sanitized.replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '');
        
        return sanitized;
    } catch (error) {
        console.error('HTML清理失败:', error);
        return html; // 出错时返回原始HTML
    }
}

/**
 * 从HTML中提取主要文本内容
 * @param {string} html - HTML内容
 * @returns {string} - 提取的文本
 */
function extractTextFromHtml(html) {
    try {
        if (!html) {
            return '';
        }
        
        // 移除HTML标签
        let text = html.replace(/<[^>]*>/g, ' ');
        
        // 规范化空白
        text = text.replace(/\s+/g, ' ').trim();
        
        // 解码HTML实体
        text = text.replace(/&nbsp;/g, ' ')
                   .replace(/&lt;/g, '<')
                   .replace(/&gt;/g, '>')
                   .replace(/&amp;/g, '&')
                   .replace(/&quot;/g, '"')
                   .replace(/&#39;/g, "'");
        
        return text;
    } catch (error) {
        console.error('提取HTML文本失败:', error);
        return ''; // 出错时返回空字符串
    }
}

/**
 * 从HTML中提取所有图片URL
 * @param {string} html - HTML内容
 * @returns {Array} - 图片URL数组
 */
function extractImagesFromHtml(html) {
    try {
        if (!html) {
            return [];
        }
        
        const imgRegex = /<img[^>]+src="([^">]+)"/g;
        const urls = [];
        let match;
        
        while (match = imgRegex.exec(html)) {
            urls.push(match[1]);
        }
        
        return urls;
    } catch (error) {
        console.error('提取HTML图片失败:', error);
        return []; // 出错时返回空数组
    }
}

/**
 * 替换HTML中的链接
 * @param {string} html - HTML内容
 * @param {Function} replaceFn - 替换函数，接收URL返回新URL
 * @returns {string} - 处理后的HTML
 */
function replaceLinks(html, replaceFn) {
    try {
        if (!html || typeof replaceFn !== 'function') {
            return html;
        }
        
        return html.replace(/href="([^"]+)"/g, (match, url) => {
            const newUrl = replaceFn(url);
            return `href="${newUrl}"`;
        });
    } catch (error) {
        console.error('替换HTML链接失败:', error);
        return html; // 出错时返回原始HTML
    }
}

module.exports = {
    htmlBeautify,
    sanitizeHtml,
    extractTextFromHtml,
    extractImagesFromHtml,
    replaceLinks
}; 