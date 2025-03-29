const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');

/**
 * 将PDF文档转换为HTML
 * @param {string} filePath - PDF文档路径
 * @param {string} outputDir - 输出目录
 * @returns {Promise<object>} - 包含转换结果的对象
 */
async function convertPdfToHtml(filePath, outputDir = 'temp') {
    try {
        // 确保输出目录存在
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }
        
        // 读取PDF文件
        const dataBuffer = fs.readFileSync(filePath);
        
        // 解析PDF内容
        const data = await pdfParse(dataBuffer);
        
        // 提取文本内容并格式化
        const text = data.text;
        
        // 生成增强的HTML格式
        let htmlContent = generateEnhancedHtml(text, data);
        
        // 生成输出文件名
        const fileName = `${path.basename(filePath, '.pdf')}-${Date.now()}.html`;
        const outputPath = path.join(outputDir, fileName);
        
        // 写入HTML文件
        fs.writeFileSync(outputPath, htmlContent);
        
        return {
            success: true,
            html: htmlContent,
            pageCount: data.numpages,
            info: data.info,
            outputPath: outputPath
        };
    } catch (error) {
        console.error('转换PDF文档失败:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

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

module.exports = {
    convertPdfToHtml
}; 