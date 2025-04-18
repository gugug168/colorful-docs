const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');
const htmlPdf = require('html-pdf-node');

// 安全地加载pdf-parse模块
let pdfParse;
try {
  pdfParse = require('pdf-parse');
  console.log('pdf-parse模块加载成功');
} catch (err) {
  console.error('加载pdf-parse模块失败:', err.message);
  // 创建一个虚拟的pdf-parse函数以避免程序崩溃
  pdfParse = async () => {
    return {
      text: '无法解析PDF，pdf-parse模块未正确加载',
      numpages: 0,
      info: {},
      metadata: {}
    };
  };
}

/**
 * 将PDF文件转换为HTML格式
 * @param {string} pdfFilePath - PDF文件路径
 * @returns {Promise<object>} - 包含HTML内容和HTML文件路径的对象
 */
exports.convertPdfToHtml = async function(pdfFilePath) {
    try {
        console.log('开始转换PDF文档:', pdfFilePath);
        
        // 检查文件是否存在
        if (!fs.existsSync(pdfFilePath)) {
            throw new Error(`PDF文件不存在: ${pdfFilePath}`);
        }
        
        // 确保输出目录存在 - 使用/tmp目录
        const outputDir = '/tmp/temp';
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }
        
        // 确保临时图片目录存在
        const imgDir = '/tmp/public/images/temp';
        if (!fs.existsSync(imgDir)) {
            fs.mkdirSync(imgDir, { recursive: true });
        }
        
        // 生成一个唯一的输出文件名
        const timestamp = Date.now();
        const outputHtmlPath = path.join(outputDir, `pdf-${timestamp}.html`);
        
        try {
            // 检查pdf-parse是否可用
            if (!pdfParse || typeof pdfParse !== 'function') {
                throw new Error('pdf-parse模块不可用或未正确加载');
            }
            
            // 读取PDF文件
            const dataBuffer = fs.readFileSync(pdfFilePath);
            
            // 提取PDF内容
            const data = await pdfParse(dataBuffer);
            
            // 获取文本内容
            const pdfText = data.text || '';
            
            // 将提取的文本转换为HTML
            const paragraphs = pdfText.split(/\r?\n\r?\n/);
            const htmlParagraphs = paragraphs
                .filter(p => p.trim() !== '')
                .map(p => `<p>${p.replace(/\r?\n/g, '<br>')}</p>`)
                .join('\n');
            
            // 创建完整的HTML文档
            const html = `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>PDF转换文档</title>
                    <style>
                        body { 
                            font-family: Arial, sans-serif; 
                            line-height: 1.6; 
                            color: #333; 
                            margin: 20px;
                            max-width: 800px;
                            margin: 0 auto;
                            padding: 20px;
                        }
                        h1, h2, h3 { color: #2c3e50; }
                        p { margin-bottom: 16px; }
                    </style>
                </head>
                <body>
                    <h1>文档内容</h1>
                    <div class="content">
                        ${htmlParagraphs}
                    </div>
                </body>
                </html>
            `;
            
            // 保存HTML文件
            fs.writeFileSync(outputHtmlPath, html, 'utf8');
            console.log('PDF文档转换成功，保存到:', outputHtmlPath);
            
            // 替换Windows路径分隔符为URL适用的格式
            const normalizedPath = outputHtmlPath.replace(/\\/g, '/');
            
            return {
                html: html,
                htmlPath: normalizedPath,
                pageCount: data.numpages
            };
        } catch (convertError) {
            console.error('PDF文档转换过程中出错:', convertError);
            
            // 转换失败时，创建一个简单的错误页面作为备选
            const errorHtml = `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="UTF-8">
                    <title>文档转换错误</title>
                    <style>
                        body { font-family: Arial, sans-serif; margin: 40px; text-align: center; }
                        .error-container { border: 1px solid #f44336; padding: 20px; border-radius: 5px; }
                        h1 { color: #f44336; }
                    </style>
                </head>
                <body>
                    <div class="error-container">
                        <h1>PDF转换出错</h1>
                        <p>很抱歉，我们无法转换您的PDF文档。</p>
                        <p>错误信息: ${convertError.message}</p>
                        <p>请确保文档格式正确，或尝试上传其他文档。</p>
                    </div>
                </body>
                </html>
            `;
            
            // 保存错误HTML
            fs.writeFileSync(outputHtmlPath, errorHtml, 'utf8');
            console.log('创建了PDF错误页面:', outputHtmlPath);
            
            // 仍然返回一个有效的结果，但包含错误信息
            return {
                html: errorHtml,
                htmlPath: outputHtmlPath.replace(/\\/g, '/'),
                error: convertError.message
            };
        }
    } catch (error) {
        console.error('PDF文档转换失败:', error);
        
        // 构建一个备用HTML路径和内容，确保函数始终返回有效结果
        const outputDir = '/tmp/temp';
        const fallbackHtmlPath = path.join(outputDir, `pdf-error-${Date.now()}.html`);
        
        // 创建一个简单的错误页面
        const fallbackHtml = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <title>PDF处理错误</title>
                <style>
                    body { font-family: Arial, sans-serif; margin: 40px; text-align: center; }
                    .error-container { border: 1px solid #f44336; padding: 20px; border-radius: 5px; }
                    h1 { color: #f44336; }
                </style>
            </head>
            <body>
                <div class="error-container">
                    <h1>PDF文档处理出错</h1>
                    <p>无法处理您的PDF文档。</p>
                    <p>错误信息: ${error.message}</p>
                    <p>请尝试上传其他文档或联系系统管理员。</p>
                </div>
            </body>
            </html>
        `;
        
        // 确保输出目录存在
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }
        
        // 保存错误HTML
        fs.writeFileSync(fallbackHtmlPath, fallbackHtml, 'utf8');
        console.log('创建了PDF错误备用页面:', fallbackHtmlPath);
        
        return {
            html: fallbackHtml,
            htmlPath: fallbackHtmlPath.replace(/\\/g, '/'),
            error: error.message
        };
    }
};

/**
 * 生成增强的HTML内容
 * @param {string} text - PDF文本内容
 * @param {object} data - PDF解析数据
 * @returns {string} - 格式化的HTML内容
 */
function generateEnhancedHtml(text, data) {
    // 准备HTML内容
    let contentHtml = '<div class="pdf-content">';
    
    // 按行分割文本并处理
    const lines = text.split('\n');
    let inParagraph = false;
    let inTable = false;
    let tableContent = '';
    let tableRows = [];
    
    // 尝试检测表格内容
    for (let i = 0; i < lines.length; i++) {
        const trimmedLine = lines[i].trim();
        
        if (trimmedLine === '') {
            if (inParagraph) {
                contentHtml += '</p>';
                inParagraph = false;
            }
            
            // 如果检测到可能的表格结束
            if (inTable && tableRows.length > 0) {
                contentHtml += generateTable(tableRows);
                tableRows = [];
                inTable = false;
            }
            continue;
        }
        
        // 检测是否为表格行 - 如果包含多个空格或制表符分隔的内容
        const potentialTableCells = trimmedLine.split(/\s{2,}|\t/).filter(cell => cell.trim() !== '');
        
        if (potentialTableCells.length >= 3) {
            // 可能是表格行
            if (!inTable) {
                // 关闭之前的段落
                if (inParagraph) {
                    contentHtml += '</p>';
                    inParagraph = false;
                }
                inTable = true;
            }
            
            tableRows.push(potentialTableCells);
            continue;
        }
        
        // 如果之前在处理表格，但现在不是表格行，结束表格
        if (inTable && tableRows.length > 0) {
            contentHtml += generateTable(tableRows);
            tableRows = [];
            inTable = false;
        }
        
        // 检测标题 - 假设大写字母开头且较短的行是标题
        if (
            trimmedLine.length < 100 && 
            /^[A-Z\u4E00-\u9FA5]/.test(trimmedLine) && 
            !trimmedLine.endsWith('.') && 
            !inParagraph &&
            (trimmedLine.endsWith(':') || /^第.+[章节]/.test(trimmedLine) || /^[0-9]+\./.test(trimmedLine))
        ) {
            const headingLevel = trimmedLine.length < 30 ? 'h2' : 'h3';
            contentHtml += `<${headingLevel} class="pdf-heading">${trimmedLine}</${headingLevel}>`;
        } 
        // 检测列表项
        else if (/^\s*[•\-\*\d+\.\d+\)]\s+/.test(trimmedLine)) {
            contentHtml += `<div class="pdf-list-item">${trimmedLine}</div>`;
        }
        // 其他行作为段落处理
        else {
            if (!inParagraph) {
                contentHtml += '<p>';
                inParagraph = true;
            }
            contentHtml += trimmedLine + ' ';
        }
    }
    
    // 确保关闭最后一个段落
    if (inParagraph) {
        contentHtml += '</p>';
    }
    
    // 如果还有未处理的表格
    if (inTable && tableRows.length > 0) {
        contentHtml += generateTable(tableRows);
    }
    
    contentHtml += '</div>';
    
    // 添加样式和元数据
    const fileName = data.info ? data.info.Title || 'PDF文档' : 'PDF文档';
    const author = data.info ? data.info.Author || '未知作者' : '未知作者';
    const pageCount = data.numpages || 0;
    
    // 完整的HTML文档
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${fileName}</title>
        <style>
            body { 
                font-family: Arial, sans-serif; 
                line-height: 1.6; 
                margin: 0;
                padding: 20px;
                color: #333;
            }
            .pdf-content {
                max-width: 800px;
                margin: 0 auto;
            }
            .pdf-metadata {
                margin-bottom: 20px;
                padding: 10px;
                background-color: #f5f5f5;
                border-radius: 5px;
            }
            .pdf-heading {
                color: #2c3e50;
                margin-top: 1.5em;
                margin-bottom: 0.5em;
            }
            .pdf-list-item {
                margin: 0.5em 0;
                padding-left: 20px;
            }
            p {
                margin-bottom: 1em;
                text-align: justify;
            }
            table {
                width: 100%;
                border-collapse: collapse;
                margin: 1em 0;
            }
            table, th, td {
                border: 1px solid #ddd;
            }
            th, td {
                padding: 8px;
                text-align: left;
            }
            th {
                background-color: #f2f2f2;
            }
        </style>
    </head>
    <body>
        <div class="pdf-metadata">
            <div><strong>文件名:</strong> ${fileName}</div>
            <div><strong>作者:</strong> ${author}</div>
            <div><strong>页数:</strong> ${pageCount}</div>
        </div>
        ${contentHtml}
    </body>
    </html>
    `;
}

/**
 * 从检测到的表格行生成HTML表格
 * @param {Array} rows - 表格行数据
 * @returns {string} - HTML表格
 */
function generateTable(rows) {
    if (!rows || rows.length === 0) return '';
    
    let tableHtml = '<table>';
    
    // 添加表头
    tableHtml += '<thead><tr>';
    for (const cell of rows[0]) {
        tableHtml += `<th>${cell}</th>`;
    }
    tableHtml += '</tr></thead>';
    
    // 添加表格内容
    if (rows.length > 1) {
        tableHtml += '<tbody>';
        for (let i = 1; i < rows.length; i++) {
            tableHtml += '<tr>';
            for (const cell of rows[i]) {
                tableHtml += `<td>${cell}</td>`;
            }
            
            // 如果当前行的单元格少于表头，添加空单元格
            const diff = rows[0].length - rows[i].length;
            for (let j = 0; j < diff; j++) {
                tableHtml += '<td></td>';
            }
            
            tableHtml += '</tr>';
        }
        tableHtml += '</tbody>';
    }
    
    tableHtml += '</table>';
    return tableHtml;
}

/**
 * 将HTML文件转换为PDF格式
 * @param {string} htmlFilePath HTML文件路径
 * @returns {string} 生成的PDF文件路径
 */
async function convertHtmlToPdf(htmlFilePath) {
    try {
        console.log(`开始将HTML转换为PDF: ${htmlFilePath}`);
        
        if (!fs.existsSync(htmlFilePath)) {
            throw new Error(`HTML文件不存在: ${htmlFilePath}`);
        }
        
        // 读取HTML内容
        const htmlContent = fs.readFileSync(htmlFilePath, 'utf8');
        
        // 预处理HTML，确保图片路径正确
        const processedHtml = preprocessHtmlForPdf(htmlContent);
        
        // 创建一个临时的预处理HTML文件
        const tempHtmlPath = htmlFilePath.replace('.html', '-for-pdf.html');
        fs.writeFileSync(tempHtmlPath, processedHtml);
        
        // 生成输出文件路径 - 使用/tmp目录
        const outputDir = '/tmp/downloads';
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }
        
        const outputFilename = path.basename(htmlFilePath, '.html') + '.pdf';
        const outputPath = path.join(outputDir, outputFilename);
        
        console.log(`将HTML转换为PDF: ${tempHtmlPath} => ${outputPath}`);
        
        // 启动Chrome
        const chromeInstance = await launchChrome();
        const browser = await connectToBrowser(chromeInstance.port);
        
        try {
            // 打开新标签页
            const page = await browser.newPage();
            
            // 设置视口大小
            await page.setViewport({ width: 1024, height: 768 });
            
            // 加载HTML文件（使用file://协议加载本地文件）
            await page.goto(`file://${tempHtmlPath}`, { 
                waitUntil: 'networkidle0', 
                timeout: 30000 
            });
            
            // 等待所有图片加载完成
            await page.evaluate(() => {
                return new Promise((resolve) => {
                    // 获取所有图片
                    const imgs = document.querySelectorAll('img');
                    // 如果没有图片，直接返回
                    if (imgs.length === 0) {
                        return resolve();
                    }
                    
                    // 计数器，记录已加载完成的图片数量
                    let loaded = 0;
                    // 遍历所有图片，添加加载完成事件
                    imgs.forEach(img => {
                        // 如果图片已经加载完成
                        if (img.complete) {
                            loaded++;
                            // 如果所有图片都加载完成，返回
                            if (loaded === imgs.length) {
                                resolve();
                            }
                        } else {
                            // 图片加载完成事件
                            img.addEventListener('load', () => {
                                loaded++;
                                // 如果所有图片都加载完成，返回
                                if (loaded === imgs.length) {
                                    resolve();
                                }
                            });
                            // 图片加载失败事件
                            img.addEventListener('error', () => {
                                loaded++;
                                console.warn(`图片加载失败: ${img.src}`);
                                // 如果所有图片都加载完成，返回
                                if (loaded === imgs.length) {
                                    resolve();
                                }
                            });
                        }
                    });
                });
            });
            
            // 生成PDF
            await page.pdf({
                path: outputPath,
                format: 'A4',
                printBackground: true,
                margin: {
                    top: '20mm',
                    right: '20mm',
                    bottom: '20mm',
                    left: '20mm'
                }
            });
            
            console.log(`PDF文件生成成功: ${outputPath}`);
            
            // 关闭页面
            await page.close();
        } finally {
            // 关闭浏览器
            await browser.close();
            // 关闭Chrome
            chromeInstance.kill();
        }
        
        // 清理临时文件
        try {
            fs.unlinkSync(tempHtmlPath);
        } catch (e) {
            console.warn(`清理临时文件失败: ${tempHtmlPath} - ${e.message}`);
        }
        
        return outputPath;
    } catch (error) {
        console.error('HTML转PDF失败:', error);
        throw error;
    }
}

/**
 * 预处理HTML内容，准备转换为PDF
 * @param {string} htmlContent 原始HTML内容
 * @returns {string} 处理后的HTML内容
 */
function preprocessHtmlForPdf(htmlContent) {
    try {
        console.log('处理HTML内容，准备转换为PDF...');
        
        // 1. 确保所有图片路径都是绝对路径
        let processed = htmlContent;
        
        // 替换所有相对路径的图片为绝对路径
        processed = processed.replace(/<img[^>]+src=["'](?!\w+:\/\/)([^"']+)["']/gi, (match, src) => {
            // 如果是相对路径，转换为绝对路径
            if (src.startsWith('./') || src.startsWith('../')) {
                src = src.replace(/^\.\.\/|^\.\//g, '');
            }
            
            // 如果包含"_colorized"，确保优先使用上色版本
            const isColorized = src.includes('_colorized');
            if (isColorized) {
                console.log(`PDF处理: 发现上色图片 ${src}`);
            }
            
            // 确保路径正确，根据实际情况调整
            if (!src.startsWith('/')) {
                src = '/' + src;
            }
            
            // 把src中的双斜杠替换为单斜杠
            src = src.replace(/\/\//g, '/');
            
            // 使用公共目录（如果存在的话）或临时复制图片到/tmp目录
            let newSrc;
            try {
                const publicPath = path.join('/tmp', 'public' + src);
                if (!fs.existsSync(path.dirname(publicPath))) {
                    fs.mkdirSync(path.dirname(publicPath), { recursive: true });
                }
                newSrc = publicPath.replace(/\\/g, '/');
            } catch (e) {
                console.error(`无法处理图片路径: ${e.message}`);
                newSrc = src; // 回退到原路径
            }
            
            return match.replace(/src=["'][^"']+["']/, `src="file://${newSrc}"`);
        });
        
        // 2. 为没有宽度和高度的图片添加默认值
        processed = processed.replace(/<img(?![^>]*width)[^>]*>/gi, (match) => {
            return match.replace(/<img/, '<img width="100%"');
        });
        
        // 3. 确保表格有边框
        processed = processed.replace(/<table(?![^>]*border)[^>]*>/gi, '<table border="1" cellspacing="0" cellpadding="5" style="border-collapse: collapse;">');
        
        // 4. 确保文档有适合PDF的CSS样式
        const pdfStyles = `
        <style>
            @page { size: A4; margin: 20mm; }
            body { font-family: Arial, sans-serif; line-height: 1.5; color: #333; margin: 0; padding: 0; }
            h1 { font-size: 24pt; margin: 24pt 0 12pt 0; }
            h2 { font-size: 20pt; margin: 20pt 0 10pt 0; }
            h3 { font-size: 16pt; margin: 16pt 0 8pt 0; }
            p { margin: 8pt 0; }
            table { width: 100%; border-collapse: collapse; margin: 12pt 0; }
            th, td { padding: 6pt; border: 1pt solid #ddd; text-align: left; }
            th { background-color: #f2f2f2; }
            img { max-width: 100%; height: auto; }
        </style>
        `;
        
        // 查找 <head> 标签，添加样式
        if (processed.includes('<head>')) {
            processed = processed.replace('</head>', `${pdfStyles}</head>`);
        } else if (processed.includes('<html>')) {
            processed = processed.replace('<html>', `<html><head>${pdfStyles}</head>`);
        } else {
            processed = `<!DOCTYPE html><html><head>${pdfStyles}</head><body>${processed}</body></html>`;
        }
        
        console.log('HTML内容处理完成，准备转换为PDF');
        return processed;
    } catch (error) {
        console.error('预处理HTML内容失败:', error);
        return htmlContent; // 出错时返回原始内容
    }
}

/**
 * 启动Chrome浏览器
 * @returns {object} 启动的Chrome实例
 */
async function launchChrome() {
    console.log('启动Chrome浏览器...');
    
    // 动态导入chrome-launcher
    const chromeLauncher = await import('chrome-launcher');
    
    const chromeInstance = await chromeLauncher.launch({
        chromeFlags: [
            '--headless',
            '--disable-gpu',
            '--no-sandbox',
            '--disable-dev-shm-usage',
            '--disable-setuid-sandbox',
            '--disable-software-rasterizer'
        ]
    });
    console.log(`Chrome已启动，端口: ${chromeInstance.port}`);
    return chromeInstance;
}

/**
 * 连接到Chrome浏览器
 * @param {number} port Chrome端口
 * @returns {object} 浏览器实例
 */
async function connectToBrowser(port) {
    console.log(`连接到Chrome浏览器端口: ${port}`);
    const browser = await puppeteer.connect({
        browserURL: `http://localhost:${port}`,
        defaultViewport: null
    });
    return browser;
}

module.exports = {
    convertHtmlToPdf
}; 