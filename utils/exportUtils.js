const fs = require('fs');
const path = require('path');
const htmlDocx = require('html-docx-js');
const https = require('https');
const http = require('http');
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
    return new Promise((resolve, reject) => {
        // 处理相对路径URL
        if (url.startsWith('/')) {
            // 将相对路径转换为本地文件路径
            const localPath = path.join(process.cwd(), 'public', url);
            try {
                if (fs.existsSync(localPath)) {
                    const data = fs.readFileSync(localPath);
                    const base64 = data.toString('base64');
                    const contentType = getContentTypeFromUrl(url);
                    resolve(`data:${contentType};base64,${base64}`);
                } else {
                    console.error('本地图片不存在:', localPath);
                    resolve(''); // 返回空字符串而不是拒绝，以防止一个图片失败导致整个处理失败
                }
            } catch (error) {
                console.error('读取本地图片失败:', error);
                resolve('');
            }
            return;
        }

        // 处理HTTP/HTTPS URL
        const client = url.startsWith('https') ? https : http;
        client.get(url, (res) => {
            if (res.statusCode !== 200) {
                console.error(`图片下载失败，状态码: ${res.statusCode}`);
                resolve('');
                return;
            }

            const chunks = [];
            res.on('data', (chunk) => chunks.push(chunk));
            res.on('end', () => {
                const buffer = Buffer.concat(chunks);
                const base64 = buffer.toString('base64');
                const contentType = getContentTypeFromUrl(url);
                resolve(`data:${contentType};base64,${base64}`);
            });
        }).on('error', (err) => {
            console.error('图片下载错误:', err);
            resolve('');
        });
    });
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
        
        promises.push(downloadImageAsBase64(imgUrl).then(base64 => {
            if (base64) {
                replacements.push({
                    original: fullTag,
                    replacement: fullTag.replace(imgUrl, base64)
                });
            }
        }));
    }

    // 等待所有图片下载完成
    await Promise.all(promises);

    // 应用替换
    for (const { original, replacement } of replacements) {
        resultHtml = resultHtml.replace(original, replacement);
    }

    return resultHtml;
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
        
        // 添加基本的样式
        const styledHtml = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <style>
                    .highlighted {
                        background-color: #ffeb3b;
                        padding: 2px 4px;
                    }
                    .important, .important-concept {
                        font-weight: bold;
                        color: #d32f2f;
                        background-color: #ffebee;
                    }
                    .concept {
                        font-weight: bold;
                        color: #1565c0;
                        background-color: #e3f2fd;
                    }
                    .important-question {
                        font-weight: bold;
                        background-color: #fff9c4;
                    }
                    .warning {
                        background-color: #ffccbc;
                        border-left: 4px solid #ff5722;
                        padding: 8px 12px;
                        margin: 10px 0;
                    }
                    .example {
                        background-color: #e0f7fa;
                        border-left: 4px solid #00bcd4;
                        padding: 8px 12px;
                        margin: 10px 0;
                    }
                    .conclusion {
                        background-color: #e8f5e9;
                        border-left: 4px solid #4caf50;
                        padding: 8px 12px;
                        margin: 10px 0;
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
                    }
                    .colorful-title-2 {
                        color: #7b1fa2;
                        font-size: 22px;
                    }
                    .colorful-title-3 {
                        color: #0097a7;
                        font-size: 18px;
                    }
                    .colorful-question {
                        background-color: #e8f5e9;
                        border-left: 5px solid #4caf50;
                        padding: 10px;
                    }
                    .sub-question {
                        background-color: #f3e5f5;
                        margin-left: 20px;
                        padding: 8px;
                        border-left: 3px solid #9c27b0;
                    }
                    .study-tip {
                        background-color: #e3f2fd;
                        border: 1px dashed #2196f3;
                        padding: 5px 10px;
                    }
                    table {
                        border-collapse: collapse;
                        width: 100%;
                        margin: 15px 0;
                    }
                    th, td {
                        border: 1px solid #ddd;
                        padding: 8px;
                    }
                    th {
                        background-color: #f5f5f5;
                        font-weight: bold;
                    }
                    img {
                        max-width: 100%;
                        height: auto;
                        display: block;
                        margin: 10px auto;
                    }
                    p {
                        margin-bottom: 10px;
                    }
                </style>
            </head>
            <body>
                ${htmlWithBase64Images}
            </body>
            </html>
        `;
        
        // 确保输出目录存在
        const dir = path.dirname(outputPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        
        if (htmlToDocx) {
            console.log('使用html-to-docx导出Word文档...');
            try {
                const buffer = await htmlToDocx(styledHtml, {
                    title: 'Exported Document',
                    margin: {
                        top: 1000,
                        right: 1000,
                        bottom: 1000,
                        left: 1000,
                    },
                    styles: {
                        paragraphStyles: [
                            { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true, 
                              run: { size: 28, bold: true, color: '1565C0' } },
                            { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true, 
                              run: { size: 24, bold: true, color: '7B1FA2' } },
                            { id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true, 
                              run: { size: 20, bold: true, color: '0097A7' } }
                        ]
                    }
                });
                
                fs.writeFileSync(outputPath, buffer);
                console.log('Word文档生成成功:', outputPath);
            } catch (err) {
                console.error('使用html-to-docx导出失败:', err);
                // 如果html-to-docx失败，尝试使用htmlDocx
                console.log('尝试使用htmlDocx导出...');
                const buffer = htmlDocx.asBlob(styledHtml);
                fs.writeFileSync(outputPath, buffer);
                console.log('使用htmlDocx导出成功');
            }
        } else {
            console.log('使用htmlDocx导出Word文档...');
            const buffer = htmlDocx.asBlob(styledHtml);
            fs.writeFileSync(outputPath, buffer);
        }
        
        return {
            success: true,
            message: "导出成功，点击下载",
            outputPath: outputPath
        };
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

module.exports = {
    convertHtmlToDocx,
    convertHtmlToPdf,
    exportToDocx: convertHtmlToDocx,
    exportToPdf: convertHtmlToPdf
}; 