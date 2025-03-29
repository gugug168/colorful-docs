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
 * @returns {Promise<string>} - 美化后的HTML内容
 */
async function beautifyWithDeepseek(htmlContent, apiKey) {
    if (!apiKey) {
        console.log('未提供DEEPSEEK API密钥，使用规则处理替代');
        return beautifyWithRules(htmlContent);
    }
    
    try {
        console.log('调用DEEPSEEK API美化文档...');
        console.log('使用的API密钥:', apiKey ? `${apiKey.substring(0, 5)}...${apiKey.substring(apiKey.length-5)}` : '未提供');
        
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
            
            const imgData = {
                fullTag: imgTag,
                index: matchImage.index,
                src: imgSrc,
                alt: altMatch ? altMatch[1] : '图片',
                width: width,
                height: height,
                id: `img-${Date.now()}-${images.length}`
            };
            
            // 记录图片信息
            console.log(`提取图片: ID=${imgData.id}, SRC=${imgData.src}, ALT=${imgData.alt}`);
            
            // 创建图片占位标记，包含位置和尺寸信息
            const imageMarker = `<div class="image-placeholder" data-img-id="${imgData.id}" style="width:${width};height:${height};margin:10px 0;background:#f0f0f0;border:1px dashed #ccc;text-align:center;padding:20px;">[图片占位：${imgData.alt}]</div>`;
            
            // 记录图片信息
            images.push(imgData);
            
            // 替换原始图片为占位标记
            htmlWithImageMarkers = htmlWithImageMarkers.replace(imgTag, imageMarker);
        }
        
        // 提取纯文本内容，保留HTML结构但移除与图片无关的标签
        const textContent = htmlWithImageMarkers.replace(/<(?!div class="image-placeholder")[^>]*>/g, '');
        
        // 检测是否为儿童教育内容
        const isChildrenContent = /三年级|小学|儿童|学生|教育|课程|习题|测试卷|数学题|语文|英语|科学|课文/.test(textContent);
        
        // 根据内容类型构建不同的AI提示，但都包含保留图片占位符的指示
        let aiPrompt = '';
        
        if (isChildrenContent) {
            aiPrompt = `
请作为一位专业的儿童教育文档排版和美化专家，对以下小学教材或习题内容进行全面的排版优化和美化处理，特别注重创建色彩丰富、生动活泼的学习材料。

【重要提示】：文档中包含多个图片占位符 <div class="image-placeholder">，这些占位符将在处理后替换为实际图片。请确保：
1. 不要修改或删除这些占位符
2. 保持它们原有的位置和尺寸
3. 围绕这些占位符进行排版，但不要改变它们的结构

需要你完成以下具体任务：

1. 识别文档结构：
   - 分析文档的整体结构，包括标题、小标题、段落、列表和表格等元素。
   - 为不同级别的标题应用不同的颜色和样式。

2. 标记重要内容：
   - 将关键概念和术语使用<span class="important-concept">关键概念</span>标记
   - 将重要题目使用<span class="important-question">重要题目</span>标记
   - 将学习提示和要点使用<span class="study-tip">学习提示</span>标记

3. 突出显示内容：
   - 将例题和示例部分使用<span class="example">示例内容</span>标记
   - 将解答步骤使用<span class="solution-step">解答步骤</span>标记
   - 将题目条件和数据使用<span class="question-data">题目数据</span>标记
   
4. 改进题目格式：
   - 为题目添加彩色标题和背景
   - 将每道大题改为<div class="colorful-question">题目内容</div>格式
   - 将小题改为<div class="sub-question">小题内容</div>格式

5. 优化表格：
   - 为表格添加彩色表头和边框
   - 使表格更加醒目和易读
   - 将表格包装为<div class="colorful-table">表格内容</div>

6. 添加儿童友好元素：
   - 使用明亮、活泼的色彩方案
   - 添加视觉提示帮助理解和记忆
   - 确保整体风格生动有趣，适合儿童学习

请直接输出优化后的完整HTML，并在HTML中添加以下CSS样式：
\`\`\`
<style>
.document-container {
    font-family: 'Comic Sans MS', '楷体', sans-serif;
    line-height: 1.6;
    background-color: #f9f9f9;
    padding: 20px;
    border-radius: 10px;
}

.colorful-title-1 {
    color: #1565c0;
    font-size: 26px;
    text-align: center;
    margin: 15px 0;
    text-shadow: 1px 1px 2px rgba(0,0,0,0.1);
    background: linear-gradient(to right, #bbdefb, #e3f2fd);
    padding: 10px;
    border-radius: 10px;
}

.colorful-title-2 {
    color: #7b1fa2;
    font-size: 22px;
    margin: 12px 0;
    border-bottom: 2px solid #ce93d8;
    padding-bottom: 5px;
}

.colorful-question {
    background-color: #e8f5e9;
    border-left: 5px solid #4caf50;
    margin: 15px 0;
    padding: 10px 15px;
    border-radius: 0 8px 8px 0;
    box-shadow: 0 2px 5px rgba(0,0,0,0.1);
}

.sub-question {
    background-color: #f3e5f5;
    margin: 10px 0 10px 20px;
    padding: 8px 12px;
    border-radius: 5px;
    border-left: 3px solid #9c27b0;
}

.important-concept {
    font-weight: bold;
    color: #d32f2f;
    background-color: #ffebee;
    padding: 2px 5px;
    border-radius: 4px;
}

.important-question {
    font-weight: bold;
    background-color: #fff9c4;
    padding: 2px 5px;
    border-radius: 4px;
    border-bottom: 2px dotted #fbc02d;
}

.study-tip {
    background-color: #e3f2fd;
    border: 1px dashed #2196f3;
    padding: 5px 10px;
    margin: 10px 0;
    border-radius: 5px;
    font-style: italic;
}

.example {
    background-color: #e0f7fa;
    border-left: 4px solid #00bcd4;
    padding: 10px 15px;
    margin: 10px 0;
    border-radius: 0 8px 8px 0;
}

.solution-step {
    background-color: #f1f8e9;
    border-left: 3px solid #8bc34a;
    padding: 5px 10px;
    margin: 8px 0;
}

.question-data {
    font-weight: bold;
    color: #0277bd;
    background-color: #e1f5fe;
    padding: 2px 4px;
    border-radius: 3px;
}

.colorful-table {
    margin: 15px 0;
    overflow: hidden;
    border-radius: 8px;
    box-shadow: 0 3px 6px rgba(0,0,0,0.1);
}

.colorful-table table {
    width: 100%;
    border-collapse: collapse;
    border: 2px solid #7e57c2;
}

.colorful-table th {
    background-color: #d1c4e9;
    color: #4527a0;
    font-weight: bold;
    text-align: center;
    padding: 10px;
    border: 1px solid #b39ddb;
}

.colorful-table td {
    padding: 8px 10px;
    border: 1px solid #b39ddb;
}

.colorful-table tr:nth-child(even) {
    background-color: #f3e5f5;
}

.colorful-table tr:nth-child(odd) {
    background-color: #fff;
}

/* 真实图片还会单独插入，此样式是为占位符准备的 */
.image-placeholder {
    display: inline-block;
    background-color: #f0f0f0;
    border: 1px dashed #ccc;
    text-align: center;
    padding: 20px;
    margin: 10px auto;
    border-radius: 8px;
}
</style>
\`\`\`

下面是需要你美化的文档内容：

${htmlWithImageMarkers}
`;
        } else {
            aiPrompt = `
请作为一位专业的文档排版和美化专家，对以下文档内容进行全面的排版优化和美化处理。

【重要提示】：文档中包含多个图片占位符 <div class="image-placeholder">，这些占位符将在处理后替换为实际图片。请确保：
1. 不要修改或删除这些占位符
2. 保持它们原有的位置和尺寸
3. 围绕这些占位符进行排版，但不要改变它们的结构

需要你完成以下具体任务：

1. 识别文档结构：分析文档的整体结构，包括标题、小标题、段落、列表和表格等元素。

2. 标记重要内容：
   - 将关键概念和术语使用<span class="important">关键概念</span>标记
   - 将重要定义和原理使用<span class="concept">定义或原理</span>标记
   - 将需要读者特别注意的内容使用<span class="warning">注意内容</span>标记

3. 突出显示内容：
   - 将举例和示例部分使用<span class="example">示例内容</span>标记
   - 将结论和总结部分使用<span class="conclusion">结论内容</span>标记
   - 将数据和统计信息使用<span class="data">数据内容</span>标记
   
4. 改进段落格式：
   - 识别可以转换为项目符号列表的内容
   - 识别可以转换为编号列表的内容
   - 识别可以转换为表格的内容

5. 优化表格：
   - 为表格添加合适的标题
   - 确保表头行清晰标识
   - 突出显示表格中的重要数据

请直接输出优化后的完整HTML，包含必要的CSS样式。注意保留所有图片占位符的位置和结构。

下面是需要你美化的文档内容：

${htmlWithImageMarkers}
`;
        }

        // 设置API请求参数
        const apiUrl = 'https://api.deepseek.com/v1/chat/completions';
        const requestData = {
            model: 'deepseek-chat',
            messages: [
                {
                    role: 'user',
                    content: aiPrompt
                }
            ],
            temperature: 0.3,
            max_tokens: 4000
        };

        console.log('准备发送API请求到:', apiUrl);
        console.log('请求参数:', {
            model: requestData.model,
            temperature: requestData.temperature,
            max_tokens: requestData.max_tokens,
            message_length: requestData.messages[0].content.length,
        });
        console.log('使用的API密钥:', apiKey ? `${apiKey.substring(0, 5)}...${apiKey.substring(apiKey.length-5)}` : '未提供');

        // 发送API请求
        let response;
        try {
            response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify(requestData)
            });
        } catch (fetchError) {
            console.error('DEEPSEEK API请求网络错误:', fetchError.message);
            console.log('网络请求失败，使用规则处理替代');
            return beautifyWithRules(htmlContent);
        }

        // 处理API响应
        if (!response.ok) {
            let errorData;
            try {
                errorData = await response.text();
            } catch (e) {
                errorData = 'Unable to get error details';
            }
            
            console.error(`DEEPSEEK API请求失败(${response.status}): ${errorData}`);
            
            if (response.status === 401) {
                console.error('API密钥无效或未授权，请检查API密钥格式和权限');
            } else if (response.status === 429) {
                console.error('API请求过多，超出限制');
            } else if (response.status >= 500) {
                console.error('DEEPSEEK API服务器错误');
            }
            
            console.log('使用规则处理替代');
            return beautifyWithRules(htmlContent);
        }

        let data;
        try {
            data = await response.json();
            console.log('DEEPSEEK API响应成功:', {
                usage: data.usage,
                model: data.model,
                finishReason: data.choices[0].finish_reason,
                responseLength: data.choices[0].message.content.length
            });
        } catch (jsonError) {
            console.error('解析API响应JSON失败:', jsonError.message);
            console.log('JSON解析失败，使用规则处理替代');
            return beautifyWithRules(htmlContent);
        }
        
        const aiResponse = data.choices[0].message.content;

        // 提取AI回复中的HTML内容
        let enhancedHtml = aiResponse;
        
        // 如果返回是Markdown格式，尝试提取HTML部分
        const htmlMatch = enhancedHtml.match(/```html\s*([\s\S]*?)\s*```/);
        if (htmlMatch && htmlMatch[1]) {
            enhancedHtml = htmlMatch[1];
        }
        
        // 如果AI没有生成有效的HTML，使用规则处理
        if (!enhancedHtml || enhancedHtml.trim().length < 100) {
            console.log('AI返回内容无效，使用规则处理替代');
            return await beautifyWithRules(htmlContent);
        }
        
        // 处理返回结果中可能已经包含的样式
        let finalHtml = enhancedHtml;
        
        // 添加样式（如果AI没有添加）
        if (!finalHtml.includes('<style>') && isChildrenContent) {
            // ... existing styles for children content ...
        } else if (!finalHtml.includes('<style>') && !isChildrenContent) {
            // ... existing styles for regular content ...
        }
        
        // 将占位标记替换回原始图片
        images.forEach((img) => {
            // 输出要替换的图片信息，方便调试
            console.log(`准备替换图片: ID=${img.id}, SRC=${img.src}, TAG长度=${img.fullTag.length}`);
            
            // 确保img.fullTag是有效的图片标签
            if (!img.fullTag.includes('<img') || !img.src) {
                console.log(`跳过无效的图片: ID=${img.id}`);
                return;
            }
            
            // 查找占位符
            const placeholderRegex = new RegExp(`<div class="image-placeholder"[^>]*data-img-id="${img.id}"[^>]*>\\[图片占位：${img.alt}\\]<\\/div>`, 'g');
            const beforeCount = (finalHtml.match(new RegExp(`data-img-id="${img.id}"`, 'g')) || []).length;
            
            // 替换回原始图片标签
            finalHtml = finalHtml.replace(placeholderRegex, img.fullTag);
            const afterFirstReplace = (finalHtml.match(new RegExp(`data-img-id="${img.id}"`, 'g')) || []).length;
            
            // 备用替换方案1：如果找不到完全匹配的占位符，尝试查找部分匹配
            if (beforeCount === afterFirstReplace && finalHtml.includes(`data-img-id="${img.id}"`)) {
                console.log(`使用备用方案1替换: ${img.id}`);
                const backupRegex = new RegExp(`<div[^>]*data-img-id="${img.id}"[^>]*>.*?<\\/div>`, 'g');
                finalHtml = finalHtml.replace(backupRegex, img.fullTag);
            }
            
            // 备用替换方案2：如果仍然存在占位符，使用更宽松的匹配
            if (finalHtml.includes(`data-img-id="${img.id}"`)) {
                console.log(`使用备用方案2替换: ${img.id}`);
                const relaxedRegex = new RegExp(`<[^>]*data-img-id="${img.id}"[^>]*>.*?<\\/[^>]*>`, 'g');
                finalHtml = finalHtml.replace(relaxedRegex, img.fullTag);
            }
            
            // 备用替换方案3：如果前两种都失败，但找到了ID，使用最宽松的匹配
            if (finalHtml.includes(`${img.id}`)) {
                console.log(`使用备用方案3替换: ${img.id}`);
                finalHtml = finalHtml.replace(new RegExp(`<[^>]*${img.id}[^>]*>.*?<\\/[^>]*>`, 'g'), img.fullTag);
            }
            
            // 验证替换结果
            const afterReplace = (finalHtml.match(new RegExp(`data-img-id="${img.id}"`, 'g')) || []).length;
            console.log(`图片${img.id}替换结果: 之前=${beforeCount}, 之后=${afterReplace}, 成功=${beforeCount > afterReplace}`);
        });
        
        // 清理可能残留的图片占位符，确保不会漏掉任何格式的占位符
        console.log('清理可能残留的图片占位符');
        finalHtml = finalHtml.replace(/<div[^>]*class="image-placeholder"[^>]*>.*?<\/div>/g, '');
        finalHtml = finalHtml.replace(/<div[^>]*data-img-id="[^"]*"[^>]*>.*?<\/div>/g, '');
        
        return finalHtml;
    } catch (error) {
        console.error('美化文档失败:', error);
        console.log('发生错误，使用规则处理替代');
        return beautifyWithRules(htmlContent);
    }
}

/**
 * 使用AI API对文档内容进行智能美化
 * 注意：这个功能需要有效的API密钥
 * @param {string} htmlContent - 原始HTML内容
 * @param {string} apiKey - API密钥
 * @param {string} apiType - API类型，可选值：'openai'或'deepseek'
 * @returns {Promise<string>} - 美化后的HTML内容
 */
async function beautifyWithAI(htmlContent, apiKey, apiType = 'deepseek') {
    // 打印详细调试信息
    console.log('美化API调用信息:', { 
        hasApiKey: !!apiKey, 
        apiKeyLength: apiKey ? apiKey.length : 0,
        apiType: apiType,
        apiTypeIsDeepseek: apiType === 'deepseek'
    });
    
    // 如果未提供API密钥，回退到规则处理
    if (!apiKey) {
        console.log('未提供API密钥，使用规则处理替代');
        return beautifyWithRules(htmlContent);
    }
    
    try {
        // 强制使用DeepSeek，不考虑apiType参数
        console.log('尝试使用DEEPSEEK API美化文档...');
        return await beautifyWithDeepseek(htmlContent, apiKey);
    } catch (error) {
        console.error('AI美化文档失败:', error);
        console.log('回退到规则处理...');
        return beautifyWithRules(htmlContent);
    }
}

/**
 * 处理HTML内容并保存
 * @param {string} htmlContent - 原始HTML内容
 * @param {string} outputDir - 输出目录
 * @param {string} [apiKey] - 可选的API密钥
 * @param {string} [apiType] - API类型，可选值：'openai'或'deepseek'
 * @returns {Promise<object>} - 处理结果
 */
async function processAndSaveHtml(htmlContent, outputDir = 'temp', apiKey = null, apiType = 'deepseek') {
    try {
        // 确保输出目录存在
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }
        
        // 使用AI或规则处理HTML
        const processedHtml = apiKey 
            ? await beautifyWithAI(htmlContent, apiKey, apiType)
            : await beautifyWithRules(htmlContent);
        
        // 生成输出文件名
        const fileName = `processed-${Date.now()}.html`;
        const outputPath = path.join(outputDir, fileName);
        
        // 写入处理后的HTML
        fs.writeFileSync(outputPath, processedHtml);
        
        // 为了兼容前端预览路由，返回文件名而不是完整路径
        console.log(`文件已保存到: ${outputPath}`);
        
        return {
            success: true,
            html: processedHtml,
            outputPath: fileName  // 只返回文件名，不包含目录路径
        };
    } catch (error) {
        console.error('处理和保存HTML失败:', error);
        return {
            success: false,
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