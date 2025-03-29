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
        
        // 提取所有图片标签并保存为元数据
        const imageRegex = /<img\s+[^>]*>/gi;
        const images = [];
        let matchImage;
        
        // 收集所有图片标签
        while((matchImage = imageRegex.exec(htmlContent)) !== null) {
            const imgTag = matchImage[0];
            const altMatch = imgTag.match(/alt=["']([^"']*)["']/i);
            const srcMatch = imgTag.match(/src=["']([^"']*)["']/i);
            
            const imgData = {
                fullTag: imgTag,
                index: matchImage.index,
                src: srcMatch ? srcMatch[1] : '',
                alt: altMatch ? altMatch[1] : '图片'
            };
            
            images.push(imgData);
        }
        
        // 将图片标签从HTML中完全移除，而不是用占位符替换
        let strippedHtml = htmlContent;
        images.forEach(img => {
            strippedHtml = strippedHtml.replace(img.fullTag, '');
        });
        
        // 提取纯文本内容，去除所有HTML标签
        const textContent = strippedHtml.replace(/<[^>]*>/g, '');
        
        // 检测是否为儿童教育内容
        const isChildrenContent = /三年级|小学|儿童|学生|教育|课程|习题|测试卷|数学题|语文|英语|科学|课文/.test(textContent);
        
        // 根据内容类型构建不同的AI提示
        let aiPrompt = '';
        
        if (isChildrenContent) {
            aiPrompt = `
请作为一位专业的儿童教育文档排版和美化专家，对以下小学教材或习题内容进行全面的排版优化和美化处理，特别注重创建色彩丰富、生动活泼的学习材料。
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

img {
    max-width: 100%;
    border-radius: 8px;
    box-shadow: 0 3px 6px rgba(0,0,0,0.1);
    margin: 10px auto;
    display: block;
}
</style>
\`\`\`

下面是需要你美化的文档内容：

${textContent}
`;
        } else {
            aiPrompt = `
请作为一位专业的文档排版和美化专家，对以下文档内容进行全面的排版优化和美化处理。
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

请直接输出优化后的完整HTML，包含必要的CSS样式。保留所有原始图片和内容，但提高整体可读性和美观度。

下面是需要你美化的文档内容：

${textContent}
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

        // 发送API请求
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify(requestData)
        });

        // 处理API响应
        if (!response.ok) {
            const errorData = await response.text();
            console.error('DEEPSEEK API请求失败:', errorData);
            console.log('使用规则处理替代');
            return beautifyWithRules(htmlContent);
        }

        const data = await response.json();
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
        
        // 添加样式
        if (!finalHtml.includes('<style>') && isChildrenContent) {
            // 添加自定义的儿童友好样式
            finalHtml = `
<div class="document-container">
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

        img {
            max-width: 100%;
            border-radius: 8px;
            box-shadow: 0 3px 6px rgba(0,0,0,0.1);
            margin: 10px auto;
            display: block;
        }
    </style>
    ${finalHtml}
</div>`;
        } else if (!finalHtml.includes('<style>') && !isChildrenContent) {
            // 添加常规文档样式
            finalHtml = `
<div class="document-container">
    <style>
        .document-container {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
        }
        
        h1, h2, h3, h4, h5, h6 {
            color: #2c3e50;
            margin-top: 1.5em;
            margin-bottom: 0.5em;
        }
        
        h1 { font-size: 2em; border-bottom: 2px solid #3498db; padding-bottom: 0.2em; }
        h2 { font-size: 1.75em; border-bottom: 1px solid #3498db; padding-bottom: 0.2em; }
        h3 { font-size: 1.5em; color: #2980b9; }
        h4 { font-size: 1.25em; color: #3498db; }
        
        p { margin-bottom: 1em; }
        
        ul, ol { margin: 1em 0; padding-left: 2em; }
        li { margin-bottom: 0.5em; }
        
        .important {
            background-color: #e3f2fd;
            padding: 2px 6px;
            border-radius: 4px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            font-weight: bold;
        }
        
        .concept {
            background-color: #f3e5f5;
            padding: 2px 6px;
            border-radius: 4px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        
        .warning {
            background-color: #ffccbc;
            border-left: 4px solid #ff5722;
            padding: 8px 12px;
            margin: 10px 0;
            border-radius: 0 8px 8px 0;
        }
        
        .example {
            background-color: #e0f7fa;
            border-left: 4px solid #00bcd4;
            padding: 8px 12px;
            margin: 10px 0;
            border-radius: 0 8px 8px 0;
        }
        
        .conclusion {
            background-color: #e8f5e9;
            border-left: 4px solid #4caf50;
            padding: 8px 12px;
            margin: 10px 0;
            border-radius: 0 8px 8px 0;
        }
        
        table {
            width: 100%;
            border-collapse: collapse;
            margin: 1.5em 0;
            overflow: hidden;
            box-shadow: 0 2px 3px rgba(0,0,0,0.1);
        }
        
        th, td {
            border: 1px solid #ddd;
            padding: 10px;
            text-align: left;
        }
        
        th {
            background-color: #f5f5f5;
            font-weight: bold;
        }
        
        tr:nth-child(even) {
            background-color: #f9f9f9;
        }
        
        img {
            max-width: 100%;
            height: auto;
            display: block;
            margin: 1.5em 0;
            border-radius: 4px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
    </style>
    ${finalHtml}
</div>`;
        }
        
        // 用一种更可靠的方式重新插入图片
        images.forEach((img, index) => {
            // 生成可视化图片标记，这样更容易定位问题
            const imageMarker = `<!-- IMAGE_MARKER_${index} -->`;
            
            // 在finalHtml末尾添加图片容器
            finalHtml += `\n<div id="image-container-${index}" style="display:none">${img.fullTag}</div>`;
            
            // 在body结束标签前添加脚本，确保图片正确显示
            if (index === images.length - 1) {
                finalHtml += `
<script>
document.addEventListener('DOMContentLoaded', function() {
    // 显示所有图片容器
    ${images.map((_, i) => `document.getElementById('image-container-${i}').style.display = 'block';`).join('\n    ')}
});
</script>
`;
            }
        });
        
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
    // 如果未提供API密钥，回退到规则处理
    if (!apiKey) {
        console.log('未提供API密钥，使用规则处理替代');
        return beautifyWithRules(htmlContent);
    }
    
    try {
        // 根据API类型选择不同的处理方式
        if (apiType === 'deepseek') {
            console.log('使用DEEPSEEK API美化文档...');
            return await beautifyWithDeepseek(htmlContent, apiKey);
        } else {
            // 默认使用OpenAI或其他API的模拟处理
            console.log('使用默认API处理模拟美化文档...');
            // 模拟处理延迟
            await new Promise(resolve => setTimeout(resolve, 1000));
            return beautifyWithRules(htmlContent);
        }
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