const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');

/**
 * 基于简单规则的文档美化器
 * 这是一个简化版的处理器，无需AI API，适合新手使用
 * @param {string} htmlContent - 原始HTML内容
 * @returns {Promise<string>} - 美化后的HTML内容
 */
async function beautifyWithRules(htmlContent) {
    try {
        // 关键词列表 - 在实际应用中可以扩展这个列表
        const keywordsMap = {
            '重要': 'important',
            '注意': 'important',
            '关键': 'important',
            '警告': 'important',
            '核心': 'important',
            '必须': 'important',
            '特别': 'highlighted',
            '例如': 'highlighted',
            '如下': 'highlighted',
            '总结': 'highlighted',
            '结论': 'highlighted',
            '定义': 'highlighted'
        };
        
        // 替换关键词
        let processedHtml = htmlContent;
        
        // 对每个关键词进行处理
        for (const [keyword, className] of Object.entries(keywordsMap)) {
            // 使用正则表达式查找关键词及周围的文本
            const regex = new RegExp(`(${keyword}[^。.!?；;:：]+)`, 'g');
            processedHtml = processedHtml.replace(regex, `<span class="${className}">$1</span>`);
        }
        
        // 处理数字列表
        processedHtml = processedHtml.replace(/(\d+\.\s+[^<]+)/g, '<span class="highlighted">$1</span>');
        
        // 美化段落首句（假设首句通常包含段落主要观点）
        processedHtml = processedHtml.replace(/<p>(.*?[。.!?；;])/g, '<p><strong>$1</strong>');
        
        return processedHtml;
    } catch (error) {
        console.error('美化文档失败:', error);
        return htmlContent; // 出错时返回原始内容
    }
}

/**
 * 使用DEEPSEEK API对文档内容进行智能美化
 * 注意：这个功能需要有效的DEEPSEEK API密钥
 * @param {string} htmlContent - 原始HTML内容
 * @param {string} apiKey - DEEPSEEK API密钥
 * @param {string} targetFormat - 目标格式
 * @param {string} customRequirements - 用户自定义美化要求
 * @returns {Promise<string>} - 美化后的HTML内容
 */
async function beautifyWithDeepseek(htmlContent, apiKey, targetFormat = 'word', customRequirements = '') {
    if (!apiKey) {
        console.log('未提供DEEPSEEK API密钥，使用规则处理替代');
        return beautifyWithRules(htmlContent);
    }
    
    try {
        console.log('调用DEEPSEEK API美化文档...');
        console.log('使用的API密钥:', apiKey ? `${apiKey.substring(0, 5)}...${apiKey.substring(apiKey.length-5)}` : '未提供');
        console.log('目标格式:', targetFormat);
        
        // 提取所有图片标签并保存相关信息
        const imageRegex = /<img\s+[^>]*>/gi;
        const images = [];
        let matchImage;
        let htmlWithImageMarkers = htmlContent;
        
        // 收集所有图片标签
        while((matchImage = imageRegex.exec(htmlContent)) !== null) {
            const imgTag = matchImage[0];
            const altMatch = imgTag.match(/alt=["']([^"']*)["']/i);
            const srcMatch = imgTag.match(/src=["']([^"'<>]*)["']/i);
            const widthMatch = imgTag.match(/width=["']?(\d+)(%|px)?["']?/i);
            const heightMatch = imgTag.match(/height=["']?(\d+)(%|px)?["']?/i);
            
            // 获取尺寸信息，如果没有明确设置，设置默认值
            const width = widthMatch ? widthMatch[1] + (widthMatch[2] || 'px') : 'auto';
            const height = heightMatch ? heightMatch[1] + (heightMatch[2] || 'px') : 'auto';
            
            // 清理图片路径，确保不包含HTML标签
            const imgSrc = srcMatch ? srcMatch[1].replace(/<\/?[^>]+(>|$)/g, '') : '';
            
            // 保存图片的绝对和相对路径
            let absoluteSrc = imgSrc;
            let relativeSrc = imgSrc;
            
            // 确保图片路径可以被前端访问
            if (!imgSrc.startsWith('http') && !imgSrc.startsWith('data:') && !imgSrc.startsWith('/')) {
                // 如果是相对路径，确保添加正确的前缀路径
                relativeSrc = imgSrc;
                absoluteSrc = `/uploads/${imgSrc}`;
            }
            
            const imgData = {
                fullTag: imgTag,
                index: matchImage.index,
                src: imgSrc,
                absoluteSrc: absoluteSrc,
                relativeSrc: relativeSrc,
                alt: altMatch ? altMatch[1] : '图片',
                width: width,
                height: height,
                id: `img-${Date.now()}-${images.length}`
            };
            
            // 记录图片信息
            console.log(`提取图片: ID=${imgData.id}, SRC=${imgData.src}, ALT=${imgData.alt}`);
            
            // 创建图片占位标记，包含位置和尺寸信息
            const imageMarker = `<div class="image-placeholder" data-img-id="${imgData.id}" data-img-src="${imgData.relativeSrc}" style="width:${width};height:${height};margin:10px 0;background:#f0f0f0;border:1px dashed #ccc;text-align:center;padding:20px;">[图片占位：${imgData.alt}]</div>`;
            
            // 记录图片信息
            images.push(imgData);
            
            // 替换原始图片为占位标记
            htmlWithImageMarkers = htmlWithImageMarkers.replace(imgTag, imageMarker);
        }
        
        // 提取纯文本内容，保留HTML结构但移除与图片无关的标签
        const textContent = htmlWithImageMarkers.replace(/<(?!div class="image-placeholder")[^>]*>/g, '');
        
        // 检测文档类型和内容特征
        const isChildrenContent = /三年级|小学|儿童|学生|教育|课程|习题|测试卷|数学题|语文|英语|科学|课文/.test(textContent);
        const isAcademic = /论文|研究|引用|参考文献|abstract|conclusion|introduction|methodology|结论|摘要|图表|数据分析/.test(textContent);
        const isBusiness = /报告|公司|市场|销售|业务|计划|项目|方案|战略|商业|客户|产品|服务|营销/.test(textContent);
        
        // 构建基础AI提示
        let basePrompt = `
请作为专业排版专家美化以下文档。目标是创建排版精美、层次清晰、视觉吸引力强的文档，最终输出格式为${targetFormat === 'pdf' ? 'PDF' : 'Word文档'}。

【文档处理要求】：
1. 保留所有原始内容
2. 优化标题、段落和列表的排版
3. 保持文档结构清晰
4. 使用恰当的字体、颜色和间距
5. 确保整体视觉美观协调
`;

        // 添加用户自定义要求（如果有）
        if (customRequirements && customRequirements.trim()) {
            basePrompt += `
【用户自定义美化要求】：
${customRequirements.trim()}
`;
        }

        // 添加对图片占位符的特殊处理说明
        basePrompt += `
【重要提示】：文档中包含多个图片占位符 <div class="image-placeholder">，这些占位符将在处理后替换为实际图片。请确保：
1. 不要修改或删除这些占位符
2. 保持它们原有的位置和尺寸
3. 围绕这些占位符进行排版，但不要改变它们的结构

请根据内容特点选择合适的排版风格，直接输出美化后的完整HTML，并在HTML中添加必要的CSS样式。`;

        // 根据内容类型添加特定指示
        if (isChildrenContent) {
            basePrompt += `

【内容分析】：检测到这可能是儿童教育相关内容，请使用：
- 活泼、色彩丰富的设计
- 更大更清晰的字体
- 视觉引导和提示
- 分隔明确的内容块
- 友好生动的页面布局`;
        } else if (isAcademic) {
            basePrompt += `

【内容分析】：检测到这可能是学术或研究内容，请使用：
- 专业严谨的排版风格
- 清晰的标题层次结构
- 规范的引用和参考文献格式
- 表格和图表的专业处理
- 适合学术阅读的间距和字体`;
        } else if (isBusiness) {
            basePrompt += `

【内容分析】：检测到这可能是商业或报告内容，请使用：
- 简洁专业的商务风格
- 重点数据的视觉强调
- 清晰的信息层次
- 合适的商业配色方案
- 专业的图表和表格样式`;
        }

        // 添加API请求头部
        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        };
        
        // 构建API请求体
        const body = JSON.stringify({
            model: 'deepseek-chat',
            messages: [
                {
                    role: 'system',
                    content: '你是一位专业的文档排版和设计专家，擅长将普通文档转换为具有专业排版和美观设计的高质量文档。'
                },
                {
                    role: 'user',
                    content: `${basePrompt}\n\n以下是需要美化的文档内容：\n\n${htmlWithImageMarkers}`
                }
            ],
            temperature: 0.7,
            max_tokens: 4000
        });
        
        // 发送API请求
        const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
            method: 'POST',
            headers: headers,
            body: body
        });
        
        // 解析API响应
        const result = await response.json();
        
        // 检查响应是否成功
        if (!response.ok || !result.choices || !result.choices[0]) {
            console.error('DEEPSEEK API响应错误:', result);
            throw new Error('DEEPSEEK API响应错误: ' + (result.error?.message || JSON.stringify(result)));
        }
        
        // 获取AI生成的内容
        let processedHtml = result.choices[0].message.content;
        
        // 处理可能包含的代码块标记
        processedHtml = processedHtml.replace(/```html/g, '').replace(/```/g, '');
        
        // 恢复原始图片
        for (const img of images) {
            const imgPlaceholder = new RegExp(`<div class="image-placeholder"[^>]*data-img-id="${img.id}"[^>]*>.*?</div>`, 'g');
            // 使用相对路径生成img标签，确保在任何环境下都能正确加载
            const newImgTag = `<img src="${img.relativeSrc}" alt="${img.alt}" style="max-width:100%;height:auto;" data-original-src="${img.src}" />`;
            processedHtml = processedHtml.replace(imgPlaceholder, newImgTag);
        }
        
        // 返回处理后的HTML
        return processedHtml;
    } catch (error) {
        console.error('DEEPSEEK API处理失败:', error);
        console.log('使用规则处理作为备选...');
        return beautifyWithRules(htmlContent);
    }
}

/**
 * 使用AI服务美化文档
 * @param {string} htmlContent - 原始HTML内容
 * @param {string} apiKey - API密钥
 * @param {string} apiType - API类型
 * @param {string} targetFormat - 目标格式
 * @param {string} customRequirements - 用户自定义美化要求
 * @returns {Promise<string>} - 美化后的HTML内容
 */
async function beautifyWithAI(htmlContent, apiKey = null, apiType = 'deepseek', targetFormat = 'word', customRequirements = '') {
    // 如果没有API密钥，使用规则处理
    if (!apiKey) {
        console.log('未提供API密钥，使用规则处理');
        return beautifyWithRules(htmlContent);
    }
    
    // 根据API类型选择不同的处理方法
    switch (apiType.toLowerCase()) {
        case 'deepseek':
            return await beautifyWithDeepseek(htmlContent, apiKey, targetFormat, customRequirements);
        default:
            console.log(`不支持的API类型: ${apiType}，使用规则处理`);
            return beautifyWithRules(htmlContent);
    }
}

/**
 * 处理HTML内容并保存到文件
 * @param {string} htmlContent - 原始HTML内容
 * @param {string} outputDir - 输出目录
 * @param {string} apiKey - API密钥
 * @param {string} targetFormat - 目标格式
 * @param {string} customRequirements - 用户自定义美化要求
 * @returns {Promise<Object>} - 处理结果
 */
async function processAndSaveHtml(htmlContent, outputDir = 'temp', apiKey = null, targetFormat = 'word', customRequirements = '') {
    try {
        console.log(`处理HTML并保存到${outputDir}目录...`);
        
        // 创建输出目录（如果不存在）
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }
        
        // 使用AI处理内容
        console.log('调用AI处理文档内容...');
        console.log('目标格式:', targetFormat);
        
        if (customRequirements) {
            console.log('用户自定义要求:', customRequirements.substring(0, 100) + (customRequirements.length > 100 ? '...' : ''));
        }
        
        const beautifiedHtml = await beautifyWithAI(htmlContent, apiKey, 'deepseek', targetFormat, customRequirements);
        
        // 生成输出文件路径
        const timestamp = Date.now();
        const outputFileName = `beautified-${timestamp}.html`;
        const outputPath = path.join(outputDir, outputFileName);
        
        // 保存到文件
        fs.writeFileSync(outputPath, beautifiedHtml);
        console.log(`美化后的文档已保存到: ${outputPath}`);
        
        // 返回结果
        return {
            success: true,
            html: beautifiedHtml,
            path: outputPath
        };
    } catch (error) {
        console.error('处理HTML内容时出错:', error);
        // 发生错误时返回原始内容
        return {
            success: false,
            html: htmlContent,
            error: error.message
        };
    }
}

module.exports = {
    beautifyWithRules,
    beautifyWithAI,
    beautifyWithDeepseek,
    processAndSaveHtml
}; 