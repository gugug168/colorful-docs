// AI文档优化工具
const fs = require('fs');
const path = require('path');
const axios = require('axios');

/**
 * 使用AI处理HTML内容并保存
 * @param {string} htmlContent HTML内容
 * @param {string} outputDir 输出目录
 * @param {string} apiKey API密钥
 * @param {string} targetFormat 目标格式 (word或pdf)
 * @returns {object} 处理结果
 */
async function processAndSaveHtml(htmlContent, outputDir, apiKey, targetFormat = 'word') {
    try {
        // 确保输出目录存在
        const outputPath = path.resolve(outputDir);
        if (!fs.existsSync(outputPath)) {
            fs.mkdirSync(outputPath, { recursive: true });
        }

        // 根据目标格式生成不同的优化提示
        const optimizationPrompt = generateOptimizationPrompt(htmlContent, targetFormat);

        // 使用AI处理内容
        const processedHtml = await processWithAI(htmlContent, optimizationPrompt, apiKey);

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
 * 根据目标格式生成优化提示
 * @param {string} htmlContent 原始HTML内容
 * @param {string} targetFormat 目标格式
 * @returns {string} 优化提示
 */
function generateOptimizationPrompt(htmlContent, targetFormat) {
    // 基础提示，适用于所有格式
    let prompt = `
    请分析并美化以下HTML内容，使其更具可读性和视觉吸引力。
    保持原始内容的结构和信息，但改进其布局、色彩和排版。
    使用适当的标题级别、列表样式和段落结构。
    使用清晰的字体和适当的行间距。
    为重要内容添加醒目的样式。
    `;

    // 根据目标格式添加特定优化提示
    if (targetFormat === 'word') {
        prompt += `
        由于此内容将导出为Word文档，请特别注意：
        1. 使用Word兼容的样式和排版方式
        2. 确保文本颜色和背景色的对比度适合打印
        3. 使用内联样式而不是CSS类，以确保样式在Word中正确显示
        4. 避免使用复杂的CSS效果，如阴影、渐变等，因为Word可能不支持
        5. 使用表格替代复杂的div布局
        6. 为标题使用醒目但不过分鲜艳的颜色
        7. 为重要内容添加粗体和背景高亮
        8. 确保图片有足够的分辨率以适应Word文档
        9. 保留空白区域结构，确保手动填写的空间清晰可见
        `;
    } else if (targetFormat === 'pdf') {
        prompt += `
        由于此内容将导出为PDF文档，请特别注意：
        1. 优化页面布局，考虑固定页面大小（通常为A4）
        2. 使用适合屏幕阅读的清晰字体和大小
        3. 添加适当的页边距
        4. 可以使用更丰富的颜色和视觉效果，因为PDF支持良好
        5. 确保图片和表格不会被分割到不同页面
        6. 优化标题和目录结构，便于导航
        7. 可以使用更多视觉吸引力的设计元素，如色块、边框等
        8. 保持良好的打印兼容性
        9. 确保内容的层次结构清晰
        `;
    }

    return prompt;
}

/**
 * 使用AI处理HTML内容
 * @param {string} htmlContent 原始HTML内容
 * @param {string} prompt 优化提示
 * @param {string} apiKey API密钥
 * @returns {string} 处理后的HTML内容
 */
async function processWithAI(htmlContent, prompt, apiKey) {
    try {
        // 编写API请求内容
        const userInput = `${prompt}\n\n这是要优化的HTML内容:\n\n${htmlContent}`;
        
        // 调用DeepSeek API
        const response = await axios.post(
            'https://api.deepseek.com/v1/chat/completions',
            {
                model: 'deepseek-chat',
                messages: [
                    { role: 'system', content: '你是一个专业的文档美化和排版专家。你擅长将简单的HTML文档转换为视觉吸引力强、结构清晰的文档。保持原始内容的完整性，同时改进其呈现方式。' },
                    { role: 'user', content: userInput }
                ],
                temperature: 0.7,
                max_tokens: 4000
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
        
        // 从响应中提取HTML代码块
        const htmlMatch = assistantResponse.match(/```html\n([\s\S]*?)\n```/) || 
                         assistantResponse.match(/<html[\s\S]*<\/html>/) ||
                         assistantResponse.match(/<body[\s\S]*<\/body>/);
                         
        // 如果找到HTML代码块，返回它；否则返回整个响应
        const extractedHtml = htmlMatch ? htmlMatch[1] || htmlMatch[0] : assistantResponse;
        
        // 如果返回的不是有效的HTML，进行简单的后处理
        if (!extractedHtml.includes('<html') && !extractedHtml.includes('<body')) {
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
    } catch (error) {
        console.error('调用AI API时出错:', error);
        if (error.response) {
            console.error('API响应:', error.response.data);
        }
        throw new Error(`AI处理失败: ${error.message}`);
    }
}

module.exports = {
    processAndSaveHtml
}; 