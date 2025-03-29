const mammoth = require('mammoth');
const path = require('path');
const fs = require('fs');

/**
 * 将Word文档转换为HTML
 * @param {string} filePath - Word文档路径
 * @param {string} outputDir - 输出目录
 * @returns {Promise<object>} - 包含转换结果的对象
 */
async function convertDocxToHtml(filePath, outputDir = 'temp') {
    try {
        // 确保输出目录存在
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }
        
        // 确保图片目录存在
        const imageDir = path.join('public', 'images', 'temp');
        if (!fs.existsSync(imageDir)) {
            fs.mkdirSync(imageDir, { recursive: true });
        }
        
        // 转换选项
        const options = {
            // 自定义图片处理 - 返回Promise
            convertImage: mammoth.images.imgElement(function(image) {
                // 生成唯一的图片文件名
                const imageName = `image-${Date.now()}-${Math.round(Math.random() * 1E9)}.${image.contentType.split('/')[1]}`;
                const imagePath = path.join('public', 'images', 'temp', imageName);
                
                // 将图片保存到临时目录 - 使用异步的方式
                return image.read("base64").then(function(imageBuffer) {
                    // base64转buffer并写入文件
                    const buffer = Buffer.from(imageBuffer, 'base64');
                    fs.writeFileSync(imagePath, buffer);
                    
                    return {
                        src: `/images/temp/${imageName}`,
                        alt: image.altText || '文档图片'
                    };
                });
            }),
            // 保留格式
            styleMap: [
                "p[style-name='Heading 1'] => h1:fresh",
                "p[style-name='Heading 2'] => h2:fresh",
                "p[style-name='Heading 3'] => h3:fresh",
                "b => strong",
                "i => em",
                "u => u",
                "strike => s"
            ]
        };
        
        // 转换文档
        const result = await mammoth.convertToHtml({ path: filePath }, options);
        const html = enhanceHtml(result.value);
        
        // 生成输出文件名
        const fileName = `${path.basename(filePath, '.docx')}-${Date.now()}.html`;
        const outputPath = path.join(outputDir, fileName);
        
        // 写入增强的HTML文件
        fs.writeFileSync(outputPath, html);
        
        // 记录警告
        if (result.messages && result.messages.length > 0) {
            console.log('转换警告:', result.messages);
        }
        
        return {
            success: true,
            html: html,
            messages: result.messages || [],
            outputPath: outputPath
        };
    } catch (error) {
        console.error('转换Word文档失败:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * 增强HTML，添加额外的样式
 * @param {string} html - 原始HTML内容
 * @returns {string} - 增强后的HTML内容
 */
function enhanceHtml(html) {
    // 添加表格样式但保留原始内容
    let enhancedHtml = html;
    
    // 仅添加样式和类，不改变结构
    enhancedHtml = enhancedHtml.replace(/<table/g, '<table class="table table-bordered" style="width:100%; border-collapse: collapse;"');
    enhancedHtml = enhancedHtml.replace(/<td/g, '<td style="border: 1px solid #ddd; padding: 8px;"');
    enhancedHtml = enhancedHtml.replace(/<th/g, '<th style="border: 1px solid #ddd; padding: 8px; background-color: #f2f2f2;"');
    
    // 创建包含样式但保留原始HTML内容的文档
    return `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 15px; }
        th, td { border: 1px solid #ddd; padding: 8px; }
        th { background-color: #f2f2f2; }
        img { max-width: 100%; height: auto; display: inline-block; margin: 10px 0; }
        .table { width: 100%; margin-bottom: 1rem; color: #212529; }
        .table-bordered { border: 1px solid #dee2e6; }
        .table-bordered td, .table-bordered th { border: 1px solid #dee2e6; }
    </style>
</head>
<body>
    ${enhancedHtml}
</body>
</html>`;
}

module.exports = {
    convertDocxToHtml
};