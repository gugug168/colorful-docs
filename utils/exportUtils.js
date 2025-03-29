const fs = require('fs');
const path = require('path');
const htmlDocx = require('html-docx-js');
const https = require('https');
const http = require('http');
const axios = require('axios');
const cheerio = require('cheerio');
const puppeteer = require('puppeteer');
const { exec } = require('child_process');
let chromeLauncher;

try {
    chromeLauncher = require('chrome-launcher');
    console.log('chrome-launcher模块已加载');
} catch (error) {
    console.log('chrome-launcher模块未安装，将使用默认Chrome路径');
}

let htmlToDocx;
let htmlPdf;

// 尝试导入html-to-docx模块，如果安装了的话
try {
    htmlToDocx = require('html-to-docx');
    console.log('html-to-docx模块已加载');
} catch (error) {
    console.log('html-to-docx模块未安装，将使用html-docx-js替代');
}

// 尝试导入html-pdf-node模块，如果安装了的话
try {
    htmlPdf = require('html-pdf-node');
    console.log('html-pdf-node模块已加载');
    
    // 检查puppeteer是否可用，如果不可用，尝试使用puppeteer-core
    try {
        const puppeteer = require('puppeteer');
        console.log('puppeteer已加载');
        // 确保html-pdf-node使用我们的puppeteer实例
        htmlPdf.setPuppeteer && htmlPdf.setPuppeteer(puppeteer);
    } catch (puppeteerError) {
        try {
            const puppeteerCore = require('puppeteer-core');
            console.log('puppeteer-core已加载');
            
            // 不要调用可能导致错误的方法
            console.log('将使用puppeteer-core');
            
            // 确保html-pdf-node使用我们的puppeteer-core实例
            htmlPdf.setPuppeteer && htmlPdf.setPuppeteer(puppeteerCore);
        } catch (coreError) {
            console.error('无法加载puppeteer或puppeteer-core:', coreError);
        }
    }
} catch (error) {
    console.log('html-pdf-node模块未安装，将使用备用方法生成PDF');
}

/**
 * 下载图片并转换为Base64
 * @param {string} url - 图片URL
 * @returns {Promise<string>} - Base64编码的图片
 */
async function downloadImageAsBase64(url) {
    try {
        // 处理相对URL
        const fullUrl = url.startsWith('http') ? url : `http://localhost:3000${url.startsWith('/') ? '' : '/'}${url}`;
        
        // 下载图片
        const response = await axios.get(fullUrl, { responseType: 'arraybuffer' });
        
        // 获取内容类型
        const contentType = response.headers['content-type'] || getContentTypeFromUrl(url);
        
        // 转换为Base64
        const base64 = Buffer.from(response.data).toString('base64');
        
        return `data:${contentType};base64,${base64}`;
    } catch (error) {
        console.error(`下载图片时出错 (${url}):`, error);
        return null;
    }
}

/**
 * 根据URL获取内容类型
 * @param {string} url - 图片URL
 * @returns {string} - MIME类型
 */
function getContentTypeFromUrl(url) {
    const ext = path.extname(url).toLowerCase();
    switch (ext) {
        case '.png': return 'image/png';
        case '.jpg':
        case '.jpeg': return 'image/jpeg';
        case '.gif': return 'image/gif';
        case '.webp': return 'image/webp';
        case '.svg': return 'image/svg+xml';
        default: return 'image/png';
    }
}

/**
 * 将HTML中的图片替换为Base64编码
 * @param {string} html - 原始HTML
 * @returns {Promise<string>} - 替换后的HTML
 */
async function replaceImagesWithBase64(html) {
    const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
    let match;
    let resultHtml = html;
    let promises = [];
    let replacements = [];

    // 收集所有图片URL并创建下载Promise
    while ((match = imgRegex.exec(html)) !== null) {
        const fullTag = match[0];
        const imgUrl = match[1];
        
        // 跳过已经是base64的图片
        if (imgUrl.startsWith('data:')) continue;
        
        // 创建一个唯一的占位符ID
        const placeholderId = `img_placeholder_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        // 将图片标签替换为占位符
        resultHtml = resultHtml.replace(fullTag, `<img data-placeholder-id="${placeholderId}" src="${imgUrl}" />`);
        
        promises.push(downloadImageAsBase64(imgUrl).then(base64 => {
            if (base64) {
                replacements.push({
                    placeholderId: placeholderId,
                    base64: base64
                });
            }
        }));
    }

    // 等待所有图片下载完成
    await Promise.all(promises);

    // 恢复占位符为带Base64编码的图片
    for (const { placeholderId, base64 } of replacements) {
        const placeholderRegex = new RegExp(`<img[^>]*data-placeholder-id="${placeholderId}"[^>]*src="[^"]*"[^>]*>`, 'gi');
        resultHtml = resultHtml.replace(placeholderRegex, `<img src="${base64}" style="max-width: 100%; height: auto; display: block; margin: 10px auto;" />`);
    }

    return resultHtml;
}

/**
 * 将HTML类样式转换为内联样式，以便在Word中更好地显示
 * @param {string} html - 包含类样式的HTML
 * @param {object} styles - CSS样式映射
 * @returns {string} - 带有内联样式的HTML
 */
function convertClassesToInlineStyles(html, styles) {
    // 确保html是字符串类型
    if (typeof html !== 'string') {
        console.error('convertClassesToInlineStyles接收到非字符串类型:', typeof html);
        if (html === null || html === undefined) {
            return '';
        }
        try {
            html = String(html);
        } catch (e) {
            console.error('转换HTML内容到字符串失败:', e);
            return '';
        }
    }
    
    let processedHtml = html;
    // 转换常见的HTML标签
    const tags = ['p', 'div', 'span', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'table', 'tr', 'td', 'th'];
    
    // 其余代码保持不变...
    
    return processedHtml;
}

/**
 * 为Word格式预处理HTML
 * @param {string} htmlContent 原始HTML内容
 * @returns {string} 优化后的HTML
 */
async function preprocessHtmlForWord(htmlContent) {
    // 类型安全检查
    if (typeof htmlContent !== 'string') {
        console.error('preprocessHtmlForWord接收到非字符串类型的HTML内容:', typeof htmlContent);
        if (htmlContent === null || htmlContent === undefined) {
            return '';
        }
        try {
            htmlContent = String(htmlContent);
        } catch (e) {
            console.error('无法将HTML内容转换为字符串:', e);
            return '';
        }
    }

    try {
        // 加载HTML
        const $ = cheerio.load(htmlContent);
        
        // 下载并替换所有图片为Base64
        try {
            await replaceImagesWithBase64($);
        } catch (error) {
            console.warn('替换图片为Base64时出错:', error);
        }
        
        // 定义CSS类到内联样式的映射
        const classToStyle = {
            'highlighted': 'background-color: #ffeb3b !important; padding: 2px 4px; color: #000000;',
            'important': 'font-weight: bold; color: #d32f2f !important; background-color: #ffebee !important; padding: 2px 6px; border: 1px solid #f44336;',
            'important-concept': 'font-weight: bold; color: #d32f2f !important; background-color: #ffebee !important; padding: 2px 6px; border: 1px solid #f44336;',
            'concept': 'font-weight: bold; color: #1565c0 !important; background-color: #e3f2fd !important; padding: 2px 6px; border: 1px solid #2196f3;',
            'important-question': 'font-weight: bold; background-color: #fff9c4 !important; padding: 2px 5px; border: 1px solid #fbc02d;',
            'warning': 'background-color: #ffccbc !important; border-left: 4px solid #ff5722; padding: 8px 12px; margin: 10px 0; border-right: 1px solid #ff5722; border-top: 1px solid #ff5722; border-bottom: 1px solid #ff5722;',
            'example': 'background-color: #e0f7fa !important; border-left: 4px solid #00bcd4; padding: 8px 12px; margin: 10px 0; border-right: 1px solid #00bcd4; border-top: 1px solid #00bcd4; border-bottom: 1px solid #00bcd4;',
            'conclusion': 'background-color: #e8f5e9 !important; border-left: 4px solid #4caf50; padding: 8px 12px; margin: 10px 0; border-right: 1px solid #4caf50; border-top: 1px solid #4caf50; border-bottom: 1px solid #4caf50;',
            'solution-step': 'background-color: #f1f8e9 !important; border-left: 3px solid #8bc34a; padding: 5px 10px; margin: 8px 0; border-right: 1px solid #8bc34a; border-top: 1px solid #8bc34a; border-bottom: 1px solid #8bc34a;',
            'colorful-title-1': 'color: #1565c0 !important; font-size: 26px; text-align: center; margin: 15px 0; background-color: #e3f2fd !important; padding: 10px; border: 2px solid #1565c0; border-radius: 5px;',
            'colorful-title-2': 'color: #7b1fa2 !important; font-size: 22px; margin: 12px 0; padding-bottom: 5px; border-bottom: 2px solid #ce93d8; background-color: #f3e5f5 !important; padding: 5px;',
            'colorful-title-3': 'color: #0097a7 !important; font-size: 18px; margin: 10px 0; padding-left: 8px; border-left: 3px solid #80deea; background-color: #e0f7fa !important; padding: 3px 8px;',
            'colorful-question': 'background-color: #e8f5e9 !important; border-left: 5px solid #4caf50; margin: 15px 0; padding: 10px 15px; border-right: 1px solid #4caf50; border-top: 1px solid #4caf50; border-bottom: 1px solid #4caf50;',
            'sub-question': 'background-color: #f3e5f5 !important; margin: 10px 0 10px 20px; padding: 8px 12px; border-radius: 5px; border: 1px solid #9c27b0; border-left: 3px solid #9c27b0;',
            'study-tip': 'background-color: #e3f2fd !important; border: 1px dashed #2196f3; padding: 5px 10px; margin: 10px 0;'
        };
        
        // 转换CSS类为内联样式
        try {
            $('[class]').each((i, el) => {
                const element = $(el);
                const classes = element.attr('class').split(/\s+/);
                const styles = [];
                
                // 收集所有匹配类的样式
                classes.forEach(className => {
                    if (classToStyle[className]) {
                        styles.push(classToStyle[className]);
                    }
                });
                
                // 如果找到了样式，应用到元素
                if (styles.length > 0) {
                    const currentStyle = element.attr('style') || '';
                    element.attr('style', currentStyle + (currentStyle ? '; ' : '') + styles.join('; '));
                }
            });
        } catch (error) {
            console.warn('转换类样式时出错:', error);
        }
        
        // 优化表格以便在Word中更好地显示
        try {
            $('table').each((index, table) => {
                // 添加边框样式
                $(table).attr('border', '1');
                $(table).attr('cellspacing', '0');
                $(table).attr('cellpadding', '8');
                
                // 确保表格有足够的宽度
                const existingStyle = $(table).attr('style') || '';
                $(table).attr('style', `${existingStyle}${existingStyle ? '; ' : ''}width: 100%; border-collapse: collapse;`);
                
                // 确保表头有样式
                $('th', table).each((thIndex, th) => {
                    const thStyle = $(th).attr('style') || '';
                    $(th).attr('style', `${thStyle}${thStyle ? '; ' : ''}background-color: #f8f9fa; font-weight: bold;`);
                });
                
                // 确保表格单元格有边框
                $('td, th', table).each((cellIndex, cell) => {
                    const cellStyle = $(cell).attr('style') || '';
                    $(cell).attr('style', `${cellStyle}${cellStyle ? '; ' : ''}border: 1px solid #ddd; padding: 8px;`);
                });
            });
        } catch (error) {
            console.warn('优化表格时出错:', error);
        }
        
        // 处理特殊元素样式
        try {
            // 检测并添加重要内容和高亮内容的标记
            $('p').each((index, paragraph) => {
                const text = $(paragraph).text();
                
                // 识别重要内容（包含"重要"、"注意"、"警告"等词汇）
                if (/重要|注意|警告|必须|禁止|切勿|谨记|关键|特别注意/i.test(text)) {
                    const existingStyle = $(paragraph).attr('style') || '';
                    $(paragraph).attr('style', `${existingStyle}${existingStyle ? '; ' : ''}font-weight: bold; color: #e74c3c; background-color: #fdecea; padding: 10px;`);
                }
                
                // 识别提示或建议（包含"提示"、"建议"、"可以"等词汇）
                else if (/提示|建议|可以|推荐|试试|或许|如果可能|最好|优选/i.test(text)) {
                    const existingStyle = $(paragraph).attr('style') || '';
                    $(paragraph).attr('style', `${existingStyle}${existingStyle ? '; ' : ''}color: #27ae60; font-style: italic; border-left: 3px solid #2ecc71; padding-left: 10px;`);
                }
            });
            
            // 为空答案区域添加明显的标记
            $('p:empty').each((index, element) => {
                // 替换为带下划线的空白区域
                $(element).html('_____________________');
                $(element).attr('style', 'border-bottom: 1px solid #aaa; min-height: 24px; margin: 10px 0;');
            });
        } catch (error) {
            console.warn('处理特殊元素样式时出错:', error);
        }
        
        // 返回处理后的HTML
        return $.html();
    } catch (error) {
        console.error('预处理HTML时出错:', error);
        // 出错时直接返回原始HTML
        return htmlContent;
    }
}

/**
 * 增强试题和题号的显示效果
 * @param {string} html - 原始HTML
 * @returns {string} - 处理后的HTML
 */
function enhanceExamQuestions(html) {
    let processedHtml = html;
    
    // 识别并增强题号（如：一、二、三、 或 1. 2. 3. 或 （1） （2） 等）
    const questionNumberRegex = /(<[^>]*>)([一二三四五六七八九十]{1,2}、|（[一二三四五六七八九十]{1,2}）|\([1-9][0-9]?\)|[1-9][0-9]?、|[1-9][0-9]?\.)([^<]*)/gi;
    processedHtml = processedHtml.replace(questionNumberRegex, (match, tag, number, content) => {
        // 避免修改已经在特殊元素内的内容
        if (tag.includes('table') || tag.includes('style') || tag.includes('script')) {
            return match;
        }
        
        // 增强题号显示
        return `${tag}<span class="question-number" style="font-weight: bold; color: #303F9F !important;">${number}</span>${content}`;
    });
    
    // 识别可能的题目（包含"问题"、"解答"、"分析"、"计算"、"证明"、"画出"等关键词）
    const keyQuestionWords = ['问题', '解答', '分析', '计算', '证明', '画出', '找出', '填空', '选择', '连线'];
    
    for (const word of keyQuestionWords) {
        const regex = new RegExp(`(<[^>]*>)([^<]*${word}[^<]*)`, 'gi');
        processedHtml = processedHtml.replace(regex, (match, tag, content) => {
            // 避免修改已经在特殊元素内的内容
            if (tag.includes('table') || tag.includes('style') || tag.includes('script')) {
                return match;
            }
            
            // 增强题目显示
            return `${tag}<span class="exam-question" style="font-weight: bold; color: #4527A0 !important; background-color: #f3e5f5 !important; padding: 5px;">${content}</span>`;
        });
    }
    
    // 识别例题（例1、例2...）
    const exampleRegex = /(<[^>]*>)([^<]*例[1-9][0-9]?[^<]*)/gi;
    processedHtml = processedHtml.replace(exampleRegex, (match, tag, content) => {
        // 避免修改已经在特殊元素内的内容
        if (tag.includes('table') || tag.includes('style') || tag.includes('script')) {
            return match;
        }
        
        // 增强例题显示
        return `${tag}<span class="example-number" style="font-weight: bold; color: #00796B !important;">${content}</span>`;
    });
    
    // 识别重点词汇和概念（粗体显示）
    const keyConceptRegex = /(<[^>]*>)([^<]*)(公式|定义|定律|规则|概念|理论|原理|方法)([^<]*)/gi;
    processedHtml = processedHtml.replace(keyConceptRegex, (match, tag, before, concept, after) => {
        // 避免修改已经在特殊元素内的内容
        if (tag.includes('table') || tag.includes('style') || tag.includes('script')) {
            return match;
        }
        
        // 增强重点概念显示
        return `${tag}${before}<span style="font-weight: bold; color: #C2185B !important; background-color: #FCE4EC !important; padding: 0 3px;">${concept}</span>${after}`;
    });
    
    return processedHtml;
}

/**
 * 增强标题的显示效果
 * @param {string} html - 原始HTML
 * @returns {string} - 处理后的HTML
 */
function enhanceTitles(html) {
    let processedHtml = html;
    
    // 增强h1-h6标题
    processedHtml = processedHtml.replace(
        /<h1([^>]*)>/gi,
        '<h1$1 style="color: #1565c0 !important; font-size: 26px !important; text-align: center; margin: 15px 0; background-color: #e3f2fd !important; padding: 10px; border-bottom: 2px solid #1565c0;">'
    );
    
    processedHtml = processedHtml.replace(
        /<h2([^>]*)>/gi,
        '<h2$1 style="color: #7b1fa2 !important; font-size: 22px !important; margin: 12px 0; padding-bottom: 5px; border-bottom: 2px solid #ce93d8; background-color: #f3e5f5 !important; padding: 5px;">'
    );
    
    processedHtml = processedHtml.replace(
        /<h3([^>]*)>/gi,
        '<h3$1 style="color: #0097a7 !important; font-size: 18px !important; margin: 10px 0; padding-left: 8px; border-left: 3px solid #80deea; background-color: #e0f7fa !important; padding: 3px 8px;">'
    );
    
    processedHtml = processedHtml.replace(
        /<h4([^>]*)>/gi,
        '<h4$1 style="color: #00796b !important; font-size: 16px !important; margin: 8px 0; border-bottom: 1px solid #b2dfdb; padding-bottom: 3px;">'
    );
    
    processedHtml = processedHtml.replace(
        /<h5([^>]*)>/gi,
        '<h5$1 style="color: #f57c00 !important; font-size: 14px !important; margin: 6px 0;">'
    );
    
    processedHtml = processedHtml.replace(
        /<h6([^>]*)>/gi,
        '<h6$1 style="color: #5d4037 !important; font-size: 13px !important; margin: 4px 0; font-style: italic;">'
    );
    
    // 识别并增强可能的标题文本（居中的段落，较短的粗体文本等）
    const centeredTextRegex = /<p[^>]*style="[^"]*text-align:\s*center[^"]*"[^>]*>([^<]{5,60})<\/p>/gi;
    processedHtml = processedHtml.replace(centeredTextRegex, (match, content) => {
        // 如果内容看起来像标题（较短且重要），添加彩色背景
        if (content.length < 60 && !match.includes('style="color:')) {
            return match.replace('<p', '<p style="color: #1565c0 !important; background-color: #e8f5e9 !important; padding: 5px; border-radius: 5px;"');
        }
        return match;
    });
    
    return processedHtml;
}

/**
 * 将HTML转换为Word文档
 * @param {string} htmlContent - HTML内容
 * @param {string} outputPath - 输出路径
 * @returns {Promise<object>} - 转换结果
 */
async function convertHtmlToDocx(htmlContent, outputPath) {
    try {
        console.log('开始转换HTML为Word...');
        
        // 将图片替换为Base64编码
        console.log('处理文档中的图片...');
        const htmlWithBase64Images = await replaceImagesWithBase64(htmlContent);
        
        // 预处理HTML，优化Word显示效果
        console.log('预处理HTML以改善Word显示效果...');
        const processedHtml = await preprocessHtmlForWord(htmlWithBase64Images);
        
        // 确保输出目录存在
        const dir = path.dirname(outputPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        // 使用html-to-docx库进行转换 (如果可用)
        if (htmlToDocx) {
            console.log('使用html-to-docx导出Word文档...');
            const fileBuffer = await htmlToDocx(processedHtml, {
                title: '彩色文档',
                orientation: 'portrait', // 纵向
                margins: {
                    top: 1440,      // 1英寸 = 1440 twip
                    right: 1440,
                    bottom: 1440,
                    left: 1440
                },
                font: 'Arial',
                fontSize: 11,
                table: { row: { cantSplit: true } }, // 防止表格行被分割到不同页面
                header: '', // 空的页眉
                footer: '', // 空的页脚
                styles: {
                    paragraphStyles: [
                        { id: 'Normal', name: 'Normal', next: 'Normal', run: { color: '333333', font: 'Arial' } },
                        { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', run: { color: '1565C0', bold: true, font: 'Arial', size: 28 } },
                        { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', run: { color: '7B1FA2', bold: true, font: 'Arial', size: 24 } },
                        { id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', run: { color: '0097A7', bold: true, font: 'Arial', size: 20 } }
                    ]
                }
            });
            fs.writeFileSync(outputPath, fileBuffer);
            console.log('Word文档生成成功:', outputPath);
            
            // 同时保存HTML文件以供参考
            const htmlPath = outputPath.replace('.docx', '.html');
            fs.writeFileSync(htmlPath, processedHtml);
            
            return {
                success: true,
                message: "导出Word成功，点击下载",
                outputPath: outputPath
            };
        } else {
            // 使用html-docx-js作为备选
            console.log('使用html-docx-js导出Word文档...');
            const docx = htmlDocx.asBlob(processedHtml);
            fs.writeFileSync(outputPath, docx);
            console.log('Word文档生成成功:', outputPath);
            
            // 同时保存HTML文件以供参考
            const htmlPath = outputPath.replace('.docx', '.html');
            fs.writeFileSync(htmlPath, processedHtml);
            
            return {
                success: true,
                message: "导出Word成功，点击下载",
                outputPath: outputPath
            };
        }
    } catch (error) {
        console.error('HTML转换为Word失败:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * 将HTML转换为PDF文档
 * @param {string} htmlContent - HTML内容
 * @param {string} outputPath - 输出路径
 * @returns {Promise<object>} - 转换结果
 */
async function convertHtmlToPdf(htmlContent, outputPath) {
    try {
        console.log('开始转换HTML为PDF...');
        
        // 将图片替换为Base64编码
        console.log('处理PDF中的图片...');
        const htmlWithBase64Images = await replaceImagesWithBase64(htmlContent);
        
        // 处理HTML，避免表格和图片被切断
        const processedHtml = processHtmlForPdf(htmlWithBase64Images);
        
        // 添加样式的HTML
        const styledHtml = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <style>
                    @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;700&display=swap');
                    body { 
                        font-family: 'Noto Sans SC', Arial, sans-serif; 
                        line-height: 1.6; 
                        padding: 20px;
                        color: #333;
                    }
                    .highlighted {
                        background-color: #ffeb3b;
                        padding: 2px 4px;
                    }
                    .important, .important-concept {
                        font-weight: bold;
                        color: #d32f2f;
                        background-color: #ffebee;
                        padding: 2px 6px;
                        border-radius: 4px;
                    }
                    .concept {
                        font-weight: bold;
                        color: #1565c0;
                        background-color: #e3f2fd;
                        padding: 2px 6px;
                        border-radius: 4px;
                    }
                    .important-question {
                        font-weight: bold;
                        background-color: #fff9c4;
                        padding: 2px 5px;
                        border-radius: 4px;
                    }
                    .warning {
                        background-color: #ffccbc;
                        border-left: 4px solid #ff5722;
                        padding: 8px 12px;
                        margin: 10px 0;
                        border-radius: 0 8px 8px 0;
                    }
                    .example {
                        background-color: #e0f7fa;
                        border-left: 4px solid #00bcd4;
                        padding: 8px 12px;
                        margin: 10px 0;
                        border-radius: 0 8px 8px 0;
                    }
                    .conclusion {
                        background-color: #e8f5e9;
                        border-left: 4px solid #4caf50;
                        padding: 8px 12px;
                        margin: 10px 0;
                        border-radius: 0 8px 8px 0;
                    }
                    .solution-step {
                        background-color: #f1f8e9;
                        border-left: 3px solid #8bc34a;
                        padding: 5px 10px;
                        margin: 8px 0;
                    }
                    .colorful-title-1 {
                        color: #1565c0;
                        font-size: 26px;
                        text-align: center;
                        margin: 15px 0;
                        background: linear-gradient(to right, #bbdefb, #e3f2fd);
                        padding: 10px;
                        border-radius: 10px;
                    }
                    .colorful-title-2 {
                        color: #7b1fa2;
                        font-size: 22px;
                        margin: 12px 0;
                        border-bottom: 2px solid #ce93d8;
                        padding-bottom: 5px;
                    }
                    .colorful-title-3 {
                        color: #0097a7;
                        font-size: 18px;
                        margin: 10px 0;
                        border-left: 3px solid #80deea;
                        padding-left: 8px;
                    }
                    .colorful-question {
                        background-color: #e8f5e9;
                        border-left: 5px solid #4caf50;
                        margin: 15px 0;
                        padding: 10px 15px;
                        border-radius: 0 8px 8px 0;
                    }
                    .sub-question {
                        background-color: #f3e5f5;
                        margin: 10px 0 10px 20px;
                        padding: 8px 12px;
                        border-radius: 5px;
                        border-left: 3px solid #9c27b0;
                    }
                    .study-tip {
                        background-color: #e3f2fd;
                        border: 1px dashed #2196f3;
                        padding: 5px 10px;
                        margin: 10px 0;
                        border-radius: 5px;
                    }
                    table {
                        border-collapse: collapse;
                        width: auto;
                        max-width: 100%;
                        margin: 15px auto;
                        box-shadow: 0 2px 3px rgba(0,0,0,0.1);
                        page-break-inside: avoid; /* 防止表格跨页被分割 */
                        break-inside: avoid; /* 现代浏览器属性 */
                    }
                    th, td {
                        border: 1px solid #ddd;
                        padding: 8px;
                        text-align: left;
                        white-space: normal; /* 允许文本换行 */
                        word-wrap: break-word; /* 文本换行 */
                    }
                    th {
                        background-color: #f5f5f5;
                        font-weight: bold;
                    }
                    tr:nth-child(even) {
                        background-color: #f9f9f9;
                    }
                    table.responsive {
                        display: block;
                        width: 100%;
                        overflow-x: auto; /* 允许在窄屏幕上滚动 */
                    }
                    /* 图片容器避免跨页切分 */
                    .img-container {
                        page-break-inside: avoid;
                        break-inside: avoid;
                        margin: 15px auto;
                        text-align: center;
                    }
                    img {
                        max-width: 90%;
                        height: auto;
                        display: block;
                        margin: 10px auto;
                        border-radius: 4px;
                        page-break-inside: avoid; /* 防止图片跨页被分割 */
                        break-inside: avoid; /* 现代浏览器属性 */
                    }
                    p {
                        margin-bottom: 10px;
                    }
                    /* 处理特大表格或图片时，添加分页符 */
                    .page-break-after {
                        page-break-after: always;
                        break-after: page;
                    }
                    .page-break-before {
                        page-break-before: always;
                        break-before: page;
                    }
                    /* 缩小过大的表格的字体 */
                    .small-table {
                        font-size: 0.85em;
                    }
                    /* 特宽表格变形为普通表格 */
                    @media print {
                        /* 打印相关样式 */
                        body {
                            margin: 0;
                            padding: 0;
                        }
                        .wide-table {
                            font-size: 0.85em;
                        }
                    }
                </style>
            </head>
            <body>
                ${processedHtml}
            </body>
            </html>
        `;
        
        // 确保输出目录存在
        const dir = path.dirname(outputPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        if (htmlPdf) {
            console.log('使用html-pdf-node导出PDF文档...');
            const file = { content: styledHtml };
            const options = { 
                format: 'A4',
                printBackground: true,
                margin: { top: '30px', right: '25px', bottom: '30px', left: '25px' }, // 增大页边距
                displayHeaderFooter: true,
                headerTemplate: '<div style="font-size: 9px; margin-left: 20px;">彩色学习文档</div>',
                footerTemplate: '<div style="font-size: 9px; margin: 0 auto; text-align: center;"><span class="pageNumber"></span> / <span class="totalPages"></span></div>',
                preferCSSPageSize: true, // 优先使用CSS定义的页面大小
                scale: 0.95, // 稍微缩小内容，避免内容太贴近边缘
            };
            
            try {
                // 检查是否使用puppeteer-core
                if (require.resolve('puppeteer-core')) {
                    console.log('将使用puppeteer-core生成PDF');
                    
                    options.args = ['--no-sandbox', '--disable-setuid-sandbox'];
                    try {
                        // 尝试使用chrome-launcher查找Chrome位置
                        if (chromeLauncher) {
                            const installations = chromeLauncher.Launcher.getInstallations();
                            if (installations && installations.length > 0) {
                                options.executablePath = installations[0];
                                console.log('chrome-launcher找到Chrome:', options.executablePath);
                            } else {
                                // 如果未找到，使用默认路径
                                options.executablePath = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
                                console.log('未找到Chrome安装，使用默认路径:', options.executablePath);
                            }
                        } else {
                            options.executablePath = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
                            console.log('使用本地Chrome:', options.executablePath);
                        }
                    } catch (err) {
                        console.log('未找到Chrome路径，将使用默认路径');
                    }
                }
                
                const pdfBuffer = await htmlPdf.generatePdf(file, options);
                fs.writeFileSync(outputPath, pdfBuffer);
                console.log('PDF文档生成成功:', outputPath);
                
                return {
                    success: true,
                    message: "导出PDF成功，点击下载",
                    outputPath: outputPath
                };
            } catch (err) {
                console.error('使用html-pdf-node导出失败:', err);
                
                // 尝试备用方案 - 生成HTML而非PDF
                console.log('尝试备用方案...');
                const htmlPath = outputPath.replace('.pdf', '.html');
                fs.writeFileSync(htmlPath, styledHtml);
                fs.writeFileSync(outputPath, styledHtml);
                
                return {
                    success: true,
                    message: "无法生成PDF，已转为HTML格式导出",
                    outputPath: outputPath
                };
            }
        } else {
            console.log('HTML-PDF-NODE模块未安装，无法生成PDF');
            return {
                success: false,
                error: "PDF导出功能需要安装html-pdf-node模块。请通过npm安装该模块后再试。"
            };
        }
    } catch (error) {
        console.error('HTML转换为PDF失败:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * 处理HTML内容，避免表格和图片在PDF中跨页被切断
 * @param {string} html - 原始HTML内容
 * @returns {string} - 处理后的HTML
 */
function processHtmlForPdf(html) {
    let processedHtml = html;
    
    // 1. 处理图片 - 将图片放在容器内
    processedHtml = processedHtml.replace(
        /<img([^>]*)>/gi, 
        '<div class="img-container"><img$1></div>'
    );
    
    // 2. 处理表格 - 检测宽表格并添加响应式类
    const tableRegex = /<table([^>]*)>([\s\S]*?)<\/table>/gi;
    processedHtml = processedHtml.replace(tableRegex, (match, attributes, tableContent) => {
        // 计算表格列数
        const thMatch = tableContent.match(/<th[^>]*>/gi);
        const firstRowTdMatch = tableContent.match(/<tr[^>]*>[\s\S]*?<\/tr>/i);
        
        let columnCount = 0;
        if (thMatch) {
            columnCount = thMatch.length;
        } else if (firstRowTdMatch) {
            // 如果没有<th>，计算第一行的<td>数量
            const tdMatch = firstRowTdMatch[0].match(/<td[^>]*>/gi);
            if (tdMatch) {
                columnCount = tdMatch.length;
            }
        }
        
        // 如果列数较多，添加small-table类来缩小字体
        if (columnCount > 5) {
            return `<table${attributes} class="small-table">${tableContent}</table>`;
        }
        
        // 如果是非常宽的表格，添加responsive类
        if (tableContent.length > 1000 || columnCount > 7) {
            return `<table${attributes} class="responsive">${tableContent}</table>`;
        }
        
        return match; // 保持原样
    });
    
    // 3. 为大图片或复杂表格添加分页控制
    // 识别大图片
    processedHtml = processedHtml.replace(
        /<div class="img-container"><img([^>]*)style="([^"]*width:\s*(?:90|[6-9][0-9])%[^"]*)"([^>]*)><\/div>/gi,
        '<div class="page-break-before"></div><div class="img-container"><img$1style="$2"$3></div><div class="page-break-after"></div>'
    );
    
    return processedHtml;
}

/**
 * 使用备用方法将HTML转换为DOCX
 * 当主要方法失败时使用
 * @param {string} htmlContent HTML内容
 * @param {string} outputPath 输出路径
 * @returns {Promise<boolean>} 成功或失败
 */
async function convertHtmlToDocxFallback(htmlContent, outputPath) {
    // 确保htmlContent是字符串
    if (typeof htmlContent !== 'string') {
        if (htmlContent === null || htmlContent === undefined) {
            htmlContent = '';
        } else {
            try {
                htmlContent = String(htmlContent);
            } catch (e) {
                throw new Error('无法将内容转换为字符串: ' + e.message);
            }
        }
    }
    
    const tempHtmlPath = path.join(path.dirname(outputPath), `temp-${Date.now()}.html`);
    
    try {
        // 添加基本样式和元数据
        const wrappedHtml = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; }
                table { border-collapse: collapse; width: 100%; }
                th, td { border: 1px solid #ddd; padding: 8px; }
                th { background-color: #f2f2f2; }
                img { max-width: 100%; height: auto; }
                .highlighted { background-color: yellow; }
                .important { font-weight: bold; color: red; }
            </style>
        </head>
        <body>
            ${htmlContent}
        </body>
        </html>`;
        
        // 保存为临时HTML文件
        fs.writeFileSync(tempHtmlPath, wrappedHtml, 'utf8');
        
        // 使用office-converter或LibreOffice转换
        // 这里以LibreOffice为例，根据实际可用工具调整
        
        // 方法1: 使用LibreOffice (如果可用)
        try {
            const libreOfficeCmd = process.platform === 'win32' ? 
                'soffice.exe' : 'libreoffice';
                
            await new Promise((resolve, reject) => {
                exec(`${libreOfficeCmd} --headless --convert-to docx "${tempHtmlPath}" --outdir "${path.dirname(outputPath)}"`, 
                    (error, stdout, stderr) => {
                        if (error) {
                            console.warn('LibreOffice转换失败:', error);
                            reject(error);
                        } else {
                            // 重命名输出文件
                            const tempOutputPath = tempHtmlPath.replace('.html', '.docx');
                            if (fs.existsSync(tempOutputPath)) {
                                fs.renameSync(tempOutputPath, outputPath);
                                resolve();
                            } else {
                                reject(new Error('转换成功但找不到输出文件'));
                            }
                        }
                    }
                );
            });
            
            console.log('使用LibreOffice成功转换HTML到DOCX');
            return true;
        } catch (libreOfficeError) {
            console.warn('使用LibreOffice转换失败，尝试其他方法');
            
            // 方法2: 使用简单HTML转DOCX
            // 创建一个非常基础的DOCX
            const docx = require('docx');
            const { Document, Paragraph, TextRun, Packer } = docx;
            
            const $ = cheerio.load(htmlContent);
            const doc = new Document();
            
            // 提取纯文本并分段
            const paragraphs = [];
            $('body').find('*').each((i, el) => {
                if ($(el).is('p, h1, h2, h3, h4, h5, h6, div')) {
                    const text = $(el).text().trim();
                    if (text) {
                        paragraphs.push(new Paragraph({
                            children: [new TextRun(text)]
                        }));
                    }
                }
            });
            
            doc.addSection({ children: paragraphs });
            
            // 生成DOCX文件
            const buffer = await Packer.toBuffer(doc);
            fs.writeFileSync(outputPath, buffer);
            
            console.log('使用备用方法成功创建基本DOCX文件');
            return true;
        }
    } catch (error) {
        console.error('所有备用转换方法都失败:', error);
        throw error;
    } finally {
        // 清理临时文件
        if (fs.existsSync(tempHtmlPath)) {
            try {
                fs.unlinkSync(tempHtmlPath);
            } catch (cleanupError) {
                console.warn('清理临时文件失败:', cleanupError);
            }
        }
    }
}

/**
 * 处理Word文档中的图片
 * @param {string} htmlContent HTML内容
 * @returns {Promise<string>} 处理后的HTML
 */
async function processImagesForWord(htmlContent) {
    // 类型安全检查
    if (typeof htmlContent !== 'string') {
        console.error('processImagesForWord接收到非字符串类型的HTML内容:', typeof htmlContent);
        if (htmlContent === null || htmlContent === undefined) {
            return '';
        }
        try {
            htmlContent = String(htmlContent);
        } catch (e) {
            console.error('无法将HTML内容转换为字符串:', e);
            return '';
        }
    }

    // 调用已有的图片处理函数
    try {
        return await replaceImagesWithBase64(htmlContent);
    } catch (error) {
        console.error('处理图片时出错:', error);
        return htmlContent; // 出错时返回原始内容
    }
}

/**
 * 将HTML导出为Word文档
 * @param {string} htmlContent 要导出的HTML内容
 * @param {string} outputPath 输出文件路径
 * @returns {Promise<object>} 导出结果
 */
async function exportToDocx(htmlContent, outputPath) {
    try {
        console.log('开始转换HTML为Word...');
        
        // 类型安全检查
        if (typeof htmlContent !== 'string') {
            console.error('exportToDocx接收到非字符串类型的HTML内容:', typeof htmlContent);
            if (htmlContent === null || htmlContent === undefined) {
                htmlContent = '';
            } else {
                try {
                    htmlContent = String(htmlContent);
                } catch (e) {
                    console.error('无法将HTML内容转换为字符串:', e);
                    return {
                        success: false,
                        message: '无法处理HTML内容: ' + e.message
                    };
                }
            }
        }
        
        // 处理文档中的图片
        console.log('处理文档中的图片...');
        htmlContent = await processImagesForWord(htmlContent);
        
        // 预处理HTML以改善Word显示效果
        console.log('预处理HTML以改善Word显示效果...');
        htmlContent = await preprocessHtmlForWord(htmlContent);
        
        // 使用html-to-docx库导出为Word
        console.log('使用html-to-docx导出Word文档...');
        
        try {
            // 导出到Word
            const docxBuffer = await convertHtmlToDocx(htmlContent, outputPath);
            
            return {
                success: true,
                message: '导出Word文档成功',
                outputPath: outputPath
            };
        } catch (convertError) {
            console.error('HTML转换为Word失败:', convertError);
            
            // 尝试使用备用方法
            try {
                console.log('尝试使用备用方法转换...');
                await convertHtmlToDocxFallback(htmlContent, outputPath);
                
                return {
                    success: true,
                    message: '使用备用方法导出Word文档成功',
                    outputPath: outputPath
                };
            } catch (fallbackError) {
                console.error('备用转换也失败:', fallbackError);
                return {
                    success: false,
                    message: '无法导出Word文档: ' + fallbackError.message
                };
            }
        }
    } catch (error) {
        console.error('导出Word文档时出错:', error);
        return {
            success: false,
            message: '导出Word文档失败: ' + error.message
        };
    }
}

module.exports = {
    convertHtmlToDocx,
    convertHtmlToPdf,
    exportToDocx,
    exportToPdf: convertHtmlToPdf,
    preprocessHtmlForWord,
    processImagesForWord,
    convertHtmlToDocxFallback
}; 