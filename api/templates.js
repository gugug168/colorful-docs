// API模板文件 - 获取模板列表
module.exports = async (req, res) => {
  // 启用CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // 处理OPTIONS请求
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  try {
    // 返回预定义的默认模板
    const defaultTemplates = {
      "academic": {
        "name": "学术论文",
        "requirements": "请使用专业学术风格美化文档，包括：\n1. 标准的学术排版格式，清晰的标题层次\n2. 适合长时间阅读的字体，合理的行距和段距\n3. 图表规范布局，表格使用细线条边框\n4. 参考文献格式规范，引用清晰标注\n5. 适合打印和阅读的配色方案（以深蓝色为主）",
        "image": "/images/templates/academic.jpg",
        "format": "all"
      },
      "business": {
        "name": "商务报告",
        "requirements": "请使用专业商务风格美化文档，包括：\n1. 简洁大方的商务排版，重点突出\n2. 商务图表美化，数据可视化优化\n3. 适合商业演示的字体和配色（蓝色和灰色为主）\n4. 要点和总结使用醒目的颜色框\n5. 清晰的信息层次，便于快速浏览",
        "image": "/images/templates/business.jpg",
        "format": "all"
      },
      "education": {
        "name": "教育教材",
        "requirements": "请使用教育风格美化文档，包括：\n1. 教材风格排版，章节层次清晰\n2. 使用活泼但不过分鲜艳的颜色（适合长时间学习）\n3. 知识点突出，概念解释醒目\n4. 示例和练习区域明确区分\n5. 增加图示和提示框，便于学习和记忆",
        "image": "/images/templates/education.jpg",
        "format": "pdf"
      },
      "creative": {
        "name": "创意设计",
        "requirements": "请使用创意设计风格美化文档，包括：\n1. 富有创意的排版布局，非传统结构\n2. 大胆的配色方案和视觉元素\n3. 醒目的标题设计，使用创意字体\n4. 添加装饰性元素，增强视觉吸引力\n5. 整体风格活泼有趣，适合创意内容展示",
        "image": "/images/templates/creative.jpg",
        "format": "pdf"
      },
      "simple": {
        "name": "简约清晰",
        "requirements": "请使用简约风格美化文档，包括：\n1. 极简主义设计，减少不必要的装饰\n2. 大量留白，提高可读性\n3. 单色或双色配色方案（黑白为主，辅以一种强调色）\n4. 简洁明了的标题和分隔符\n5. 整体风格统一，追求简单与实用的平衡",
        "image": "/images/templates/simple.jpg",
        "format": "word"
      },
      "word-basic": {
        "name": "Word基础美化",
        "requirements": "请对Word文档进行适度美化，保持原始格式和结构：\n1. 仅改变文字颜色和强调重点，不改变排版\n2. 使用Word兼容的简单样式\n3. 保持原有段落和标题结构\n4. 适当调整字体大小和行距以提高可读性\n5. 不添加过多装饰元素",
        "image": "/images/templates/word-basic.jpg",
        "format": "word"
      },
      "pdf-enhanced": {
        "name": "PDF增强版",
        "requirements": "请充分利用PDF格式的优势进行全面美化：\n1. 大胆使用色彩背景和装饰元素\n2. 优化页面布局，改进视觉流程\n3. 添加适当的页眉页脚\n4. 使用图形元素和图标增强主题\n5. 利用色块、边框等元素突出重点内容",
        "image": "/images/templates/pdf-enhanced.jpg",
        "format": "pdf"
      }
    };
    
    console.log('返回模板数据, 数量:', Object.keys(defaultTemplates).length);
    return res.status(200).json({
      success: true,
      templates: defaultTemplates
    });
  } catch (error) {
    console.error('获取模板数据出错:', error);
    return res.status(500).json({
      success: false,
      message: '读取模板数据失败: ' + (error.message || '未知错误')
    });
  }
}; 