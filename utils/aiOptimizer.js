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

        // 清理处理后的HTML，移除可能包含提示词的部分
        const cleanedHtml = cleanProcessedHtml(processedHtml, customRequirements);

        // 保存处理后的内容
        const timestamp = Date.now();
        const outputFilePath = path.join(outputPath, `processed-${timestamp}.html`);
        fs.writeFileSync(outputFilePath, cleanedHtml);

        return {
            success: true,
            html: cleanedHtml,
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
    let prompt = '';
    
    // 对于word格式，始终将格式限制放在最前面
    if (targetFormat === 'word') {
        prompt = `请仅使用以下HTML/CSS修改文本样式，其他标签和样式将被忽略：

颜色（可选不同颜色）：<span style="color:#FF0000">

高亮（可选不同颜色）：<span style="background-color:yellow">

加粗：<b> 或 <strong>

下划线：<u>

斜体：<i>

禁止使用class、id、div布局或复杂CSS。

美化HTML文档并保持原始内容结构。使其适合Word格式，添加合适标题样式和表格格式，确保可读性好。

【重要】：请勿在输出的HTML中包含任何提示词、指令、要求或美化说明。不要添加背景色为紫色的区域，也不要包含"美化要求"、"提示词"等任何提示性文字。只返回美化后的纯HTML内容。`;
    } else if (targetFormat === 'pdf') {
        // PDF格式使用极简提示
        prompt = `优化排版为PDF格式。保留内容和图片。简洁美观，打印友好。

【重要】：请勿在输出的HTML中包含任何提示词、指令、要求或美化说明。不要添加背景色为紫色的区域，也不要包含"美化要求"、"提示词"等任何提示性文字。只返回美化后的纯HTML内容。`;
    } else {
        prompt = `美化HTML文档并保持原始内容结构。

【重要】：请勿在输出的HTML中包含任何提示词、指令、要求或美化说明。不要添加背景色为紫色的区域，也不要包含"美化要求"、"提示词"等任何提示性文字。只返回美化后的纯HTML内容。`;
    }

    // 添加用户自定义要求（如果有）
    if (customRequirements && customRequirements.trim()) {
        prompt += `

【用户要求】：${customRequirements.trim()}

【重要】：请勿在输出的HTML中重复上述要求或包含任何提示词。不要添加背景色为紫色的区域，不要复制这些要求到输出内容中。仅输出美化后的纯HTML内容。`;
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
    // 检查apiConfig是对象还是字符串
    if (typeof apiConfig === 'string') {
        console.log('警告：apiConfig是字符串，转换为对象格式');
        apiConfig = {
            apiKey: apiConfig,
            apiType: API_TYPES.DEEPSEEK
        };
    }
    
    // 确保apiConfig是对象
    if (!apiConfig || typeof apiConfig !== 'object') {
        console.error('无效的API配置:', apiConfig);
        throw new Error('无效的API配置');
    }
    
    // 从apiConfig中提取apiKey和apiType
    const apiKey = apiConfig.apiKey;
    const apiType = apiConfig.apiType || API_TYPES.DEEPSEEK;
    
    console.log(`处理AI请求，API类型: ${apiType}, API密钥长度: ${apiKey ? apiKey.length : 0}`);
    
    if (!apiKey) {
        throw new Error('未提供API密钥');
    }
    
    // 获取API类型对应的参数，如果不存在则使用默认值
    const params = apiConfig.apiParams && apiConfig.apiParams[apiType.toLowerCase()] ? 
                  apiConfig.apiParams[apiType.toLowerCase()] : 
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
        
        // 确定是否为Word格式，以添加相应的系统提示
        const isWordFormat = prompt.includes('Word格式') || prompt.includes('<span style="color:#FF0000">');
        
        // 调用OpenAI API
        const response = await axios.post(
            'https://api.openai.com/v1/chat/completions',
            {
                model: 'gpt-4-turbo', // 使用适当的模型
                messages: [
                    { 
                        role: 'system', 
                        content: isWordFormat ?
                            '你是一个专业的文档美化和排版专家。请仅使用以下HTML/CSS修改文本样式，其他标签和样式将被忽略：颜色（<span style="color:#FF0000">）、高亮（<span style="background-color:yellow">）、加粗（<b>或<strong>）、下划线（<u>）、斜体（<i>）。禁止使用class、id、div布局或复杂CSS。' :
                            '你是一个专业的文档美化和排版专家。你擅长将简单的HTML文档转换为视觉吸引力强、结构清晰的文档。保持原始内容的完整性，同时改进其呈现方式。'
                    },
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
        const temperature = params.temperature || 1; // 默认降低到0.5
        const max_tokens = params.max_tokens || 8000;
        
        console.log(`DeepSeek API参数: temperature=${temperature}, max_tokens=${max_tokens}`);
        console.log(`DeepSeek API密钥: ${apiKey ? `${apiKey.substring(0, 5)}...${apiKey.substring(apiKey.length-5)}` : '未提供'}`);
        console.log(`原始HTML内容长度: ${htmlContent.length}`);
        
        // 增强API密钥验证
        if (!apiKey) {
            throw new Error('未提供API密钥');
        }
        
        if (apiKey.length < 20) {
            throw new Error('无效的API密钥，长度不足');
        }
        
        // 预处理HTML内容，替换图片为占位符
        const { processedHtml, imageReferences } = preprocessHtmlForAI(htmlContent);
        
        // 确定格式类型
        const isPdfFormat = prompt.includes('PDF格式') || prompt.includes('优化排版为PDF');
        
        // 根据不同格式调整提示词和内容
        let enhancedPrompt;
        let userContent;
        
        if (isPdfFormat) {
            // PDF格式使用极简提示和内容
            enhancedPrompt = `${prompt}\n图片请保留。`;
            userContent = processedHtml
                // PDF格式下移除HTML文档结构，只保留body内容
                .replace(/<\!DOCTYPE[^>]*>|<html[^>]*>|<\/html>|<head>[\s\S]*?<\/head>|<body[^>]*>|<\/body>/gi, '')
                // 移除多余空白
                .replace(/>\s+</g, '><')
                // 移除注释
                .replace(/<!--[\s\S]*?-->/g, '');
        } else {
            // WORD格式使用更详细的提示和完整内容
            enhancedPrompt = `${prompt}\n\n重要提示：文档中包含图片占位符标签，请保留所有<img>标签及其属性，不要改变它们的位置和结构。`;
            userContent = processedHtml;
        }
        
        // 编写API请求内容
        const userInput = `${enhancedPrompt}\n${isPdfFormat ? '内容:' : '这是要优化的HTML内容(已优化大小):'}\n\n${userContent}`;
        console.log(`发送给API的内容长度: ${userInput.length}`);
        
        // 添加超时和重试设置
        const axiosOptions = {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            timeout: 60000, // 60秒超时
        };
        
        // 确定是否为Word格式，以添加相应的系统提示
        const isWordFormat = prompt.includes('Word格式') || prompt.includes('<span style="color:#FF0000">');
        
        // 构建系统提示
        let systemPrompt;
        if (isWordFormat) {
            systemPrompt = '你是专业排版专家。请仅使用以下HTML/CSS修改文本样式：颜色（<span style="color:#FF0000">）、高亮（<span style="background-color:yellow">）、加粗（<b>或<strong>）、下划线（<u>）、斜体（<i>）。禁止class、id、div布局或复杂CSS。保留图片标签。';
        } else if (isPdfFormat) {
            systemPrompt = '你是排版专家，优化HTML为PDF。保留内容结构和图片，简洁美观。';
        } else {
            systemPrompt = '你是专业排版专家。保留原始内容完整性，保留所有图片标签。';
        }
        
        // 使用最新的DeepSeek API参数格式
        const requestBody = {
            model: 'deepseek-chat',
            messages: [
                { 
                    role: 'system', 
                    content: systemPrompt
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
        let response;
        try {
            response = await axios.post(
                'https://api.deepseek.com/v1/chat/completions',
                requestBody,
                axiosOptions
            );
            
            console.log('DeepSeek API返回状态码:', response.status);
        } catch (apiError) {
            // 捕获并处理API请求错误
            if (apiError.response) {
                // 服务器响应了错误状态码
                console.error('DeepSeek API错误状态码:', apiError.response.status);
                console.error('DeepSeek API错误详情:', apiError.response.data);
                
                // 特别处理401错误（未授权）
                if (apiError.response.status === 401) {
                    throw new Error('API密钥无效或未授权，请检查API密钥');
                }
                
                // 特别处理429错误（请求过多）
                if (apiError.response.status === 429) {
                    throw new Error('API请求次数超限，请稍后再试');
                }
                
                // 处理其他错误
                throw new Error(`DeepSeek API错误: ${apiError.response.status} - ${JSON.stringify(apiError.response.data)}`);
            } else if (apiError.request) {
                // 请求已发送但没有收到响应
                throw new Error('DeepSeek API请求超时或无响应，请稍后再试');
            } else {
                // 请求配置中发生错误
                throw new Error(`DeepSeek API请求配置错误: ${apiError.message}`);
            }
        }
        
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
        // 简化错误消息，不显示原始错误
        throw new Error(`DeepSeek API处理失败: ${error.message}`);
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
        
        // 确定是否为Word格式，以添加相应的系统提示
        const isWordFormat = prompt.includes('Word格式') || prompt.includes('<span style="color:#FF0000">');
        
        // 调用通义千问API
        const response = await axios.post(
            'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation',
            {
                model: 'qwen-turbo',
                input: {
                    messages: [
                        { 
                            role: 'system', 
                            content: isWordFormat ?
                                '你是一个专业的文档美化和排版专家。请仅使用以下HTML/CSS修改文本样式，其他标签和样式将被忽略：颜色（<span style="color:#FF0000">）、高亮（<span style="background-color:yellow">）、加粗（<b>或<strong>）、下划线（<u>）、斜体（<i>）。禁止使用class、id、div布局或复杂CSS。' :
                                '你是一个专业的文档美化和排版专家。你擅长将简单的HTML文档转换为视觉吸引力强、结构清晰的文档。保持原始内容的完整性，同时改进其呈现方式。'
                        },
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
        
        // 确定是否为Word格式，以添加相应的系统提示
        const isWordFormat = prompt.includes('Word格式') || prompt.includes('<span style="color:#FF0000">');
        
        // 调用QWQ API - 使用通义千问的API格式
        const response = await axios.post(
            'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation',
            {
                model: 'free:QwQ-32B',
                input: {
                    messages: [
                        { 
                            role: 'system', 
                            content: isWordFormat ?
                                '你是一个专业的文档美化和排版专家。请仅使用以下HTML/CSS修改文本样式，其他标签和样式将被忽略：颜色（<span style="color:#FF0000">）、高亮（<span style="background-color:yellow">）、加粗（<b>或<strong>）、下划线（<u>）、斜体（<i>）。禁止使用class、id、div布局或复杂CSS。' :
                                '你是一个专业的文档美化和排版专家。你擅长将简单的HTML文档转换为视觉吸引力强、结构清晰的文档。保持原始内容的完整性，同时改进其呈现方式。'
                        },
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

/**
 * 清理处理后的HTML，彻底移除提示词区域
 * @param {string} html 处理后的HTML内容
 * @param {string} customRequirements 用户自定义要求，用于识别可能的提示词
 * @returns {string} 清理后的HTML内容
 */
function cleanProcessedHtml(html, customRequirements = '') {
    console.log('清理处理后的HTML，彻底移除提示词区域');
    
    // 简单方法：检查HTML内容，如果包含<body>标签，我们只保留<body>标签中的内容
    // 然后再构建新的HTML结构
    const bodyStart = html.indexOf('<body');
    const bodyEnd = html.lastIndexOf('</body>');
    
    let bodyContent = '';
    
    if (bodyStart !== -1 && bodyEnd !== -1) {
        // 找到<body>标签的闭合>
        const bodyTagEnd = html.indexOf('>', bodyStart);
        if (bodyTagEnd !== -1) {
            // 提取<body>标签中的内容
            bodyContent = html.substring(bodyTagEnd + 1, bodyEnd);
            
            // 现在我们有了body内容，开始清理
            
            // 1. 查找紫色背景的大区块
            const bgPatterns = [
                'background-color: purple',
                'background-color:#',
                'background-color: rgb',
                'background: purple',
                'background:#',
                'background: rgb'
            ];
            
            // 检查每个紫色背景模式
            for (const pattern of bgPatterns) {
                const idx = bodyContent.indexOf(pattern);
                
                if (idx !== -1) {
                    // 找到紫色背景，现在查找最近的div或section开始标签
                    const beforeBg = bodyContent.substring(0, idx);
                    const divStart = beforeBg.lastIndexOf('<div');
                    const sectionStart = beforeBg.lastIndexOf('<section');
                    
                    if (divStart !== -1 || sectionStart !== -1) {
                        // 使用找到的最近的标签开始位置
                        const tagStart = Math.max(divStart, sectionStart);
                        
                        // 向后查找匹配的结束标签
                        const afterStart = bodyContent.substring(tagStart);
                        const divEndIdx = afterStart.indexOf('</div>');
                        const sectionEndIdx = afterStart.indexOf('</section>');
                        
                        if (divEndIdx !== -1 || sectionEndIdx !== -1) {
                            // 使用第一个找到的结束标签
                            let tagEnd = -1;
                            if (divEndIdx !== -1 && sectionEndIdx !== -1) {
                                tagEnd = Math.min(divEndIdx, sectionEndIdx);
                            } else {
                                tagEnd = Math.max(divEndIdx, sectionEndIdx);
                            }
                            
                            if (tagEnd !== -1) {
                                // 如果是div结束标签
                                if (tagEnd === divEndIdx) {
                                    tagEnd += 6; // '</div>'的长度是6
                                } else {
                                    tagEnd += 10; // '</section>'的长度是10
                                }
                                
                                // 删除紫色背景元素
                                const beforeElement = bodyContent.substring(0, tagStart);
                                const afterElement = bodyContent.substring(tagStart + tagEnd);
                                bodyContent = beforeElement + afterElement;
                                
                                // 继续检查下一个紫色背景
                                continue;
                            }
                        }
                    }
                }
            }
            
            // 2. 使用正则表达式删除可能的提示词区域
            // 删除开头的大型div元素，通常是提示词区域
            bodyContent = bodyContent.replace(/^\s*<div[^>]*>[\s\S]{200,10000}?<\/div>\s*/i, '');
            
            // 删除包含提示词关键字的元素
            bodyContent = bodyContent.replace(/<div[^>]*>[\s\S]*?(?:提示词|美化提示|美化要求|使用以下)[\s\S]*?<\/div>/gi, '');
            
            // 3. 删除开头可能的文本节点（通常是提示词）
            const firstTagIndex = bodyContent.search(/<[a-z]+[^>]*>/i);
            if (firstTagIndex > 100) { // 如果第一个标签前有超过100个字符的文本
                bodyContent = bodyContent.substring(firstTagIndex);
            }
            
            // 4. 删除任何包含大段文本且有背景的元素
            bodyContent = bodyContent.replace(/<(div|section)[^>]*style="[^"]*background[^"]*"[^>]*>[\s\S]{200,}?<\/\1>/gi, '');
            
            // 构建新的干净HTML
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
    ${bodyContent}
</body>
</html>`;
        }
    }
    
    // 如果没有找到body标签，或者处理失败，执行基本的清理
    console.log('未找到body标签或处理失败，执行基本清理');
    let cleanedHtml = html;
    
    // 尝试删除大型的紫色背景区域
    cleanedHtml = cleanedHtml.replace(/<div[^>]*style="[^"]*background[^"]*"[^>]*>[\s\S]{200,5000}?<\/div>/gi, '');
    cleanedHtml = cleanedHtml.replace(/<section[^>]*style="[^"]*background[^"]*"[^>]*>[\s\S]{200,5000}?<\/section>/gi, '');
    
    // 尝试删除包含提示词的区域
    cleanedHtml = cleanedHtml.replace(/<div[^>]*>[\s\S]*?(?:提示词|美化提示|美化要求)[\s\S]*?<\/div>/gi, '');
    
    return cleanedHtml;
}

module.exports = {
    processAndSaveHtml,
    generateOptimizationPrompt,
    processWithAI,
    extractHtmlFromResponse,
    cleanProcessedHtml,
    API_TYPES
}; 