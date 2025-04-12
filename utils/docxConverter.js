const path = require('path');
const fs = require('fs');
const HTMLtoDOCX = require('html-to-docx');
const os = require('os');
const crypto = require('crypto');
const supabaseClient = require('./supabaseClient');

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
        
        // 使用系统临时目录代替固定路径
        // 在AWS Lambda中，/tmp目录是唯一可写的目录
        const tempDir = os.tmpdir();
        const outputDir = path.join(tempDir, 'doc-convert');
        
        console.log('使用临时目录:', outputDir);
        
        // 创建目录，使用recursive选项确保父目录也被创建
        try {
            fs.mkdirSync(outputDir, { recursive: true });
            console.log('成功创建临时目录:', outputDir);
        } catch (mkdirError) {
            console.error('创建临时目录失败，尝试使用根临时目录:', tempDir, '错误:', mkdirError);
            // 如果创建失败，直接使用系统临时目录
        }
        
        // 生成一个唯一的输出文件名
        const timestamp = Date.now();
        // 确保使用可用的目录
        const finalOutputDir = fs.existsSync(outputDir) ? outputDir : tempDir;
        const outputHtmlPath = path.join(finalOutputDir, `doc-${timestamp}.html`);
        
        // 转换文档
        try {
            // 检查mammoth是否可用
            if (!mammoth || typeof mammoth.convertToHtml !== 'function') {
                throw new Error('mammoth模块不可用或未正确加载');
            }
            
            // 使用极简的转换选项
            const options = {
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
                // 改进图片处理：将图片上传到Supabase并返回URL
                convertImage: mammoth.images.imgElement(async function(image) {
                    try {
                        console.log('==========图片处理开始==========');
                        console.log('发现文档中的图片，准备提取...');
                        console.log('图片类型:', image.contentType);
                        
                        // 创建图片目录 - 使用系统临时目录而不是固定路径
                        const imgTempDir = path.join(tempDir, 'doc-images');
                        console.log('图片临时保存目录:', imgTempDir);
                        
                        if (!fs.existsSync(imgTempDir)) {
                            console.log('图片目录不存在，正在创建...');
                            try {
                                fs.mkdirSync(imgTempDir, { recursive: true });
                                console.log('图片目录创建成功:', imgTempDir);
                            } catch (mkdirError) {
                                console.error('创建图片目录失败:', mkdirError.message);
                                throw new Error(`无法创建图片目录: ${mkdirError.message}`);
                            }
                        }
                        
                        // 获取图片buffer
                        const buffer = image.read();
                        if (!buffer || buffer.length === 0) {
                            console.warn('警告：图片buffer为空');
                            throw new Error('图片数据为空');
                        }
                        
                        console.log('图片buffer类型:', typeof buffer);
                        console.log('图片buffer大小:', buffer.length, '字节');
                        
                        // 生成唯一的图片文件名 - 使用正确的扩展名
                        const extension = image.contentType ? 
                                         (image.contentType.split('/')[1] || 'png') : 'png';
                        const randomId = Math.floor(Math.random() * 10000);
                        const imgName = `doc-img-${timestamp}-${randomId}.${extension}`;
                        
                        // 上传图片到Supabase
                        const filePath = `images/doc-images/${imgName}`;
                        console.log('准备上传图片到Supabase:', filePath);
                        
                        const uploadResult = await supabaseClient.uploadFile(buffer, filePath);
                        
                        if (!uploadResult.success) {
                            console.error('图片上传到Supabase失败:', uploadResult.error);
                            throw new Error(`上传图片失败: ${uploadResult.error}`);
                        }
                        
                        console.log('图片上传成功，URL:', uploadResult.url);
                        
                        // 返回Supabase公共URL
                        return {
                            src: uploadResult.url,
                            alt: "文档图片",
                            'data-original': filePath, // 保存原始路径供后续处理
                            crossorigin: "anonymous" // 添加跨域属性
                        };
                    } catch (error) {
                        console.error('==========图片处理失败==========');
                        console.error('错误详情:', error.message);
                        
                        // 出错时尝试使用base64作为后备方案
                        try {
                            const buffer = image.read();
                            if (buffer && buffer.length > 0) {
                                const base64Image = buffer.toString('base64');
                                const dataUrl = `data:${image.contentType || 'image/png'};base64,${base64Image}`;
                                console.log('使用base64作为后备方案，数据URL长度:', dataUrl.length);
                                
                                return {
                                    src: dataUrl,
                                    alt: "文档图片(base64)",
                                    title: "上传失败，使用base64替代"
                                };
                            }
                        } catch (fallbackError) {
                            console.error('base64后备方案也失败:', fallbackError);
                        }
                        
                        // 返回错误占位图片
                        return {
                            src: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+P+/HgAFdwI3QlMYkQAAAABJRU5ErkJggg==",
                            alt: "图片处理失败",
                            title: error.message
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
            const result = await mammoth.convertToHtml({
                path: docxFilePath,
                ...options
            });
            let html = result.value;
            
            // 记录原始HTML长度
            console.log('转换后的原始HTML长度:', html.length);
            
            // 进一步清理HTML内容
            html = cleanupHtml(html);
            console.log('清理后的HTML长度:', html.length);
            
            // 检查HTML中是否包含正确的图片引用
            const imageResults = checkHtmlImages(html);
            
            // 如果检测到有Base64图片，进行额外处理
            if (imageResults.some(img => img.startsWith('data:'))) {
                console.log('检测到Base64图片，进行后处理转换为文件...');
                html = await convertBase64ImagesToFiles(html);
                console.log('Base64图片处理完成，重新检查HTML...');
                checkHtmlImages(html);
            }
            
            // 添加最精简的样式和结构
            const minimalHtml = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>body{font-family:Arial;margin:10px}h1,h2,h3{color:#333}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ddd;padding:4px}img{max-width:100%;height:auto}</style></head><body>${html}</body></html>`;
            
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

/**
 * 检查HTML中的图片标签是否正确
 * @param {string} html - HTML内容
 * @returns {Array<string>} - 图片URL数组
 */
function checkHtmlImages(html) {
    const imgPattern = /<img[^>]*src="([^"]+)"[^>]*>/g;
    const images = [];
    let match;
    let base64Count = 0;
    let filePathCount = 0;
    
    while ((match = imgPattern.exec(html)) !== null) {
        const imgSrc = match[1];
        images.push(imgSrc);
        
        // 检查是否为文件路径而非base64
        if (imgSrc.startsWith('data:')) {
            base64Count++;
            console.warn('警告: 检测到BASE64图片，而非文件路径:', imgSrc.substring(0, 50) + '...');
        } else {
            filePathCount++;
            console.log('检测到图片路径:', imgSrc);
            
            // 检查文件是否实际存在
            if (imgSrc.startsWith('/images/temp/')) {
                const imgPath = path.join(__dirname, '..', 'public', imgSrc);
                if (fs.existsSync(imgPath)) {
                    console.log('图片文件存在:', imgPath);
                } else {
                    console.error('错误: 图片文件不存在:', imgPath);
                }
            }
        }
    }
    
    // 添加统计信息
    console.log(`HTML中共检测到${images.length}个图片标签`);
    console.log(`- 使用文件路径的图片: ${filePathCount}个`);
    console.log(`- 使用BASE64的图片: ${base64Count}个`);
    
    if (base64Count > 0) {
        console.warn(`警告: 仍有${base64Count}张图片使用BASE64编码，未成功转换为文件路径`);
    }
    
    return images;
}

/**
 * 将HTML中的Base64图片转换为文件
 * @param {string} html - 原始HTML内容
 * @returns {string} - 更新后的HTML内容
 */
async function convertBase64ImagesToFiles(html) {
    console.log('开始将Base64图片转换为文件...');
    
    // 查找所有Base64图片
    const base64Pattern = /<img[^>]*src="data:([^;]+);base64,([^"]+)"[^>]*>/g;
    let updatedHtml = html;
    let count = 0;
    let match;
    const promises = [];
    const replacements = [];
    
    // 第一阶段：收集所有需要替换的图片和准备上传任务
    while ((match = base64Pattern.exec(html)) !== null) {
        try {
            const mimeType = match[1];
            const base64Data = match[2];
            const fullImgTag = match[0];
            
            // 获取文件扩展名
            const extension = mimeType.split('/')[1] || 'png';
            
            // 生成唯一的文件名
            const timestamp = Date.now() + count; // 确保每个图片名称唯一
            const randomId = Math.floor(Math.random() * 10000);
            const imgName = `extracted-${timestamp}-${randomId}.${extension}`;
            
            // 解码Base64
            const buffer = Buffer.from(base64Data, 'base64');
            
            // 准备上传到Supabase
            const filePath = `images/extracted/${imgName}`;
            console.log(`准备上传Base64图片 #${count+1}: ${filePath} (${buffer.length}字节)`);
            
            // 保存上传任务和替换信息
            promises.push(supabaseClient.uploadFile(buffer, filePath));
            replacements.push({
                fullImgTag,
                filePath
            });
            
            count++;
        } catch (error) {
            console.error('处理Base64图片失败:', error.message);
        }
    }
    
    // 第二阶段：并行上传所有图片
    console.log(`开始上传 ${promises.length} 个Base64图片到Supabase...`);
    const results = await Promise.all(promises);
    
    // 第三阶段：替换HTML中的所有Base64为URL
    for (let i = 0; i < results.length; i++) {
        const result = results[i];
        const replacement = replacements[i];
        
        if (result.success) {
            // 替换HTML中的Base64为Supabase URL
            const imgTagContent = replacement.fullImgTag.match(/src="[^"]+"/)[0];
            const newImgTag = replacement.fullImgTag.replace(
                imgTagContent, 
                `src="${result.url}" data-original="${replacement.filePath}" crossorigin="anonymous"`
            );
            updatedHtml = updatedHtml.replace(replacement.fullImgTag, newImgTag);
            console.log(`成功替换图片 #${i+1}, URL: ${result.url}`);
        } else {
            console.error(`图片 #${i+1} 上传失败:`, result.error);
            // 保留原始Base64，不做替换
        }
    }
    
    console.log(`完成转换: ${count}个Base64图片已处理，${results.filter(r => r.success).length}个成功上传`);
    return updatedHtml;
}

/**
 * 将HTML文件转换为DOCX格式
 * @param {string} htmlFilePath HTML文件路径
 * @returns {string} 生成的DOCX文件路径
 */
async function convertHtmlToDocx(htmlFilePath) {
    try {
        console.log(`开始将HTML转换为DOCX: ${htmlFilePath}`);
        
        if (!fs.existsSync(htmlFilePath)) {
            throw new Error(`HTML文件不存在: ${htmlFilePath}`);
        }
        
        const htmlContent = fs.readFileSync(htmlFilePath, 'utf8');
        
        // 预处理HTML，确保图片路径正确
        const processedHtml = preprocessHtmlForDocx(htmlContent);
        
        // 创建一个临时的预处理HTML文件
        const tempHtmlPath = htmlFilePath.replace('.html', '-for-docx.html');
        fs.writeFileSync(tempHtmlPath, processedHtml);
        
        // 生成输出文件路径
        const outputDir = path.join(path.dirname(htmlFilePath), '..', 'downloads');
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }
        
        const outputFilename = path.basename(htmlFilePath, '.html') + '.docx';
        const outputPath = path.join(outputDir, outputFilename);
        
        console.log(`将HTML转换为DOCX: ${tempHtmlPath} => ${outputPath}`);
        
        // 使用html-to-docx库进行转换
        const options = {
            title: '文档转换',
            margin: {
                top: 1440,  // 25.4 mm
                right: 1440,
                bottom: 1440,
                left: 1440,
            },
            header: {
                default: ' ',
                first: ' ',
                even: ' ',
            },
            footer: {
                default: ' ',
                first: ' ',
                even: ' ',
            },
        };
        
        // 进行转换
        const buffer = await HTMLtoDOCX(processedHtml, null, options);
        
        // 保存文件
        fs.writeFileSync(outputPath, buffer);
        
        console.log(`DOCX文件生成成功: ${outputPath}`);
        
        // 清理临时文件
        try {
            fs.unlinkSync(tempHtmlPath);
        } catch (e) {
            console.warn(`清理临时文件失败: ${tempHtmlPath} - ${e.message}`);
        }
        
        return outputPath;
    } catch (error) {
        console.error('HTML转DOCX失败:', error);
        throw error;
    }
}

/**
 * 预处理HTML内容，准备转换为DOCX
 * @param {string} htmlContent 原始HTML内容
 * @returns {string} 处理后的HTML内容
 */
function preprocessHtmlForDocx(htmlContent) {
    try {
        console.log('处理HTML内容，准备转换为DOCX...');
        
        // 1. 确保所有图片路径都是绝对路径
        // 检查是否有相对路径的图片
        let processed = htmlContent;
        
        // 替换所有相对路径的图片为绝对路径
        // 特别处理上色后的图片路径
        processed = processed.replace(/<img[^>]+src=["'](?!\w+:\/\/)([^"']+)["']/gi, (match, src) => {
            // 如果是相对路径，转换为绝对路径
            if (src.startsWith('./') || src.startsWith('../')) {
                src = src.replace(/^\.\.\/|^\.\//g, '');
            }
            
            // 如果包含"_colorized"，确保优先使用上色版本
            const isColorized = src.includes('_colorized');
            if (isColorized) {
                console.log(`DOCX处理: 发现上色图片 ${src}`);
            }
            
            // 确保路径正确，根据实际情况调整
            if (!src.startsWith('/')) {
                src = '/' + src;
            }
            
            // 把src中的双斜杠替换为单斜杠
            src = src.replace(/\/\//g, '/');
            
            // 返回替换后的图片标签
            const newSrc = path.join(__dirname, '..', 'public' + src).replace(/\\/g, '/');
            return match.replace(/src=["'][^"']+["']/, `src="${newSrc}"`);
        });
        
        // 2. 为没有宽度和高度的图片添加默认值
        processed = processed.replace(/<img(?![^>]*width)[^>]*>/gi, (match) => {
            return match.replace(/<img/, '<img width="100%"');
        });
        
        // 3. 确保表格有边框
        processed = processed.replace(/<table(?![^>]*border)[^>]*>/gi, '<table border="1" cellspacing="0" cellpadding="5" style="border-collapse: collapse;">');
        
        // 4. 确保段落有合适的样式
        processed = processed.replace(/<p(?![^>]*style)[^>]*>/gi, '<p style="margin: 6pt 0; line-height: 1.5;">');
        
        // 5. 确保标题有合适的样式
        processed = processed.replace(/<h1(?![^>]*style)[^>]*>/gi, '<h1 style="font-size: 18pt; font-weight: bold; margin: 12pt 0;">');
        processed = processed.replace(/<h2(?![^>]*style)[^>]*>/gi, '<h2 style="font-size: 16pt; font-weight: bold; margin: 10pt 0;">');
        processed = processed.replace(/<h3(?![^>]*style)[^>]*>/gi, '<h3 style="font-size: 14pt; font-weight: bold; margin: 8pt 0;">');
        
        console.log('HTML内容处理完成，准备转换为DOCX');
        return processed;
    } catch (error) {
        console.error('预处理HTML内容失败:', error);
        return htmlContent; // 出错时返回原始内容
    }
}

/**
 * 清理文件路径，确保它是有效的 Supabase 存储键
 * @param {string} filePath - 原始文件路径
 * @returns {string} - 清理后的文件路径
 */
function sanitizeFilePath(filePath) {
    // 分离文件路径和扩展名
    const extname = path.extname(filePath);
    const basename = path.basename(filePath, extname);
    const dirname = path.dirname(filePath);
    
    // 生成 MD5 哈希作为文件名
    const hash = crypto.createHash('md5').update(basename).digest('hex');
    
    // 重建文件路径，只使用哈希作为文件名
    const sanitizedBasename = hash.substring(0, 20); // 使用部分哈希值
    const sanitizedFilePath = path.join(dirname, sanitizedBasename + extname);
    
    // 确保路径分隔符是正斜杠（/），因为Supabase要求这样
    return sanitizedFilePath.replace(/\\/g, '/');
}

module.exports = {
    convertDocxToHtml: exports.convertDocxToHtml,
    convertHtmlToDocx,
    sanitizeFilePath
};