// AI文档优化工具
const fs = require('fs');
const path = require('path');
const axios = require('axios');

// 支持的API类型常量
const API_TYPES = {
    OPENAI: 'openai',
    DEEPSEEK: 'deepseek',
    QIANWEN: 'qianwen',
    QWQ: 'qwq'
};

/**
 * 使用AI处理HTML内容并保存
 * @param {string} htmlContent HTML内容
 * @param {string} outputDir 输出目录
 * @param {object} apiConfig API配置对象，包含apiKey和apiType
 * @param {string} targetFormat 目标格式 (word或pdf)
 * @param {string} customRequirements 用户自定义美化要求
 * @returns {object} 处理结果
 */
async function processAndSaveHtml(htmlContent, outputDir, apiConfig, targetFormat = 'word', customRequirements = '') {
    try {
        // 确保输出目录存在
        const outputPath = path.resolve(outputDir);
        if (!fs.existsSync(outputPath)) {
            fs.mkdirSync(outputPath, { recursive: true });
        }

        // 根据目标格式生成不同的优化提示
        const optimizationPrompt = generateOptimizationPrompt(htmlContent, targetFormat, customRequirements);

        // 使用AI处理内容
        const processedHtml = await processWithAI(htmlContent, optimizationPrompt, apiConfig);

        // 保存处理后的内容
        const timestamp = Date.now();
        const outputFilePath = path.join(outputPath, `processed-${timestamp}.html`);
        fs.writeFileSync(outputFilePath, processedHtml);

        return {
            success: true,
            html: processedHtml,
            outputPath: outputFilePath
        };
    } catch (error) {
        console.error('AI处理HTML内容时出错:', error);
        throw error;
    }
}

/**
 * 根据目标格式和自定义要求生成优化提示
 * @param {string} htmlContent 原始HTML内容
 * @param {string} targetFormat 目标格式
 * @param {string} customRequirements 用户自定义要求
 * @returns {string} 优化提示
 */
function generateOptimizationPrompt(htmlContent, targetFormat, customRequirements = '') {
    // 极简提示词，减少token占用
    let prompt = `美化HTML文档并保持原始内容结构。`;

    // 根据目标格式添加最简洁的特定提示
    if (targetFormat === 'word') {
        prompt += `使其适合Word格式，添加合适标题样式和表格格式，确保可读性好。`;
    } else if (targetFormat === 'pdf') {
        prompt += `适合PDF格式，优化排版和页面布局，保持打印友好。`;
    }

    // 添加用户自定义要求（如果有）
    if (customRequirements && customRequirements.trim()) {
        prompt += `用户要求:${customRequirements}`;
    }

    return prompt;
}

/**
 * 使用AI处理HTML内容，根据API类型选择不同的API处理
 * @param {string} htmlContent 原始HTML内容
 * @param {string} prompt 优化提示
 * @param {object} apiConfig API配置，包含apiKey和apiType
 * @returns {string} 处理后的HTML内容
 */
async function processWithAI(htmlContent, prompt, apiConfig) {
    const { apiKey, apiType = API_TYPES.DEEPSEEK, apiParams } = apiConfig;
    
    if (!apiKey) {
        throw new Error('未提供API密钥');
    }
    
    // 获取API类型对应的参数，如果不存在则使用默认值
    const params = apiParams && apiParams[apiType.toLowerCase()] ? 
                  apiParams[apiType.toLowerCase()] : 
                  { temperature: 0.7, max_tokens: 4000 };
    
    // 根据API类型选择不同的处理函数
    switch (apiType.toLowerCase()) {
        case API_TYPES.OPENAI:
            return await processWithOpenAI(htmlContent, prompt, apiKey, params);
        case API_TYPES.DEEPSEEK:
            return await processWithDeepseek(htmlContent, prompt, apiKey, params);
        case API_TYPES.QIANWEN:
            return await processWithQianwen(htmlContent, prompt, apiKey, params);
        case API_TYPES.QWQ:
            return await processWithQwq(htmlContent, prompt, apiKey, params);
        default:
            throw new Error(`不支持的API类型: ${apiType}`);
    }
}

/**
 * 使用OpenAI API处理HTML内容
 * @param {string} htmlContent 原始HTML内容
 * @param {string} prompt 优化提示
 * @param {string} apiKey OpenAI API密钥
 * @param {object} params 高级参数
 * @returns {string} 处理后的HTML内容
 */
async function processWithOpenAI(htmlContent, prompt, apiKey, params = {}) {
    try {
        // 编写API请求内容
        const userInput = `${prompt}\n\n这是要优化的HTML内容:\n\n${htmlContent}`;
        
        // 使用配置的参数或默认值
        const temperature = params.temperature || 0.7;
        const max_tokens = params.max_tokens || 4000;
        
        console.log(`OpenAI API参数: temperature=${temperature}, max_tokens=${max_tokens}`);
        
        // 调用OpenAI API
        const response = await axios.post(
            'https://api.openai.com/v1/chat/completions',
            {
                model: 'gpt-4-turbo', // 使用适当的模型
                messages: [
                    { role: 'system', content: '你是一个专业的文档美化和排版专家。你擅长将简单的HTML文档转换为视觉吸引力强、结构清晰的文档。保持原始内容的完整性，同时改进其呈现方式。' },
                    { role: 'user', content: userInput }
                ],
                temperature: temperature,
                max_tokens: max_tokens
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                }
            }
        );

        // 提取响应中的HTML内容
        const assistantResponse = response.data.choices[0].message.content;
        return extractHtmlFromResponse(assistantResponse);
    } catch (error) {
        console.error('调用OpenAI API时出错:', error);
        if (error.response) {
            console.error('API响应:', error.response.data);
        }
        throw new Error(`OpenAI处理失败: ${error.message}`);
    }
}

/**
 * 预处理HTML内容，适应AI处理所需
 * @param {string} htmlContent 原始HTML内容
 * @returns {string} 处理后的HTML内容
 */
function preprocessHtmlForAI(htmlContent) {
    let processedHtml = htmlContent;
    
    // 1. 移除不必要的空白字符和注释
    processedHtml = processedHtml.replace(/\s+/g, ' ');
    processedHtml = processedHtml.replace(/<!--[\s\S]*?-->/g, '');
    
    // 2. 替换所有图片标签为占位符
    // 先保存所有图片引用信息，用于后续恢复
    const imageReferences = [];
    let imageCounter = 0;
    
    processedHtml = processedHtml.replace(/<img[^>]+src="([^"]+)"[^>]*>/gi, function(match, src) {
        // 提取alt属性
        const altMatch = match.match(/alt="([^"]*)"/i);
        const alt = altMatch ? altMatch[1] : "图片";
        
        // 保存图片信息
        const imageId = `img-placeholder-${imageCounter++}`;
        imageReferences.push({
            id: imageId,
            src: src,
            alt: alt,
            originalTag: match
        });
        
        // 返回简化的图片占位符标签
        return `<img id="${imageId}" src="image-placeholder.png" alt="[图片占位 - AI处理时保留此标签]" class="image-placeholder" />`;
    });
    
    // 3. 如果内容超过限制，进行智能截断
    const maxContentLength = 10000; // 最大内容长度
    if (processedHtml.length > maxContentLength) {
        // 提取头部信息
        const headMatch = processedHtml.match(/<head>[\s\S]*?<\/head>/);
        const headContent = headMatch ? headMatch[0] : '<head></head>';
        
        // 提取正文开始部分
        const bodyStartMatch = processedHtml.match(/<body[^>]*>([\s\S]{0,3000})/);
        const bodyStart = bodyStartMatch ? bodyStartMatch[1] : '';
        
        // 提取正文结束部分
        const bodyEndMatch = processedHtml.match(/([\s\S]{0,2000})<\/body>/);
        const bodyEnd = bodyEndMatch ? bodyEndMatch[1] : '';
        
        // 重组HTML结构
        processedHtml = `<!DOCTYPE html><html>${headContent}<body>${bodyStart}...(中间内容已省略以减少token数)...${bodyEnd}</body></html>`;
    }
    
    console.log(`预处理后HTML长度: ${processedHtml.length}, 替换了${imageCounter}个图片为占位符`);
    return { processedHtml, imageReferences };
}

/**
 * 使用DeepSeek API处理HTML内容
 * @param {string} htmlContent 原始HTML内容
 * @param {string} prompt 优化提示
 * @param {string} apiKey DeepSeek API密钥
 * @param {object} params 高级参数
 * @returns {string} 处理后的HTML内容
 */
async function processWithDeepseek(htmlContent, prompt, apiKey, params = {}) {
    try {
        // 使用配置的参数或默认值
        const temperature = params.temperature || 0.5; // 默认降低到0.5
        const max_tokens = params.max_tokens || 4000;
        
        console.log(`DeepSeek API参数: temperature=${temperature}, max_tokens=${max_tokens}`);
        console.log(`DeepSeek API密钥长度: ${apiKey.length}`);
        console.log(`原始HTML内容长度: ${htmlContent.length}`);
        
        if (!apiKey || apiKey.length < 10) {
            throw new Error('无效的API密钥，请检查配置');
        }
        
        // 预处理HTML内容，替换图片为占位符
        const { processedHtml, imageReferences } = preprocessHtmlForAI(htmlContent);
        
        // 扩展提示，强调保留图片占位符
        const enhancedPrompt = `${prompt}\n\n重要提示：文档中包含图片占位符标签，请保留所有<img>标签及其属性，不要改变它们的位置和结构。`;
        
        // 编写API请求内容
        const userInput = `${enhancedPrompt}\n\n这是要优化的HTML内容(已优化大小):\n\n${processedHtml}`;
        console.log(`发送给API的内容长度: ${userInput.length}`);
        
        // 添加超时和重试设置
        const axiosOptions = {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            timeout: 60000, // 60秒超时
        };
        
        // 使用最新的DeepSeek API参数格式
        const requestBody = {
            model: 'deepseek-chat', // 确保使用正确的模型名称
            messages: [
                { 
                    role: 'system', 
                    content: '你是一个专业的文档美化和排版专家。你擅长将HTML文档转换为视觉吸引力强、结构清晰的文档。保持原始内容的完整性，同时改进其呈现方式。请仅返回美化后的HTML，不要添加解释性文字。特别注意：保留所有图片标签及其位置。' 
                },
                { 
                    role: 'user', 
                    content: userInput 
                }
            ],
            temperature: temperature,
            max_tokens: max_tokens,
            stream: false // 明确指定不使用流式传输
        };
        
        // 调用DeepSeek API
        console.log('开始请求DeepSeek API...');
        const response = await axios.post(
            'https://api.deepseek.com/v1/chat/completions',
            requestBody,
            axiosOptions
        );

        console.log('DeepSeek API返回状态码:', response.status);
        
        // 提取响应中的HTML内容
        if (!response.data || !response.data.choices || !response.data.choices[0]) {
            console.error('DeepSeek API响应格式异常:', response.data);
            throw new Error('API响应格式异常，请检查API是否更新');
        }
        
        const assistantResponse = response.data.choices[0].message.content;
        console.log('DeepSeek响应内容长度:', assistantResponse.length);
        
        let extractedHTML = extractHtmlFromResponse(assistantResponse);
        console.log('提取的HTML内容长度:', extractedHTML.length);
        
        // 恢复图片引用
        if (imageReferences && imageReferences.length > 0) {
            console.log(`需要恢复${imageReferences.length}个图片引用`);
            
            // 遍历所有图片引用并恢复到响应HTML中
            imageReferences.forEach(imgRef => {
                const placeholderRegex = new RegExp(`<img[^>]*id=["']${imgRef.id}["'][^>]*>`, 'gi');
                
                // 检查占位符是否存在
                if (extractedHTML.match(placeholderRegex)) {
                    // 替换占位符为原始图片标签的src属性
                    extractedHTML = extractedHTML.replace(placeholderRegex, match => {
                        // 保留AI可能更新的其他属性，但恢复原始src
                        return match.replace(/src=["'][^"']*["']/, `src="${imgRef.src}"`);
                    });
                    console.log(`已恢复图片: ${imgRef.id} -> ${imgRef.src}`);
                } else {
                    console.warn(`未找到图片占位符: ${imgRef.id}`);
                }
            });
            
            console.log('图片引用恢复完成');
        }
        
        return extractedHTML;
    } catch (error) {
        console.error('调用DeepSeek API时出错:', error);
        if (error.response) {
            console.error('API响应状态:', error.response.status);
            console.error('API错误详情:', error.response.data);
        }
        throw new Error(`DeepSeek处理失败: ${error.message}`);
    }
}

/**
 * 使用通义千问API处理HTML内容
 * @param {string} htmlContent 原始HTML内容
 * @param {string} prompt 优化提示
 * @param {string} apiKey 通义千问API密钥
 * @param {object} params 高级参数
 * @returns {string} 处理后的HTML内容
 */
async function processWithQianwen(htmlContent, prompt, apiKey, params = {}) {
    try {
        // 编写API请求内容
        const userInput = `${prompt}\n\n这是要优化的HTML内容:\n\n${htmlContent}`;
        
        // 使用配置的参数或默认值
        const temperature = params.temperature || 0.7;
        const max_tokens = params.max_tokens || 4000;
        
        console.log(`千问 API参数: temperature=${temperature}, max_tokens=${max_tokens}`);
        
        // 调用通义千问API
        const response = await axios.post(
            'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation',
            {
                model: 'qwen-turbo',
                input: {
                    messages: [
                        { role: 'system', content: '你是一个专业的文档美化和排版专家。你擅长将简单的HTML文档转换为视觉吸引力强、结构清晰的文档。保持原始内容的完整性，同时改进其呈现方式。' },
                        { role: 'user', content: userInput }
                    ]
                },
                parameters: {
                    temperature: temperature,
                    max_tokens: max_tokens
                }
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                }
            }
        );

        // 提取响应中的HTML内容
        const assistantResponse = response.data.output.text;
        return extractHtmlFromResponse(assistantResponse);
    } catch (error) {
        console.error('调用通义千问API时出错:', error);
        if (error.response) {
            console.error('API响应:', error.response.data);
        }
        throw new Error(`通义千问处理失败: ${error.message}`);
    }
}

/**
 * 使用QWQ 32B API处理HTML内容
 * @param {string} htmlContent 原始HTML内容
 * @param {string} prompt 优化提示
 * @param {string} apiKey QWQ API密钥
 * @param {object} params 高级参数
 * @returns {string} 处理后的HTML内容
 */
async function processWithQwq(htmlContent, prompt, apiKey, params = {}) {
    try {
        // 编写API请求内容
        const userInput = `${prompt}\n\n这是要优化的HTML内容:\n\n${htmlContent}`;
        
        // 使用配置的参数或默认值
        const temperature = params.temperature || 0.7;
        const max_tokens = params.max_tokens || 8192;
        
        console.log(`QWQ API参数: temperature=${temperature}, max_tokens=${max_tokens}`);
        
        // 调用QWQ API - 使用通义千问的API格式
        const response = await axios.post(
            'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation',
            {
                model: 'free:QwQ-32B',
                input: {
                    messages: [
                        { role: 'system', content: '你是一个专业的文档美化和排版专家。你擅长将简单的HTML文档转换为视觉吸引力强、结构清晰的文档。保持原始内容的完整性，同时改进其呈现方式。' },
                        { role: 'user', content: userInput }
                    ]
                },
                parameters: {
                    temperature: temperature,
                    max_tokens: max_tokens
                }
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                }
            }
        );

        // 提取响应中的HTML内容 - 通义千问API响应格式
        const assistantResponse = response.data.output.text;
        return extractHtmlFromResponse(assistantResponse);
    } catch (error) {
        console.error('调用QWQ API时出错:', error);
        if (error.response) {
            console.error('API响应:', error.response.data);
        }
        throw new Error(`QWQ处理失败: ${error.message}`);
    }
}

/**
 * 从AI响应中提取HTML内容
 * @param {string} assistantResponse AI响应内容
 * @returns {string} 提取的HTML内容
 */
function extractHtmlFromResponse(assistantResponse) {
    console.log('正在提取HTML内容，原始响应长度:', assistantResponse.length);
    console.log('响应前100个字符:', assistantResponse.substring(0, 100));
    
    // 从响应中提取HTML代码块
    const htmlMatch = assistantResponse.match(/```html\n([\s\S]*?)\n```/) || 
                     assistantResponse.match(/```([\s\S]*?)```/) ||
                     assistantResponse.match(/<html[\s\S]*<\/html>/) ||
                     assistantResponse.match(/<body[\s\S]*<\/body>/);
                     
    console.log('HTML匹配结果:', htmlMatch ? '找到匹配' : '未找到匹配');
    
    // 如果找到HTML代码块，返回它；否则返回整个响应
    let extractedHtml = htmlMatch ? htmlMatch[1] || htmlMatch[0] : assistantResponse;
    
    // 如果提取的内容以```开头或结尾，需要清理这些标记
    extractedHtml = extractedHtml.replace(/^```(html)?\n/g, '').replace(/\n```$/g, '');
    
    console.log('提取后HTML长度:', extractedHtml.length);
    
    // 如果返回的不是有效的HTML，进行简单的后处理
    if (!extractedHtml.includes('<html') && !extractedHtml.includes('<body')) {
        console.log('提取的内容不是完整HTML，进行包装');
        // 包装为完整HTML
        return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AI优化文档</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        h1, h2, h3 { color: #2c3e50; }
        .highlighted { background-color: #fffacd; padding: 2px 4px; }
        .important { font-weight: bold; color: #e74c3c; }
    </style>
</head>
<body>
    ${extractedHtml}
</body>
</html>`;
    }
    
    return extractedHtml;
}

module.exports = {
    processAndSaveHtml,
    API_TYPES
}; 