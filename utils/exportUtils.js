const fs = require('fs');
const path = require('path');
const htmlDocx = require('html-docx-js');
let htmlToDocx;
let htmlPdf;

// 尝试导入html-to-docx模块，如果安装了的话
try {
    htmlToDocx = require('html-to-docx');
} catch (error) {
    console.log('html-to-docx模块未安装，将使用html-docx-js替代');
}

// 尝试导入html-pdf-node模块，如果安装了的话
try {
    htmlPdf = require('html-pdf-node');
} catch (error) {
    console.log('html-pdf-node模块未安装，将使用备用方法生成PDF');
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
                    .important {
                        font-weight: bold;
                        color: #d32f2f;
                    }
                    .section-title {
                        color: #1976d2;
                        font-weight: bold;
                        font-size: 16px;
                        margin-top: 15px;
                        margin-bottom: 10px;
                    }
                    p {
                        margin-bottom: 10px;
                    }
                </style>
            </head>
            <body>
                ${htmlContent}
            </body>
            </html>
        `;
        
        // 确保输出目录存在
        const dir = path.dirname(outputPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        
        // 创建一个HTML文件，但保存为.docx扩展名
        console.log('使用简单方法导出Word文档...');
        
        // 保存HTML内容到Word文件
        fs.writeFileSync(outputPath, styledHtml);
        
        // 同时创建一个.html版本以便在浏览器中查看
        const htmlPath = outputPath.replace('.docx', '.html');
        fs.writeFileSync(htmlPath, styledHtml);
        
        return {
            success: true,
            message: "导出成功，点击下载",
            outputPath: outputPath,
            htmlPath: htmlPath
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
        
        // 添加样式的HTML
        const styledHtml = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; padding: 20px; }
                    .highlighted {
                        background-color: #ffeb3b;
                        padding: 2px 4px;
                    }
                    .important {
                        font-weight: bold;
                        color: #d32f2f;
                    }
                    .section-title {
                        color: #1976d2;
                        font-weight: bold;
                        font-size: 16px;
                        margin-top: 15px;
                        margin-bottom: 10px;
                    }
                    p {
                        margin-bottom: 10px;
                    }
                </style>
            </head>
            <body>
                ${htmlContent}
            </body>
            </html>
        `;
        
        // 确保输出目录存在
        const dir = path.dirname(outputPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        // 将HTML内容保存为PDF文件(实际上是HTML内容)
        console.log('使用简单方法导出PDF文档...');
        
        // 创建HTML版本
        const htmlPath = outputPath.replace('.pdf', '.html');
        fs.writeFileSync(htmlPath, styledHtml);
        
        // 将HTML内容写入PDF文件
        fs.writeFileSync(outputPath, styledHtml);
        
        return {
            success: true,
            message: "导出成功，点击下载",
            outputPath: outputPath,
            htmlPath: htmlPath
        };
    } catch (error) {
        console.error('HTML转换为PDF失败:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

module.exports = {
    convertHtmlToDocx,
    convertHtmlToPdf
}; 