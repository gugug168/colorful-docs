const path = require('path');
const fs = require('fs');

// 安全地加载mammoth模块
let mammoth;
try {
  mammoth = require('mammoth');
  console.log('mammoth模块加载成功');
} catch (err) {
  console.error('加载mammoth模块失败:', err.message);
  // 创建一个虚拟的mammoth对象以避免程序崩溃
  mammoth = {
    convertToHtml: async () => {
      return {
        value: '<p>无法转换文档，mammoth模块未正确加载</p>',
        messages: [{ type: 'error', message: 'mammoth模块加载失败' }]
      };
    },
    images: {
      imgElement: () => null
    }
  };
}

/**
 * 将DOCX文件转换为HTML格式
 * @param {string} docxFilePath - Word文档路径
 * @returns {Promise<object>} - 包含HTML内容和HTML文件路径的对象
 */
exports.convertDocxToHtml = async function(docxFilePath) {
    try {
        console.log('开始转换Word文档:', docxFilePath);
        
        // 检查文件是否存在
        if (!fs.existsSync(docxFilePath)) {
            throw new Error(`Word文件不存在: ${docxFilePath}`);
        }
        
        // 确保输出目录存在
        const outputDir = path.join(__dirname, '..', 'temp');
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }
        
        // 生成一个唯一的输出文件名
        const timestamp = Date.now();
        const outputHtmlPath = path.join(outputDir, `doc-${timestamp}.html`);
        
        // 转换文档
        try {
            // 检查mammoth是否可用
            if (!mammoth || typeof mammoth.convertToHtml !== 'function') {
                throw new Error('mammoth模块不可用或未正确加载');
            }
            
            // 使用极简的转换选项
            const options = {
                path: docxFilePath,
                // 最小化的转换设置，移除大部分样式
                transformDocument: mammoth.transforms.paragraph(function(element) {
                    // 仅保留标题信息，移除所有其他样式
                    if (element.styleName && element.styleName.startsWith('Heading')) {
                        const headingLevel = element.styleName.replace('Heading', '');
                        if (/^[1-6]$/.test(headingLevel)) {
                            return { ...element, tag: `h${headingLevel}` };
                        }
                    }
                    return element;
                }),
                // 改进图片处理：保存为文件而不是base64编码
                convertImage: mammoth.images.imgElement(function(image) {
                    try {
                        // 创建图片目录
                        const imgDir = path.join(outputDir, 'images');
                        if (!fs.existsSync(imgDir)) {
                            fs.mkdirSync(imgDir, { recursive: true });
                        }
                        
                        // 生成唯一的图片文件名
                        const imgName = `img-${Date.now()}-${Math.floor(Math.random() * 10000)}.png`;
                        const imgPath = path.join(imgDir, imgName);
                        
                        // 将图片保存为文件
                        const buffer = image.read();
                        fs.writeFileSync(imgPath, buffer);
                        
                        // 返回相对路径的图片URL，避免使用base64
                        console.log(`图片已保存到文件: ${imgPath}`);
                        
                        return {
                            src: `images/${imgName}`,
                            alt: "文档图片",
                            class: "doc-image"
                        };
                    } catch (error) {
                        console.error('图片处理失败:', error);
                        return {
                            alt: "图片加载失败"
                        };
                    }
                }),
                // 移除额外的文档属性
                styleMap: [
                    "p => p",
                    "b => strong",
                    "i => em",
                    "u => u",
                    "table => table"
                ].join("\n"),
                ignoreEmptyParagraphs: true
            };
            
            console.log('使用极简转换模式...');
            const result = await mammoth.convertToHtml(options);
            let html = result.value;
            
            // 记录原始HTML长度
            console.log('转换后的原始HTML长度:', html.length);
            
            // 进一步清理HTML内容
            html = cleanupHtml(html);
            console.log('清理后的HTML长度:', html.length);
            
            // 添加最精简的样式和结构
            const minimalHtml = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>body{font-family:Arial;margin:10px}h1,h2,h3{color:#333}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ddd;padding:4px}</style></head><body>${html}</body></html>`;
            
            // 保存HTML文件
            fs.writeFileSync(outputHtmlPath, minimalHtml, 'utf8');
            console.log('Word文档转换成功，保存到:', outputHtmlPath);
            console.log('最终HTML大小:', minimalHtml.length, '字节');
            
            // 替换Windows路径分隔符为URL适用的格式
            const normalizedPath = outputHtmlPath.replace(/\\/g, '/');
            
            return {
                html: minimalHtml,
                htmlPath: normalizedPath
            };
        } catch (convertError) {
            console.error('Word文档转换过程中出错:', convertError);
            
            // 转换失败时，创建一个极简的错误页面
            const errorHtml = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>错误</title></head><body><div style="color:red">转换错误: ${convertError.message}</div></body></html>`;
            
            // 保存错误HTML
            fs.writeFileSync(outputHtmlPath, errorHtml, 'utf8');
            console.log('创建了错误页面:', outputHtmlPath);
            
            return {
                html: errorHtml,
                htmlPath: outputHtmlPath.replace(/\\/g, '/'),
                error: convertError.message
            };
        }
    } catch (error) {
        console.error('Word转换器出错:', error);
        throw error;
    }
};

/**
 * 清理HTML内容，移除不必要的标记和属性
 * @param {string} html - 原始HTML内容
 * @returns {string} - 清理后的HTML
 */
function cleanupHtml(html) {
    // 移除HTML中的class和id属性
    let cleaned = html.replace(/\s(class|id|style)="[^"]*"/g, '');
    
    // 移除空白段落
    cleaned = cleaned.replace(/<p>\s*<\/p>/g, '');
    
    // 移除多余的空格
    cleaned = cleaned.replace(/\s{2,}/g, ' ');
    
    // 移除空标签属性
    cleaned = cleaned.replace(/\s+>/g, '>');
    
    // 移除注释
    cleaned = cleaned.replace(/<!--[\s\S]*?-->/g, '');
    
    // 移除div容器，保留内容
    cleaned = cleaned.replace(/<div[^>]*>([\s\S]*?)<\/div>/g, '$1');
    
    // 移除换行符
    cleaned = cleaned.replace(/\n/g, '');
    
    return cleaned;
}

/**
 * 转换段落，简化不必要的样式标记
 */
function transformParagraph(element) {
    // 简化处理，移除多余的样式标记
    if (element.styleName && element.styleName.startsWith('Heading')) {
        // 提取标题级别
        const headingLevel = element.styleName.replace('Heading', '');
        if (/^[1-6]$/.test(headingLevel)) {
            // 使用对应的h标签
            return { ...element, tag: `h${headingLevel}` };
        }
    }
    
    // 对于普通段落，使用默认的p标签
    return element;
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