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
    // 安全检查，确保htmlContent不为空
    if (!htmlContent || typeof htmlContent !== 'string') {
        console.warn('预处理收到无效HTML内容', typeof htmlContent);
        return { processedHtml: '', imageReferences: [] };
    }
    
    // 记录原始长度
    console.log(`预处理前HTML长度: ${htmlContent.length}`);
    
    try {
        // 删除注释
        let processed = htmlContent.replace(/<!--[\s\S]*?-->/g, '');
        
        // 删除多余的空白，但保留换行
        processed = processed.replace(/\s+/g, ' ').replace(/>\s+</g, '><');
        
        // 保存图片引用
        const imageReferences = [];
        let imageIndex = 0;
        
        // 替换图片标签为占位符，但保存引用
        processed = processed.replace(/<img\s+([^>]*)src=["']([^"']*)["']([^>]*)>/gi, (match, beforeSrc, src, afterSrc) => {
            try {
                // 确保src存在
                if (!src) {
                    console.warn('发现无效图片src，使用默认占位符');
                    return '<img src="placeholder.jpg">';
                }
                
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
            } catch (err) {
                console.error('处理图片标签时出错:', err);
                return match; // 发生错误时保留原始标签
            }
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
    } catch (error) {
        console.error('预处理HTML时出错:', error);
        // 发生错误时返回原始内容
        return { 
            processedHtml: htmlContent,
            imageReferences: []
        };
    }
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
        
        // 修复: 增强apiKey验证，防止undefined读取length属性导致的错误
        if (!apiKey) {
            console.warn('未提供API密钥');
            throw new Error('未提供API密钥，请配置有效的API密钥');
        }
        
        // 确保apiKey是字符串类型
        if (typeof apiKey !== 'string') {
            console.warn(`API密钥类型无效，应为字符串但收到了${typeof apiKey}`);
            throw new Error('API密钥类型无效，请提供正确格式的API密钥');
        }
        
        // 安全显示API密钥 (添加更强健的安全检查)
        try {
            // 确保即使前面的检查都通过了，这里再次确认apiKey是否为有效字符串
            if (apiKey && typeof apiKey === 'string' && apiKey.length > 0) {
                console.log(`DeepSeek API密钥: ${apiKey.substring(0, 5)}...${apiKey.substring(apiKey.length-5)}`);
            } else {
                console.warn('API密钥格式不正确，无法安全显示');
            }
        } catch (error) {
            console.warn('无法安全显示API密钥，可能格式不正确:', error.message);
            // 捕获错误但不中断处理流程
        }
        
        console.log(`原始HTML内容长度: ${htmlContent.length}`);
        
        // 进一步验证API密钥
        if (apiKey.length < 20) {
            console.warn('无效的API密钥，长度不足');
            throw new Error('API密钥长度不足，请提供有效的API密钥');
        }
        
        // 预处理HTML内容，替换图片为占位符
        const { processedHtml, imageReferences } = preprocessHtmlForAI(htmlContent);
        
        // 确定格式类型
        const isPdfFormat = prompt.includes('PDF格式') || prompt.includes('优化排版为PDF');
        const isWordFormat = prompt.includes('Word格式') || prompt.includes('<span style="color:#FF0000">');
        const targetFormat = isPdfFormat ? 'pdf' : (isWordFormat ? 'word' : 'html');
        
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
        
        // 在创建axiosOptions前再次验证apiKey
        // 额外的安全检查，确保即使前面的检查出现问题，这里也能捕获
        if (!apiKey || typeof apiKey !== 'string' || apiKey.length < 10) {
            console.warn('创建API请求前发现API密钥无效');
            throw new Error('API密钥无效，无法创建请求');
        }
        
        // 添加超时和重试设置
        const axiosOptions = {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            timeout: isLongContent ? 90000 : 60000, // 增加超时时间：长内容90秒，短内容60秒
        };
        
        // 检查并输出关键参数
        console.log(`使用的温度参数: ${temperature}, 最大token: ${max_tokens}`);
        console.log(`提示词长度: ${enhancedPrompt.length}, 内容长度: ${userContent.length}`);
        
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
        const maxRetries = 3; // 增加最大重试次数，从1次增加到3次

        async function tryDeepSeekRequest() {
            try {
                // 在发送请求前再次验证apiKey有效性
                if (!apiKey || typeof apiKey !== 'string' || apiKey.length < 10) {
                    console.warn('tryDeepSeekRequest中发现API密钥无效');
                    throw new Error('API密钥无效，请检查配置');
                }
                
                console.log(`开始第${retryCount+1}次API请求...`);
                const requestStartTime = Date.now();
                
                // 记录更详细的API请求信息
                console.log('DeepSeek API请求URL: https://api.deepseek.com/v1/chat/completions');
                console.log('DeepSeek API请求方法: POST');
                console.log('DeepSeek API请求头: Authorization: Bearer sk-*****, Content-Type: application/json');
                
                // 添加请求内容的日志记录
                console.log('API请求体结构:', JSON.stringify({
                    model: requestBody.model,
                    temperature: requestBody.temperature,
                    max_tokens: requestBody.max_tokens,
                    stream: requestBody.stream,
                    message_count: requestBody.messages.length,
                    system_content_length: requestBody.messages[0].content.length,
                    user_content_length: requestBody.messages[1].content.length
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
                    
                    // 详细记录错误信息
                    console.error('完整错误响应: ', JSON.stringify({
                        status: apiError.response.status,
                        statusText: apiError.response.statusText,
                        headers: apiError.response.headers,
                        data: apiError.response.data
                    }));
                    
                    // 特别处理401错误（未授权）
                    if (apiError.response.status === 401) {
                        console.warn('API密钥无效或未授权，将使用本地备份处理');
                        return null; // 返回null表示应该使用备份处理
                    }
                    
                    // 特别处理402错误（余额不足）
                    if (apiError.response.status === 402) {
                        console.warn('API余额不足，将使用本地备份处理');
                        return null;
                    }
                    
                    // 特别处理429错误（请求过多）
                    if (apiError.response.status === 429) {
                        console.log('API请求次数超限，等待2秒后重试');
                        await new Promise(resolve => setTimeout(resolve, 2000));
                        return false; // 允许重试
                    }
                    
                    // 特别处理5xx错误（服务器错误）
                    if (apiError.response.status >= 500) {
                        console.warn(`DeepSeek服务器错误(${apiError.response.status})，将使用本地备份处理`);
                        return null;
                    }
                    
                    // 处理其他错误
                    console.error(`DeepSeek API错误: ${apiError.response.status} - ${JSON.stringify(apiError.response.data)}`);
                    return null;
                } else if (apiError.request) {
                    // 请求已发送但没有收到响应 - 超时或网络问题
                    console.error('DeepSeek API请求超时或无响应');
                    // 直接返回null，使用备份处理
                    return null;
                } else {
                    // 请求配置中发生错误
                    console.error(`DeepSeek API请求配置错误: ${apiError.message}`);
                    return null;
                }
            }
        }

        // 尝试请求，最多重试maxRetries次
        const success = await tryDeepSeekRequest();
        // 检查tryDeepSeekRequest的三种返回值:
        // true - 成功，继续处理
        // false - 失败，但可以重试
        // null - 需要使用备份处理
        
        if (success === null) {
            // 不再使用备份处理，而是直接报错
            console.log('API请求失败，无法处理请求');
            throw new Error('DeepSeek API请求失败，请稍后重试');
        }
        
        if (success === false && retryCount < maxRetries) {
            // 允许一次重试
            retryCount++;
            console.log(`DeepSeek API请求失败，进行第${retryCount}次重试...`);
            const delayTime = 2000;
            console.log(`等待${delayTime/1000}秒后重试...`);
            await new Promise(resolve => setTimeout(resolve, delayTime));
            
            const retrySuccess = await tryDeepSeekRequest();
            if (retrySuccess !== true) {
                // 如果重试也失败，直接报错
                console.log('重试失败，API请求无法完成');
                throw new Error('DeepSeek API请求重试失败，请稍后再试');
            }
        }

        if (!response || !response.data) {
            console.error('DeepSeek API响应为空或格式异常');
            throw new Error('DeepSeek API响应异常，请检查API状态');
        }
        
        // 添加全面的空值检查
        if (!response.data.choices) {
            console.error('DeepSeek API响应中缺少choices字段:', JSON.stringify(response.data));
            throw new Error('DeepSeek API响应格式异常：缺少choices字段');
        }
        
        if (!Array.isArray(response.data.choices)) {
            console.error('DeepSeek API响应中choices不是数组:', typeof response.data.choices);
            throw new Error('DeepSeek API响应格式异常：choices不是数组');
        }
        
        if (response.data.choices.length === 0) {
            console.error('DeepSeek API响应中choices数组为空');
            throw new Error('DeepSeek API响应格式异常：choices数组为空');
        }
        
        if (!response.data.choices[0]) {
            console.error('DeepSeek API响应中第一个choice项为空');
            throw new Error('DeepSeek API响应格式异常：choice项为空');
        }
        
        if (!response.data.choices[0].message) {
            console.error('DeepSeek API响应中缺少message字段:', JSON.stringify(response.data.choices[0]));
            throw new Error('DeepSeek API响应格式异常：缺少message字段');
        }
        
        if (!response.data.choices[0].message.content) {
            console.error('DeepSeek API响应中缺少content字段:', JSON.stringify(response.data.choices[0].message));
            throw new Error('DeepSeek API响应格式异常：缺少content字段');
        }
        
        // 获取并记录响应内容，确保处理是安全的
        const assistantResponse = response.data.choices[0].message.content;
        
        // 进一步检查响应内容
        if (!assistantResponse) {
            console.error('DeepSeek API响应内容为空');
            throw new Error('DeepSeek API响应内容为空，无法处理结果');
        }
        
        console.log('DeepSeek响应内容长度:', assistantResponse.length);
        
        // 提取HTML内容并还原图片
        let extractedHTML = extractHtmlFromResponse(assistantResponse, imageReferences);
        console.log('处理后的HTML内容长度:', extractedHTML.length);
        
        return extractedHTML;
    } catch (error) {
        console.error('DeepSeek API处理错误:', error);
        // 直接将错误传递给上层调用者，而不是使用备份处理
        throw error;
    }
}

/**
 * 本地备份处理HTML内容
 * 当API请求失败时使用此函数进行本地美化
 * @param {string} htmlContent 原始HTML内容
 * @param {string} prompt 优化提示
 * @param {string} targetFormat 目标格式（word/pdf/html）
 * @returns {string} 处理后的HTML内容
 */
async function fallbackProcessing(htmlContent, prompt, targetFormat = 'word') {
    console.log(`使用本地备份处理HTML内容，目标格式:${targetFormat}`);
    
    try {
        // 使用beautifyWithRules函数进行本地处理
        const enhancedHtml = beautifyWithRules(htmlContent, targetFormat, prompt);
        
        // 如果beautifyWithRules失败，使用简单增强
        if (!enhancedHtml) {
            console.log('使用极简备份处理...');
            return basicEnhanceHtml(htmlContent, targetFormat);
        }
        
        return enhancedHtml;
    } catch (error) {
        console.error('本地备份处理失败:', error);
        // 最简单的增强，确保至少返回有效的HTML
        return basicEnhanceHtml(htmlContent, targetFormat);
    }
}

/**
 * 极简HTML增强
 * 这是最后的备份，确保至少返回一个工作的文档
 * @param {string} htmlContent 原始HTML内容
 * @param {string} targetFormat 目标格式
 * @returns {string} 简单增强的HTML
 */
function basicEnhanceHtml(htmlContent, targetFormat = 'word') {
    console.log('执行极简HTML增强...');
    
    // 提取正文内容
    let bodyContent = htmlContent;
    const bodyMatch = /<body[^>]*>([\s\S]*?)<\/body>/i.exec(htmlContent);
    if (bodyMatch && bodyMatch[1]) {
        bodyContent = bodyMatch[1];
    }
    
    // 根据不同格式添加基本样式
    let cssStyles = '';
    if (targetFormat === 'word') {
        cssStyles = `
        body { font-family: Arial, sans-serif; margin: 25mm; line-height: 1.5; }
        h1, h2, h3, h4, h5, h6 { color: #333366; margin-top: 1.2em; margin-bottom: 0.6em; }
        h1 { font-size: 18pt; }
        h2 { font-size: 16pt; }
        h3 { font-size: 14pt; }
        p { margin: 10px 0; }
        table { border-collapse: collapse; width: 100%; margin: 15px 0; }
        th, td { border: 1px solid #ddd; padding: 8px; }
        th { background-color: #f2f2f2; }
        img { max-width: 100%; height: auto; }
        `;
    } else if (targetFormat === 'pdf') {
        cssStyles = `
        body { font-family: 'Times New Roman', serif; margin: 20mm; line-height: 1.4; }
        h1, h2, h3, h4, h5, h6 { color: #000066; margin-top: 1em; margin-bottom: 0.5em; }
        h1 { font-size: 16pt; text-align: center; }
        h2 { font-size: 14pt; }
        h3 { font-size: 12pt; }
        p { margin: 8px 0; text-align: justify; }
        table { border-collapse: collapse; width: 100%; margin: 12px 0; }
        th, td { border: 1px solid #000; padding: 6px; }
        th { background-color: #eee; }
        img { max-width: 95%; height: auto; display: block; margin: 10px auto; }
        `;
    } else {
        cssStyles = `
        body { font-family: system-ui, sans-serif; margin: 15px; line-height: 1.5; }
        h1, h2, h3, h4, h5, h6 { color: #0066cc; }
        p { margin: 10px 0; }
        table { border-collapse: collapse; width: 100%; }
        th, td { border: 1px solid #ccc; padding: 6px; }
        th { background-color: #f0f0f0; }
        img { max-width: 100%; height: auto; }
        `;
    }
    
    // 组装最终HTML
    return `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>${cssStyles}</style>
</head>
<body>
    ${bodyContent}
</body>
</html>`;
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
    // 安全检查，确保响应不为空
    if (!response) {
        console.error('API响应为空，无法提取HTML内容');
        return '';
    }
    
    // 确保响应是字符串类型
    if (typeof response !== 'string') {
        console.error('API响应不是字符串格式:', typeof response);
        // 尝试转换为字符串
        try {
            response = String(response);
        } catch (error) {
            console.error('无法将API响应转换为字符串:', error);
            return '';
        }
    }
    
    // 确保imageReferences是数组
    if (!Array.isArray(imageReferences)) {
        console.warn('imageReferences不是数组，重置为空数组');
        imageReferences = [];
    }
    
    console.log(`响应内容长度: ${response.length}`);
    
    // 防止处理过长的响应数据
    const MAX_RESPONSE_LENGTH = 1000000; // 1MB
    if (response.length > MAX_RESPONSE_LENGTH) {
        console.warn(`响应内容过长(${response.length})，截断为${MAX_RESPONSE_LENGTH}字节`);
        response = response.substring(0, MAX_RESPONSE_LENGTH);
    }
    
    try {
        // 尝试从不同模式中提取HTML
        const htmlMatches = response.match(/```html\n([\s\S]*?)\n```/);
        const directHtmlMatches = response.match(/<html[^>]*>([\s\S]*?)<\/html>/i);
        
        let htmlContent = '';
        
        if (htmlMatches && htmlMatches[1]) {
            console.log('从代码块中提取HTML内容');
            htmlContent = htmlMatches[1];
        } else if (directHtmlMatches && directHtmlMatches[0]) {
            console.log('从直接HTML标签中提取内容');
            htmlContent = directHtmlMatches[0];
        } else {
            // 如果以上两种方式都没有找到HTML，尝试其他方式
            console.log('使用其他方式提取HTML内容');
            
            // 1. 尝试匹配任何HTML标签段落
            const bodyContentMatch = response.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
            if (bodyContentMatch && bodyContentMatch[1]) {
                console.log('找到<body>标签内容');
                htmlContent = `<html><head><meta charset="UTF-8"></head><body>${bodyContentMatch[1]}</body></html>`;
            } else {
                // 2. 检查是否包含基本HTML元素的集合
                const hasHtmlElements = /<([a-z][a-z0-9]*)\b[^>]*>(.*?)<\/\1>/i.test(response);
                if (hasHtmlElements) {
                    console.log('找到HTML元素，将其封装为完整HTML');
                    htmlContent = `<html><head><meta charset="UTF-8"></head><body>${response}</body></html>`;
                } else {
                    // 3. 作为最后的手段，将纯文本作为HTML段落处理
                    console.log('未找到HTML内容，将响应作为纯文本处理');
                    
                    // 去除可能是指令或注释的部分
                    const cleanText = response
                        .replace(/^(以下是|这是|Here is).*?HTML内容[：:]/g, '')
                        .replace(/我已经[^]*?排版和美化/g, '')
                        .replace(/\[注.*?\]/g, '')
                        .trim();
                    
                    // 如果纯文本被换行符分隔，将其转换为段落
                    const paragraphs = cleanText.split(/\n\s*\n/)
                        .map(p => p.trim())
                        .filter(p => p)
                        .map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`)
                        .join('\n');
                    
                    htmlContent = `<html><head><meta charset="UTF-8"></head><body>${paragraphs}</body></html>`;
                }
            }
        }
        
        console.log(`提取的HTML内容长度: ${htmlContent.length}`);
        
        // 确保htmlContent不为空
        if (!htmlContent || htmlContent.length === 0) {
            console.warn('提取的HTML内容为空，返回基本HTML');
            return `<html><head><meta charset="UTF-8"></head><body><p>处理结果为空，请重试。</p></body></html>`;
        }
        
        // 安全处理图片引用
        if (imageReferences && imageReferences.length > 0) {
            try {
                // 找出所有上色图片引用，优先处理
                const colorizedReferences = imageReferences.filter(ref => ref && ref.isColorized) || [];
                
                if (colorizedReferences.length > 0) {
                    console.log(`发现${colorizedReferences.length}个上色图片引用，优先处理`);
                    
                    // 查找普通图片和占位符，替换为上色版本
                    const originalImagePattern = /<img[^>]*src=["']([^"']*?)(?:_colorized)?["'][^>]*>/gi;
                    
                    htmlContent = htmlContent.replace(originalImagePattern, (match, src) => {
                        try {
                            // 尝试找到匹配的上色图片
                            if (!src) return match; // 如果src为空，保持原始标签
                            
                            const baseSrc = src.replace(/_colorized/g, ''); // 移除可能的colorized后缀
                            const colorizedRef = colorizedReferences.find(ref => 
                                ref && ref.src && (
                                    ref.src.includes(baseSrc) || 
                                    baseSrc.includes(ref.src.replace(/_colorized/g, ''))
                                )
                            );
                            
                            if (colorizedRef && colorizedRef.src) {
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
                        } catch (err) {
                            console.error('处理上色图片替换时出错:', err);
                            return match; // 出错时保持原样
                        }
                    });
                }
                
                // 恢复常规图片引用（包括上色图片）
                console.log(`开始恢复${imageReferences.length}个图片引用...`);
                
                // 创建图片占位符和原始图片标签的映射，用于更精确的替换
                const placeholderMap = {};
                imageReferences.forEach(ref => {
                    if (ref && ref.index !== undefined) {
                        const placeholderId = `img-placeholder-${ref.index}`;
                        placeholderMap[placeholderId] = ref;
                    }
                });
                
                // 查找所有图片标签
                const imgTags = htmlContent.match(/<img[^>]*>/gi) || [];
                console.log(`找到${imgTags.length}个图片标签等待处理`);
                
                // 替换所有图片占位符
                for (const imgTag of imgTags) {
                    try {
                        // 提取id属性
                        const idMatch = imgTag.match(/id=["']img-placeholder-(\d+)["']/i);
                        if (idMatch) {
                            const placeholderId = `img-placeholder-${idMatch[1]}`;
                            const ref = placeholderMap[placeholderId];
                            
                            if (ref && ref.src) {
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
                                if (ref.attributes) {
                                    if (ref.attributes.alt) replacementTag += ` alt="${ref.attributes.alt}"`;
                                    if (ref.attributes.width) replacementTag += ` width="${ref.attributes.width}"`;
                                    if (ref.attributes.height) replacementTag += ` height="${ref.attributes.height}"`;
                                    if (ref.attributes.class) replacementTag += ` class="${ref.attributes.class}"`;
                                    if (ref.attributes.style) replacementTag += ` style="${ref.attributes.style}"`;
                                }
                                
                                // 添加colorized标记
                                if (ref.isColorized) replacementTag += ` data-colorized="true"`;
                                
                                replacementTag += '>';
                                
                                // 执行精确替换
                                htmlContent = htmlContent.replace(imgTag, replacementTag);
                                console.log(`已恢复图片: ${ref.isColorized ? '彩色版' : '普通'} - ${srcPath}`);
                            }
                        }
                    } catch (err) {
                        console.error('处理图片标签替换时出错:', err);
                        // 出错时继续下一个标签处理
                    }
                }
            } catch (imgErr) {
                console.error('处理图片引用时出错:', imgErr);
                // 出错后继续返回处理后的HTML内容
            }
        }
        
        // 确保所有相对路径都是正确的
        htmlContent = htmlContent.replace(/src=["'](\.\/)?images\//g, 'src="/images/');
        
        return htmlContent;
    } catch (error) {
        console.error('提取HTML内容时出错:', error);
        return `<html><head><meta charset="UTF-8"></head><body><p>处理内容时出错: ${error.message}</p></body></html>`;
    }
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
 * 根据规则美化HTML内容
 * 在API调用失败时作为备份处理方案
 * @param {string} htmlContent 原始HTML内容
 * @param {string} targetFormat 目标格式 (word/pdf/html)
 * @param {string} prompt 原始提示词，用于理解优化意图
 * @returns {string} 美化后的HTML
 */
function beautifyWithRules(htmlContent, targetFormat = 'word', prompt = '') {
    console.log(`执行规则美化，目标格式: ${targetFormat}`);
    
    try {
        // 在Node.js环境中使用jsdom提供DOMParser
        const { JSDOM } = require('jsdom');
        const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
        const { window } = dom;
        const { document, DOMParser, XMLSerializer } = window;
        
        // 解析HTML文档
        const doc = new DOMParser().parseFromString(htmlContent, 'text/html');
        if (!doc || !doc.body) {
            console.warn('HTML解析失败，返回原始内容');
            return htmlContent;
        }
        
        // 确保defaultView存在
        if (!doc.defaultView) {
            doc.defaultView = window;
            console.log('设置doc.defaultView为jsdom window');
        }
        
        // 根据不同格式应用不同规则
        let cssRules = '';
        
        if (targetFormat === 'word') {
            // Word格式规则
            cssRules = `
                body { font-family: Arial, sans-serif; margin: 2.5cm; line-height: 1.5; }
                h1 { font-size: 18pt; color: #333366; margin-top: 24pt; margin-bottom: 6pt; }
                h2 { font-size: 16pt; color: #333366; margin-top: 18pt; margin-bottom: 6pt; }
                h3 { font-size: 14pt; color: #333366; margin-top: 14pt; margin-bottom: 6pt; }
                h4 { font-size: 12pt; color: #333366; margin-top: 12pt; margin-bottom: 6pt; }
                p { margin: 6pt 0; }
                table { border-collapse: collapse; width: 100%; margin: 12pt 0; }
                th, td { border: 1px solid #cccccc; padding: 8pt; }
                th { background-color: #f2f2f2; }
                img { max-width: 100%; height: auto; margin: 12pt 0; }
                .highlight { background-color: yellow; }
                .important { color: #FF0000; }
                ul, ol { margin-top: 6pt; margin-bottom: 6pt; }
                li { margin-bottom: 3pt; }
            `;
            
            // 应用Word特定的处理规则
            applyWordFormatting(doc);
        } else if (targetFormat === 'pdf') {
            // PDF格式规则
            cssRules = `
                body { font-family: 'Times New Roman', serif; margin: 2cm; line-height: 1.3; }
                h1 { font-size: 16pt; color: #000066; margin-top: 18pt; margin-bottom: 6pt; text-align: center; }
                h2 { font-size: 14pt; color: #000066; margin-top: 16pt; margin-bottom: 6pt; }
                h3 { font-size: 12pt; color: #000066; margin-top: 14pt; margin-bottom: 6pt; }
                h4 { font-size: 11pt; color: #000066; margin-top: 12pt; margin-bottom: 6pt; }
                p { margin: 6pt 0; text-align: justify; }
                table { border-collapse: collapse; width: 100%; margin: 12pt 0; }
                th, td { border: 1px solid #000000; padding: 6pt; }
                th { background-color: #eeeeee; }
                img { max-width: 90%; height: auto; display: block; margin: 12pt auto; }
                ul, ol { margin-top: 6pt; margin-bottom: 6pt; }
                li { margin-bottom: 3pt; }
                .page-break { page-break-after: always; }
            `;
            
            // 应用PDF特定的处理规则
            applyPdfFormatting(doc);
        } else {
            // 通用HTML格式规则
            cssRules = `
                body { font-family: system-ui, -apple-system, BlinkMacSystemFont, sans-serif; margin: 20px; line-height: 1.6; }
                h1 { font-size: 2em; color: #0066cc; margin-top: 0.8em; margin-bottom: 0.4em; }
                h2 { font-size: 1.5em; color: #0066cc; margin-top: 0.8em; margin-bottom: 0.4em; }
                h3 { font-size: 1.2em; color: #0066cc; margin-top: 0.8em; margin-bottom: 0.4em; }
                p { margin: 0.8em 0; }
                table { border-collapse: collapse; width: 100%; margin: 1em 0; }
                th, td { border: 1px solid #dddddd; padding: 8px; }
                th { background-color: #f8f8f8; }
                img { max-width: 100%; height: auto; }
                ul, ol { margin-top: 0.8em; margin-bottom: 0.8em; }
                li { margin-bottom: 0.4em; }
            `;
        }
        
        // 根据提示词进行特定调整
        if (prompt.includes('紧凑')) {
            cssRules = cssRules.replace(/margin: \d+(\.\d+)?(pt|px|cm);/g, 'margin: 0.5em;');
            cssRules = cssRules.replace(/line-height: \d+(\.\d+)?;/g, 'line-height: 1.2;');
        }
        
        if (prompt.includes('宽松') || prompt.includes('间距大')) {
            cssRules = cssRules.replace(/margin: \d+(\.\d+)?(pt|px|cm);/g, 'margin: 3em;');
            cssRules = cssRules.replace(/line-height: \d+(\.\d+)?;/g, 'line-height: 2;');
        }
        
        // 添加样式到文档头部
        const styleTag = doc.createElement('style');
        styleTag.textContent = cssRules;
        
        // 确保有head标签
        if (!doc.head) {
            const head = doc.createElement('head');
            doc.documentElement.insertBefore(head, doc.body);
        }
        
        doc.head.appendChild(styleTag);
        
        // 清理和优化文档
        cleanupDocument(doc);
        
        // 返回处理后的HTML
        return new XMLSerializer().serializeToString(doc);
    } catch (error) {
        console.error('规则美化失败:', error);
        // 美化失败则返回原始内容
        return htmlContent;
    }
}

/**
 * 应用Word格式特定的处理
 * @param {Document} doc DOM文档
 */
function applyWordFormatting(doc) {
    try {
        // 查找标题并调整样式
        const headings = doc.querySelectorAll('h1, h2, h3, h4, h5, h6');
        headings.forEach(heading => {
            // 为Word格式设置标题前的空白
            const level = parseInt(heading.tagName.substring(1));
            heading.style.pageBreakBefore = level === 1 ? 'always' : 'auto';
        });
        
        // 美化表格
        const tables = doc.querySelectorAll('table');
        tables.forEach(table => {
            table.setAttribute('border', '1');
            table.style.borderCollapse = 'collapse';
            table.style.width = '100%';
            
            // 设置表头样式
            const headerCells = table.querySelectorAll('th');
            headerCells.forEach(cell => {
                cell.style.backgroundColor = '#f2f2f2';
                cell.style.fontWeight = 'bold';
                cell.style.textAlign = 'center';
            });
            
            // 设置表格单元格样式
            const dataCells = table.querySelectorAll('td');
            dataCells.forEach(cell => {
                cell.style.border = '1px solid #cccccc';
                cell.style.padding = '6pt';
            });
        });
        
        // 调整图片居中
        const images = doc.querySelectorAll('img');
        images.forEach(img => {
            // 创建包装div
            const wrapper = doc.createElement('div');
            wrapper.style.textAlign = 'center';
            wrapper.style.margin = '12pt 0';
            
            // 将图片放入包装div
            img.parentNode.insertBefore(wrapper, img);
            wrapper.appendChild(img);
            
            // 确保图片不超过页面宽度
            img.style.maxWidth = '100%';
            img.style.height = 'auto';
        });
    } catch (error) {
        console.error('应用Word格式化失败:', error);
    }
}

/**
 * 应用PDF格式特定的处理
 * @param {Document} doc DOM文档
 */
function applyPdfFormatting(doc) {
    try {
        // 查找大型标题并确保分页
        const h1Elements = doc.querySelectorAll('h1');
        h1Elements.forEach((h1, index) => {
            if (index > 0) {
                // 在每个大标题前添加分页符
                const pageBreak = doc.createElement('div');
                pageBreak.className = 'page-break';
                h1.parentNode.insertBefore(pageBreak, h1);
            }
            
            // 主标题居中
            h1.style.textAlign = 'center';
        });
        
        // 表格优化
        const tables = doc.querySelectorAll('table');
        tables.forEach(table => {
            table.setAttribute('border', '1');
            table.style.borderCollapse = 'collapse';
            table.style.width = '100%';
            table.style.pageBreakInside = 'avoid';
            
            // 表头加粗并设置背景色
            const headerCells = table.querySelectorAll('th');
            headerCells.forEach(cell => {
                cell.style.backgroundColor = '#eeeeee';
                cell.style.fontWeight = 'bold';
                cell.style.border = '1px solid #000000';
                cell.style.padding = '6pt';
            });
            
            // 表格单元格
            const dataCells = table.querySelectorAll('td');
            dataCells.forEach(cell => {
                cell.style.border = '1px solid #000000';
                cell.style.padding = '6pt';
            });
        });
        
        // PDF格式的图片处理
        const images = doc.querySelectorAll('img');
        images.forEach(img => {
            // 创建包装div
            const wrapper = doc.createElement('div');
            wrapper.style.textAlign = 'center';
            wrapper.style.margin = '12pt auto';
            
            // 将图片放入包装div
            img.parentNode.insertBefore(wrapper, img);
            wrapper.appendChild(img);
            
            // 确保图片大小合适
            img.style.maxWidth = '90%';
            img.style.height = 'auto';
            
            // 添加图片描述（如果有alt属性）
            if (img.alt && img.alt.trim() !== '') {
                const caption = doc.createElement('div');
                caption.style.fontStyle = 'italic';
                caption.style.fontSize = '9pt';
                caption.style.textAlign = 'center';
                caption.style.marginTop = '4pt';
                caption.textContent = img.alt;
                wrapper.appendChild(caption);
            }
        });
    } catch (error) {
        console.error('应用PDF格式化失败:', error);
    }
}

/**
 * 清理和优化文档
 * @param {Document} doc DOM文档
 */
function cleanupDocument(doc) {
    try {
        // 移除空段落
        const paragraphs = doc.querySelectorAll('p');
        paragraphs.forEach(p => {
            if (!p.textContent.trim() && !p.querySelector('img')) {
                p.parentNode.removeChild(p);
            }
        });
        
        // 移除连续换行
        const lineBreaks = doc.querySelectorAll('br');
        lineBreaks.forEach(br => {
            // 检查前一个元素是否也是br
            if (br.previousElementSibling && br.previousElementSibling.tagName === 'BR') {
                br.parentNode.removeChild(br);
            }
        });
        
        // 检查defaultView是否存在，如果不存在则跳过使用NodeFilter的部分
        if (!doc.defaultView) {
            console.log('文档没有defaultView，跳过使用NodeFilter的清理');
            return;
        }
        
        // 获取DOM环境常量
        const NodeFilter = doc.defaultView.NodeFilter;
        const Node = doc.defaultView.Node;
        
        // 清理不必要的空白和注释
        const iterator = doc.createNodeIterator(
            doc.documentElement,
            NodeFilter.SHOW_COMMENT | NodeFilter.SHOW_TEXT,
            { acceptNode: node => {
                // 过滤空白文本节点
                if (node.nodeType === Node.TEXT_NODE && node.nodeValue.trim() === '') {
                    return NodeFilter.FILTER_ACCEPT;
                }
                // 过滤注释节点
                if (node.nodeType === Node.COMMENT_NODE) {
                    return NodeFilter.FILTER_ACCEPT;
                }
                return NodeFilter.FILTER_REJECT;
            }}
        );
        
        let node;
        const nodesToRemove = [];
        while (node = iterator.nextNode()) {
            nodesToRemove.push(node);
        }
        
        // 移除收集的节点
        nodesToRemove.forEach(node => {
            try {
                node.parentNode.removeChild(node);
            } catch (e) {
                // 忽略已删除节点的错误
            }
        });
    } catch (error) {
        console.error('文档清理失败:', error);
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