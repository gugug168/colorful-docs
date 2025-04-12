// AI文档优化工具
const fs = require('fs');
const path = require('path');
const axios = require('axios');

// 添加访问令牌缓存机制
let accessTokenCache = {
    token: null,
    expireTime: 0
};

/**
 * 获取百度ERNIE API的访问令牌
 * @param {string} apiKey API密钥
 * @param {string} secretKey 密钥
 * @returns {Promise<string>} 访问令牌
 */
async function getAccessToken(apiKey, secretKey) {
    try {
        // 检查缓存的令牌是否有效
        const now = Date.now();
        if (accessTokenCache.token && accessTokenCache.expireTime > now) {
            console.log('使用缓存的访问令牌');
            return accessTokenCache.token;
        }
        
        console.log('获取新的百度ERNIE API访问令牌');
        
        // 构建获取令牌的URL
        const tokenUrl = `https://aip.baidubce.com/oauth/2.0/token?grant_type=client_credentials&client_id=${apiKey}&client_secret=${secretKey}`;
        
        // 发送请求获取令牌
        const response = await axios.post(tokenUrl, {}, {
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        });
        
        if (!response.data || !response.data.access_token) {
            throw new Error('获取访问令牌失败: 响应中没有access_token');
        }
        
        // 更新令牌缓存
        accessTokenCache.token = response.data.access_token;
        // 设置过期时间比实际提前1小时，以确保安全边际
        accessTokenCache.expireTime = now + (response.data.expires_in - 3600) * 1000;
        
        console.log('成功获取新的访问令牌，有效期至:', new Date(accessTokenCache.expireTime).toLocaleString());
        
        return accessTokenCache.token;
    } catch (error) {
        console.error('获取百度ERNIE API访问令牌失败:', error);
        throw error;
    }
}

/**
 * 使用AI处理HTML内容并保存
 * @param {string} htmlContent HTML内容
 * @param {string} filename 原始文件名
 * @param {string} targetFormat 目标格式 (pdf/word/html)
 * @returns {string} 输出文件的路径
 */
async function processAndSaveHtml(htmlContent, filename, targetFormat = 'html') {
    try {
        console.log(`处理HTML内容保存为${targetFormat}格式，原始文件名: ${filename}`);
        
        // 处理HTML内容，包括清理和规范化
        const cleanedHtml = cleanHtmlContent(htmlContent);
        
        if (!cleanedHtml) {
            console.error('清理后的HTML内容为空');
            throw new Error('处理后的HTML内容为空');
        }
        
        // 创建临时目录（如果不存在）
        const tempDir = path.join(__dirname, '..', 'temp');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }
        
        // 时间戳，用于生成唯一文件名
        const timestamp = Date.now();
        const baseFilename = path.basename(filename, path.extname(filename));
        const safeBaseFilename = baseFilename.replace(/[^a-zA-Z0-9]/g, '-');
        
        // 输出处理后的HTML文件路径
        const htmlFilePath = path.join(tempDir, `${safeBaseFilename}-ai-enhanced-${timestamp}.html`);
        
        // 保存HTML内容到文件
        fs.writeFileSync(htmlFilePath, cleanedHtml, 'utf8');
        console.log(`已保存增强的HTML内容到: ${htmlFilePath}`);
        
        // 根据目标格式决定下一步处理
        if (targetFormat.toLowerCase() === 'word') {
            // 转换为Word文档
            const docxConverter = require('./docxConverter');
            const docxPath = await docxConverter.convertHtmlToDocx(htmlFilePath);
            console.log(`已生成Word文档: ${docxPath}`);
            return docxPath;
        } else if (targetFormat.toLowerCase() === 'pdf') {
            // 转换为PDF文档
            const pdfConverter = require('./pdfConverter');
            const pdfPath = await pdfConverter.convertHtmlToPdf(htmlFilePath);
            console.log(`已生成PDF文档: ${pdfPath}`);
            return pdfPath;
        } else {
            // 默认返回HTML文件路径
            console.log(`使用HTML格式: ${htmlFilePath}`);
            // 复制到下载目录供下载
            const downloadsDir = path.join(__dirname, '..', 'downloads');
            if (!fs.existsSync(downloadsDir)) {
                fs.mkdirSync(downloadsDir, { recursive: true });
            }
            
            const downloadFilePath = path.join(downloadsDir, path.basename(htmlFilePath));
            fs.copyFileSync(htmlFilePath, downloadFilePath);
            console.log(`HTML文件已复制到下载目录: ${downloadFilePath}`);
            
            return htmlFilePath;
        }
    } catch (error) {
        console.error('处理和保存HTML时出错:', error);
        throw error;
    }
}

/**
 * 根据目标格式和自定义要求生成优化提示
 * @param {string} targetFormat 目标格式
 * @param {string} customRequirements 用户自定义要求
 * @returns {string} 优化提示
 */
function generateOptimizationPrompt(targetFormat, customRequirements = '') {
    // 极简提示词，减少token占用
    let prompt = '';
    
    console.log(`生成优化提示，目标格式: ${targetFormat}, 自定义要求长度: ${customRequirements ? customRequirements.length : 0}`);
    
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

    console.log(`生成的提示长度: ${prompt.length}`);
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
 * @param {object} params 其他参数
 * @returns {Promise<string>} 处理后的HTML内容
 */
async function processWithOpenAI(htmlContent, prompt, apiKey, params = {}) {
    try {
        console.log('使用OpenAI进行文档美化');
        
        // 预处理HTML内容，替换图片为占位符
        const { processedHtml, imageReferences } = preprocessHtmlForAI(htmlContent);
        
        // 准备API请求参数
        const requestData = {
            model: params.model || 'gpt-4',
            messages: [
                {
                    role: 'system',
                    content: '你是一个专业的文档美化助手，擅长改进HTML文档的排版和样式。请保留所有原始内容和结构，包括所有图片标签。不要丢失任何信息。'
                },
                {
                    role: 'user',
                    content: `${prompt}\n\n原始HTML：\n\`\`\`html\n${processedHtml}\n\`\`\``
                }
            ],
            temperature: params.temperature || 0.7,
            max_tokens: params.max_tokens || 4000,
        };
        
        // 调用OpenAI API
        console.log('发送OpenAI API请求...');
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify(requestData)
        });
        
        // 检查响应状态
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Failed to parse error response' }));
            console.error('OpenAI API响应错误:', errorData);
            throw new Error(`OpenAI API错误 (${response.status}): ${errorData.error?.message || '未知错误'}`);
        }
        
        // 解析响应
        const data = await response.json();
        
        if (!data.choices || !data.choices[0] || !data.choices[0].message) {
            console.error('OpenAI API响应格式异常:', data);
            throw new Error('OpenAI API响应无效');
        }
        
        // 获取响应内容
        const content = data.choices[0].message.content;
        console.log('收到OpenAI响应，长度:', content.length);
        
        // 从响应中提取HTML内容
        const extractedHtml = extractHtmlFromResponse(content, imageReferences);
        
        return extractedHtml;
    } catch (error) {
        console.error('OpenAI文档美化失败:', error);
        // 重新抛出错误，确保错误能被上层函数正确捕获
        throw error;
    }
}

/**
 * 预处理HTML内容，减少AI处理所需的标记数
 * 1. 替换图片标签为占位符
 * 2. 移除不必要的空白和注释
 * 3. 如果内容太长，则截断它
 * @param {string} htmlContent 原始HTML内容
 * @returns {object} 包含处理后的HTML和图片引用信息的对象
 */
function preprocessHtmlForAI(htmlContent) {
    if (!htmlContent) return { processedHtml: '', imageReferences: [] };
    
    // 记录原始长度
    console.log(`预处理前HTML长度: ${htmlContent.length}`);
    
    // 删除注释
    let processed = htmlContent.replace(/<!--[\s\S]*?-->/g, '');
    
    // 删除多余的空白，但保留换行
    processed = processed.replace(/\s+/g, ' ').replace(/>\s+</g, '><');
    
    // 保存图片引用
    const imageReferences = [];
    let imageIndex = 0;
    
    // 替换图片标签为占位符，但保存引用
    processed = processed.replace(/<img\s+([^>]*)src=["']([^"']*)["']([^>]*)>/gi, (match, beforeSrc, src, afterSrc) => {
        // 提取所有属性
        const fullTag = beforeSrc + 'src="' + src + '"' + afterSrc;
        const attributes = {};
        
        // 提取所有关键属性
        const altMatch = fullTag.match(/alt=["']([^"']*)["']/i);
        const widthMatch = fullTag.match(/width=["']([^"']*)["']/i);
        const heightMatch = fullTag.match(/height=["']([^"']*)["']/i);
        const classMatch = fullTag.match(/class=["']([^"']*)["']/i);
        const styleMatch = fullTag.match(/style=["']([^"']*)["']/i);
        
        if (altMatch) attributes.alt = altMatch[1];
        if (widthMatch) attributes.width = widthMatch[1];
        if (heightMatch) attributes.height = heightMatch[1];
        if (classMatch) attributes.class = classMatch[1];
        if (styleMatch) attributes.style = styleMatch[1];
        
        // 检查是否为上色后的图片
        const isColorized = src.includes('_colorized');
        
        // 保存引用 - 特别处理上色后的图片，确保优先使用上色版本
        imageReferences.push({
            index: imageIndex,
            src: src,
            isColorized: isColorized,
            attributes: attributes,
            originalMatch: match // 保存原始标签以备需要
        });
        
        // 创建包含所有原始属性数据的占位符标签
        let placeholder = `<img id="img-placeholder-${imageIndex}" data-src="${src}"`;
        
        // 添加所有属性作为data属性
        if (attributes.alt) placeholder += ` data-alt="${attributes.alt}"`;
        if (attributes.width) placeholder += ` data-width="${attributes.width}"`;
        if (attributes.height) placeholder += ` data-height="${attributes.height}"`;
        if (attributes.class) placeholder += ` data-class="${attributes.class}"`;
        if (attributes.style) placeholder += ` data-style="${attributes.style}"`;
        if (isColorized) placeholder += ` data-colorized="true"`;
        
        placeholder += ` src="placeholder.jpg">`;
        
        console.log(`处理图片: ${isColorized ? '彩色版' : '普通'} - ${src}`);
        
        imageIndex++;
        return placeholder;
    });
    
    // 如果处理后的内容过长，可能需要截断
    const MAX_LENGTH = 10000; // 可根据需要调整
    if (processed.length > MAX_LENGTH) {
        console.log(`处理后HTML过长(${processed.length})，截断到${MAX_LENGTH}...`);
        // 智能截断，尝试在HTML标签边界处截断
        let truncated = processed.substring(0, MAX_LENGTH);
        // 确保截断后的HTML结构完整
        const openBodyIndex = truncated.indexOf('<body');
        if (openBodyIndex !== -1) {
            // 确保结尾处有</body></html>
            truncated += '...</div></body></html>';
        }
        processed = truncated;
    }
    
    console.log(`预处理后HTML长度: ${processed.length}, 图片引用数: ${imageReferences.length}`);
    return { processedHtml: processed, imageReferences: imageReferences };
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
        const temperature = params.temperature || 0.7; // 降低默认温度，提高确定性
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
            enhancedPrompt = `${prompt}\n图片请保留。保持所有img标签，不要修改img标签中的src属性。`;
            userContent = processedHtml
                // PDF格式下移除HTML文档结构，只保留body内容
                .replace(/<\!DOCTYPE[^>]*>|<html[^>]*>|<\/html>|<head>[\s\S]*?<\/head>|<body[^>]*>|<\/body>/gi, '')
                // 移除多余空白
                .replace(/>\s+</g, '><')
                // 移除注释
                .replace(/<!--[\s\S]*?-->/g, '');
        } else {
            // WORD格式使用更详细的提示和完整内容
            enhancedPrompt = `${prompt}\n\n重要提示：文档中包含图片占位符标签，请保留所有<img>标签及其属性，不要改变它们的位置、属性和结构。特别是保留所有id属性和data-*属性。`;
            userContent = processedHtml;
        }
        
        // 编写API请求内容
        const userInput = `${enhancedPrompt}\n${isPdfFormat ? '内容:' : '这是要优化的HTML内容(已优化大小):'}\n\n${userContent}`;
        console.log(`发送给API的内容长度: ${userInput.length}`);
        
        // 对较长内容进行特殊处理
        const isLongContent = userInput.length > 10000;
        if (isLongContent) {
            console.log('内容较长，采用分段处理方式');
            // 这里可以实现分段处理的逻辑
        }
        
        // 添加超时和重试设置
        const axiosOptions = {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            timeout: isLongContent ? 300000 : 180000, // 增加超时时间：长内容5分钟，短内容3分钟
        };
        
        // 检查并输出关键参数
        console.log(`使用的温度参数: ${temperature}, 最大token: ${max_tokens}`);
        console.log(`提示词长度: ${enhancedPrompt.length}, 内容长度: ${userContent.length}`);
        
        // 构建系统提示
        const isWordFormat = prompt.includes('Word格式') || prompt.includes('<span style="color:#FF0000">');
        
        // 构建系统提示
        let systemPrompt;
        if (isWordFormat) {
            systemPrompt = '你是专业排版专家。请仅使用以下HTML/CSS修改文本样式：颜色（<span style="color:#FF0000">）、高亮（<span style="background-color:yellow">）、加粗（<b>或<strong>）、下划线（<u>）、斜体（<i>）。禁止class、id、div布局或复杂CSS。保留所有图片标签及其属性，特别是id和data-*属性。';
        } else if (isPdfFormat) {
            systemPrompt = '你是排版专家，优化HTML为PDF。保留内容结构和图片，简洁美观。保留所有图片标签及其属性，特别是id和data-*属性。';
        } else {
            systemPrompt = '你是专业排版专家。保留原始内容完整性，保留所有图片标签及其属性。';
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
        let retryCount = 0;
        const maxRetries = 3; // 增加最大重试次数

        async function tryDeepSeekRequest() {
            try {
                console.log(`开始第${retryCount+1}次API请求...`);
                const requestStartTime = Date.now();
                
                // 添加请求内容的日志记录
                console.log('API请求体结构:', JSON.stringify({
                    model: requestBody.model,
                    temperature: requestBody.temperature,
                    max_tokens: requestBody.max_tokens,
                    stream: requestBody.stream,
                    message_count: requestBody.messages.length
                }));
                
                response = await axios.post(
                    'https://api.deepseek.com/v1/chat/completions',
                    requestBody,
                    axiosOptions
                );
                const requestEndTime = Date.now();
                console.log(`DeepSeek API请求时间: ${(requestEndTime - requestStartTime) / 1000}秒`);
                console.log('DeepSeek API返回状态码:', response.status);
                
                // 记录响应的基本结构
                if (response.data) {
                    console.log('API响应结构:', JSON.stringify({
                        id: response.data.id,
                        object: response.data.object,
                        model: response.data.model,
                        usage: response.data.usage,
                        choices_count: response.data.choices ? response.data.choices.length : 0
                    }));
                }
                
                return true;
            } catch (apiError) {
                // 捕获并处理API请求错误
                console.error('DeepSeek API请求失败:', apiError.message);
                
                if (apiError.response) {
                    // 服务器响应了错误状态码
                    console.error('DeepSeek API错误状态码:', apiError.response.status);
                    console.error('DeepSeek API错误详情:', JSON.stringify(apiError.response.data));
                    
                    // 特别处理401错误（未授权）
                    if (apiError.response.status === 401) {
                        throw new Error('API密钥无效或未授权，请检查DeepSeek API密钥');
                    }
                    
                    // 特别处理429错误（请求过多）
                    if (apiError.response.status === 429) {
                        console.log('API请求次数超限，等待3秒后重试');
                        await new Promise(resolve => setTimeout(resolve, 3000));
                        return false; // 允许重试
                    }
                    
                    // 处理其他错误
                    throw new Error(`DeepSeek API错误: ${apiError.response.status} - ${JSON.stringify(apiError.response.data)}`);
                } else if (apiError.request) {
                    // 请求已发送但没有收到响应
                    console.error('DeepSeek API请求超时或无响应，尝试重试');
                    return false; // 允许重试
                } else {
                    // 请求配置中发生错误
                    throw new Error(`DeepSeek API请求配置错误: ${apiError.message}`);
                }
            }
        }

        // 尝试请求，最多重试maxRetries次
        while (retryCount <= maxRetries) {
            const success = await tryDeepSeekRequest();
            if (success) break;
            
            retryCount++;
            if (retryCount <= maxRetries) {
                console.log(`DeepSeek API请求失败，进行第${retryCount}次重试...`);
                // 增加延迟，避免频繁请求
                const delayTime = 2000 * Math.pow(2, retryCount - 1); // 指数退避策略
                console.log(`等待${delayTime/1000}秒后重试...`);
                await new Promise(resolve => setTimeout(resolve, delayTime));
            }
        }

        if (!response) {
            throw new Error('DeepSeek API请求失败，已达到最大重试次数。请检查网络连接和API密钥。');
        }
        
        // 提取响应中的HTML内容
        if (!response.data || !response.data.choices || !response.data.choices[0]) {
            console.error('DeepSeek API响应格式异常:', JSON.stringify(response.data));
            throw new Error('API响应格式异常，请检查DeepSeek API是否更新');
        }
        
        const assistantResponse = response.data.choices[0].message.content;
        console.log('DeepSeek响应内容长度:', assistantResponse.length);
        
        // 提取HTML内容并还原图片
        let extractedHTML = extractHtmlFromResponse(assistantResponse, imageReferences);
        console.log('处理后的HTML内容长度:', extractedHTML.length);
        
        return extractedHTML;
    } catch (error) {
        console.error('DeepSeek API处理错误:', error);
        // 返回一个友好的错误信息
        throw new Error(`AI美化失败: ${error.message}`);
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
 * 从助手响应中提取HTML内容
 * @param {string} response 助手响应
 * @param {Array} imageReferences 图片引用数组
 * @returns {string} 处理后的HTML内容
 */
function extractHtmlFromResponse(response, imageReferences = []) {
    if (!response) return '';
    
    console.log(`响应内容长度: ${response.length}`);
    
    // 尝试匹配常见HTML格式
    const htmlMatches = response.match(/```html\n([\s\S]*?)\n```/);
    const directHtmlMatches = response.match(/<html[^>]*>([\s\S]*?)<\/html>/i);
    
    let htmlContent = '';
    
    if (htmlMatches && htmlMatches[1]) {
        console.log('从代码块中提取HTML');
        htmlContent = htmlMatches[1];
    } else if (directHtmlMatches && directHtmlMatches[0]) {
        console.log('从直接HTML标记中提取');
        htmlContent = directHtmlMatches[0];
    } else {
        // 如果没有明显的HTML标记，尽量清理文本并用作HTML内容
        console.log('未找到明确的HTML标记，尝试清理响应内容');
        htmlContent = response
            // 删除非HTML代码块
            .replace(/```(?!html)([\s\S]*?)```/g, '')
            // 删除可能的Markdown标记
            .replace(/#{1,6} /g, '')
            .trim();
        
        // 检查内容是否包含基本HTML标记，如果没有，则包装它
        if (!htmlContent.includes('<html') && !htmlContent.includes('<body')) {
            htmlContent = `<html><body>${htmlContent}</body></html>`;
        }
    }
    
    console.log(`提取的HTML内容长度: ${htmlContent.length}`);
    
    // 找出所有上色图片引用，优先处理
    const colorizedReferences = imageReferences ? 
        imageReferences.filter(ref => ref.isColorized) : [];
    
    if (colorizedReferences.length > 0) {
        console.log(`发现${colorizedReferences.length}个上色图片引用，优先处理`);
        
        // 查找普通图片和占位符，替换为上色版本
        const originalImagePattern = /<img[^>]*src=["']([^"']*?)(?:_colorized)?["'][^>]*>/gi;
        
        htmlContent = htmlContent.replace(originalImagePattern, (match, src) => {
            // 尝试找到匹配的上色图片
            const baseSrc = src.replace(/_colorized/g, ''); // 移除可能的colorized后缀
            const colorizedRef = colorizedReferences.find(ref => 
                ref.src.includes(baseSrc) || 
                baseSrc.includes(ref.src.replace(/_colorized/g, '')));
            
            if (colorizedRef) {
                console.log(`替换图片为上色版本: ${src} -> ${colorizedRef.src}`);
                
                // 确保使用正确的路径格式
                let colorizedPath = colorizedRef.src;
                
                // 检查路径是否需要转换为web路径
                if (!colorizedPath.startsWith('/') && !colorizedPath.startsWith('http')) {
                    // 提取文件名并创建web路径
                    const fileName = path.basename(colorizedPath);
                    if (fileName.includes('_colorized')) {
                        colorizedPath = '/temp/' + fileName;
                        console.log(`转换为Web路径: ${colorizedPath}`);
                    }
                }
                
                // 构建新的图片标签，保留原始属性，添加data-colorized属性
                let newTag = match.replace(/src=["'][^"']*["']/i, `src="${colorizedPath}" data-colorized="true"`);
                return newTag;
            }
            
            return match; // 没有找到匹配的上色图片，保持原样
        });
    }
    
    // 恢复常规图片引用（包括上色图片）
    if (imageReferences && imageReferences.length > 0) {
        console.log(`开始恢复${imageReferences.length}个图片引用...`);
        
        // 创建图片占位符和原始图片标签的映射，用于更精确的替换
        const placeholderMap = {};
        imageReferences.forEach(ref => {
            const placeholderId = `img-placeholder-${ref.index}`;
            placeholderMap[placeholderId] = ref;
        });
        
        // 查找所有图片标签
        const imgTags = htmlContent.match(/<img[^>]*>/gi) || [];
        console.log(`找到${imgTags.length}个图片标签等待处理`);
        
        // 替换所有图片占位符
        for (const imgTag of imgTags) {
            // 提取id属性
            const idMatch = imgTag.match(/id=["']img-placeholder-(\d+)["']/i);
            if (idMatch) {
                const placeholderId = `img-placeholder-${idMatch[1]}`;
                const ref = placeholderMap[placeholderId];
                
                if (ref) {
                    // 获取正确的src路径
                    let srcPath = ref.src;
                    
                    // 如果是上色图片，确保使用正确的web路径
                    if (ref.isColorized && !srcPath.startsWith('/') && !srcPath.startsWith('http')) {
                        const fileName = path.basename(srcPath);
                        srcPath = '/temp/' + fileName;
                        console.log(`转换上色图片为Web路径: ${srcPath}`);
                    }
                    
                    // 构建还原后的图片标签
                    let replacementTag = `<img src="${srcPath}"`;
                    
                    // 添加所有原始属性
                    if (ref.attributes.alt) replacementTag += ` alt="${ref.attributes.alt}"`;
                    if (ref.attributes.width) replacementTag += ` width="${ref.attributes.width}"`;
                    if (ref.attributes.height) replacementTag += ` height="${ref.attributes.height}"`;
                    if (ref.attributes.class) replacementTag += ` class="${ref.attributes.class}"`;
                    if (ref.attributes.style) replacementTag += ` style="${ref.attributes.style}"`;
                    
                    // 添加colorized标记
                    if (ref.isColorized) replacementTag += ` data-colorized="true"`;
                    
                    replacementTag += '>';
                    
                    // 执行精确替换
                    htmlContent = htmlContent.replace(imgTag, replacementTag);
                    console.log(`已恢复图片: ${ref.isColorized ? '彩色版' : '普通'} - ${srcPath}`);
                }
            }
        }
    }
    
    // 还有可能AI修改了占位符的格式，尝试使用正则表达式进行第二次匹配
    imageReferences.forEach(ref => {
        const placeholderRegex = new RegExp(`<img[^>]*id=["']img-placeholder-${ref.index}["'][^>]*>`, 'g');
        
        if (htmlContent.match(placeholderRegex)) {
            // 获取正确的路径
            let srcPath = ref.src;
            
            // 如果是上色图片，确保使用正确的web路径
            if (ref.isColorized && !srcPath.startsWith('/') && !srcPath.startsWith('http')) {
                const fileName = path.basename(srcPath);
                srcPath = '/temp/' + fileName;
                console.log(`第二阶段转换上色图片为Web路径: ${srcPath}`);
            }
            
            // 构建还原后的图片标签
            let imgTag = `<img src="${srcPath}"`;
            
            // 添加所有原始属性
            if (ref.attributes.alt) imgTag += ` alt="${ref.attributes.alt}"`;
            if (ref.attributes.width) imgTag += ` width="${ref.attributes.width}"`;
            if (ref.attributes.height) imgTag += ` height="${ref.attributes.height}"`;
            if (ref.attributes.class) imgTag += ` class="${ref.attributes.class}"`;
            if (ref.attributes.style) imgTag += ` style="${ref.attributes.style}"`;
            
            // 添加colorized标记
            if (ref.isColorized) imgTag += ` data-colorized="true"`;
            
            imgTag += '>';
            
            // 执行替换
            const beforeReplace = htmlContent;
            htmlContent = htmlContent.replace(placeholderRegex, imgTag);
            
            // 检查是否实际进行了替换
            if (beforeReplace !== htmlContent) {
                console.log(`通过正则表达式恢复图片: ${srcPath}`);
            }
        }
    });
    
    console.log('图片引用恢复完成');
    
    // 最后一次检查未恢复的占位符
    const remainingPlaceholders = htmlContent.match(/<img[^>]*id=["']img-placeholder-\d+["'][^>]*>/g);
    if (remainingPlaceholders && remainingPlaceholders.length > 0) {
        console.log(`发现${remainingPlaceholders.length}个未恢复的占位符，尝试最后处理`);
        
        for (const placeholder of remainingPlaceholders) {
            const idMatch = placeholder.match(/id=["']img-placeholder-(\d+)["']/i);
            const dataSrcMatch = placeholder.match(/data-src=["']([^"']*)["']/i);
            
            if (idMatch && dataSrcMatch) {
                const src = dataSrcMatch[1];
                // 查找是否有对应的上色图片
                const colorizedSrc = src.includes('_colorized') ? src : src.replace(/\.(png|jpg|jpeg|gif|webp)$/i, '_colorized.$1');
                
                // 处理路径格式
                let webColorizedPath = colorizedSrc;
                if (!webColorizedPath.startsWith('/') && !webColorizedPath.startsWith('http')) {
                    const fileName = path.basename(webColorizedPath);
                    webColorizedPath = '/temp/' + fileName;
                    console.log(`转换占位符图片为Web路径: ${webColorizedPath}`);
                }
                
                // 使用上色图片替换占位符
                htmlContent = htmlContent.replace(placeholder, `<img src="${webColorizedPath}" data-colorized="true" alt="上色图片">`);
                console.log(`替换未恢复的占位符为上色图片: ${webColorizedPath}`);
            }
        }
    }
    
    // 确保所有相对路径都是正确的
    htmlContent = htmlContent.replace(/src=["'](\.\/)?images\//g, 'src="/images/');
    
    return htmlContent;
}

/**
 * 清理和规范化HTML内容
 * @param {string} htmlContent 原始HTML内容
 * @returns {string} 清理后的HTML内容
 */
function cleanHtmlContent(htmlContent) {
    if (!htmlContent) return '';
    
    try {
        // 1. 移除多余的空白字符
        let cleaned = htmlContent.replace(/\s+/g, ' ');
        
        // 2. 确保HTML有正确的文档结构
        if (!cleaned.includes('<html') && !cleaned.includes('<!DOCTYPE')) {
            // 不是完整的HTML文档，添加必要的标签
            cleaned = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AI增强文档</title>
</head>
<body>
    ${cleaned}
</body>
</html>`;
        }
        
        // 3. 处理特殊情况：如果内容是嵌套的HTML代码块
        if (cleaned.includes('```html')) {
            // 提取代码块中的内容
            const htmlMatch = cleaned.match(/```html\s*([\s\S]+?)\s*```/);
            if (htmlMatch && htmlMatch[1]) {
                cleaned = htmlMatch[1].trim();
                
                // 确保它有完整的HTML结构
                if (!cleaned.includes('<html') && !cleaned.includes('<!DOCTYPE')) {
                    cleaned = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AI增强文档</title>
</head>
<body>
    ${cleaned}
</body>
</html>`;
                }
            }
        }
        
        // 4. 检查是否包含body标签，如果没有则添加
        if (!cleaned.includes('<body')) {
            const htmlEndMatch = cleaned.match(/<html[^>]*>([\s\S]+)<\/html>/i);
            if (htmlEndMatch && htmlEndMatch[1]) {
                const htmlContent = htmlEndMatch[1];
                if (!htmlContent.includes('<body')) {
                    // 提取head部分
                    const headMatch = htmlContent.match(/<head>[\s\S]*?<\/head>/i);
                    const headPart = headMatch ? headMatch[0] : '<head><meta charset="UTF-8"></head>';
                    
                    // 除去head部分的剩余内容
                    const bodyContent = headMatch 
                        ? htmlContent.replace(headMatch[0], '') 
                        : htmlContent;
                    
                    // 重建HTML
                    cleaned = cleaned.replace(htmlEndMatch[1], `${headPart}<body>${bodyContent}</body>`);
                }
            }
        }
        
        // 5. 确保图片路径是正确的
        cleaned = cleaned.replace(/src="(\.\/|\/)?images\//g, 'src="/images/');
        
        return cleaned;
    } catch (error) {
        console.error('清理HTML内容时出错:', error);
        return htmlContent; // 出错时返回原始内容
    }
}

/**
 * 使用百度API美化HTML内容
 * @param {string} htmlContent 原始HTML内容
 * @param {string} prompt 优化提示
 * @param {string} apiKey 百度API Key
 * @param {string} secretKey 百度Secret Key
 * @param {object} params 参数
 * @returns {Promise<string>} 美化后的HTML内容
 */
async function beautifyWithBaidu(htmlContent, prompt, apiKey, secretKey, params = {}) {
    try {
        console.log('使用百度文心API进行文档美化');
        
        // 预处理HTML内容，将图片替换为占位符
        const { processedHtml, imageReferences } = preprocessHtmlForAI(htmlContent);
        
        // 获取访问令牌
        const accessToken = await getAccessToken(apiKey, secretKey);
        
        // 准备请求参数
        const requestData = {
            messages: [
                {
                    role: "user",
                    content: `${prompt}\n\n原始HTML：\n\`\`\`html\n${processedHtml}\n\`\`\``
                }
            ],
            temperature: params.temperature || 0.7,
            top_p: params.top_p || 0.8
        };
        
        // API请求URL
        const apiUrl = 'https://aip.baidubce.com/rpc/2.0/ai_custom/v1/wenxinworkshop/chat/completions_pro';
        
        console.log('发送百度文心API请求...');
        const response = await axios.post(
            `${apiUrl}?access_token=${accessToken}`,
            requestData,
            {
                headers: {
                    'Content-Type': 'application/json'
                }
            }
        );
        
        // 验证响应
        if (!response.data || !response.data.result) {
            console.error('百度API响应无效:', response.data);
            throw new Error('百度API响应格式错误');
        }
        
        // 从响应中提取HTML内容
        const result = response.data.result;
        console.log('收到百度API响应，长度:', result.length);
        
        // 提取HTML内容并恢复图片
        const extractedHtml = extractHtmlFromResponse(result, imageReferences);
        
        return extractedHtml;
    } catch (error) {
        console.error('百度文心API文档美化失败:', error);
        // 重新抛出错误，确保错误能被上层函数正确捕获
        throw error;
    }
}

/**
 * 本地备用美化函数，用于在API连接失败时提供基本的HTML美化
 * 这是一个简单的实现，无需网络连接，可以在API服务不可用时使用
 * @param {string} htmlContent 原始HTML内容
 * @param {string} targetFormat 目标格式 (pdf/word)
 * @param {string} customRequirements 自定义要求
 * @returns {string} 美化后的HTML内容
 */
function beautifyWithRules(htmlContent, targetFormat = 'word', customRequirements = '') {
    try {
        console.log('使用本地备用规则进行文档美化');
        
        if (!htmlContent) {
            return htmlContent;
        }
        
        // 确保HTML结构完整
        let enhancedHtml = htmlContent;
        
        // 添加基本样式
        let styles = `
        <style>
            body {
                font-family: Arial, sans-serif;
                line-height: 1.6;
                color: #333;
                max-width: 800px;
                margin: 0 auto;
                padding: 20px;
            }
            h1, h2, h3, h4, h5, h6 {
                color: #2c3e50;
                margin-top: 24px;
                margin-bottom: 16px;
                font-weight: 600;
                line-height: 1.25;
            }
            h1 { font-size: 2em; color: #1a365d; }
            h2 { font-size: 1.5em; color: #2a4365; }
            h3 { font-size: 1.25em; color: #2c5282; }
            p { margin-bottom: 16px; }
            img { max-width: 100%; height: auto; }
            table {
                border-collapse: collapse;
                width: 100%;
                margin-bottom: 16px;
            }
            th, td {
                border: 1px solid #ddd;
                padding: 8px;
                text-align: left;
            }
            th {
                background-color: #f2f2f2;
                font-weight: bold;
            }
            tr:nth-child(even) { background-color: #f9f9f9; }
        `;
        
        // 根据目标格式添加特定样式
        if (targetFormat.toLowerCase() === 'pdf') {
            styles += `
                body { 
                    font-size: 12pt;
                    line-height: 1.5;
                }
                @page {
                    margin: 2cm;
                }
                li { margin-bottom: 8px; }
                blockquote {
                    border-left: 3px solid #ccc;
                    margin-left: 0;
                    padding-left: 16px;
                    color: #555;
                }
            `;
        } else { // word格式
            styles += `
                body { 
                    font-size: 11pt; 
                    line-height: 1.4;
                }
                ul, ol { margin-bottom: 16px; }
            `;
        }
        
        // 根据自定义要求调整样式
        if (customRequirements) {
            if (customRequirements.includes('学术') || customRequirements.includes('论文')) {
                styles += `
                    body { font-family: "Times New Roman", Times, serif; }
                    h1, h2, h3 { font-weight: bold; }
                    p { text-align: justify; }
                `;
            } else if (customRequirements.includes('商务') || customRequirements.includes('报告')) {
                styles += `
                    body { font-family: Arial, sans-serif; }
                    h1, h2, h3 { color: #003366; }
                    strong { color: #003366; }
                `;
            } else if (customRequirements.includes('创意') || customRequirements.includes('设计')) {
                styles += `
                    h1 { color: #6200ea; }
                    h2 { color: #7c4dff; }
                    h3 { color: #651fff; }
                `;
            } else if (customRequirements.includes('教育') || customRequirements.includes('教材')) {
                styles += `
                    h1 { color: #2e7d32; }
                    h2 { color: #388e3c; }
                    h3 { color: #43a047; }
                    strong { background-color: #e8f5e9; padding: 0 3px; }
                `;
            }
        }
        
        styles += `</style>`;
        
        // 检查是否有<head>标签
        if (enhancedHtml.includes('<head>')) {
            // 在head标签内添加样式
            enhancedHtml = enhancedHtml.replace('</head>', `${styles}</head>`);
        } else if (enhancedHtml.includes('<html>')) {
            // 添加head标签和样式
            enhancedHtml = enhancedHtml.replace('<html>', `<html><head>${styles}</head>`);
        } else {
            // 创建完整的HTML结构
            enhancedHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>美化文档</title>
  ${styles}
</head>
<body>
  ${enhancedHtml}
</body>
</html>`;
        }
        
        console.log('本地备用美化完成，内容长度:', enhancedHtml.length);
        return enhancedHtml;
    } catch (error) {
        console.error('本地备用美化失败:', error);
        // 出错时返回原始内容
        return htmlContent;
    }
}

module.exports = {
    processAndSaveHtml,
    cleanHtmlContent,
    generateOptimizationPrompt,
    processWithDeepseek,
    extractHtmlFromResponse,
    preprocessHtmlForAI,
    beautifyWithBaidu,
    beautifyWithRules,
    getAccessToken
}; 