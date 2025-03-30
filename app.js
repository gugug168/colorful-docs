const express = require('express');
const path = require('path');
const multer = require('multer');
const fs = require('fs');

// 导入自定义工具
const docxConverter = require('./utils/docxConverter');
const pdfConverter = require('./utils/pdfConverter');
const aiProcessor = require('./utils/aiProcessor');
const exportUtils = require('./utils/exportUtils');
const aiOptimizer = require('./utils/aiOptimizer');

// 输出导入的模块信息，检查是否正确
console.log('工具模块加载状态:');
console.log('- docxConverter 模块:', typeof docxConverter.convertDocxToHtml === 'function' ? '正常' : '异常');
console.log('- pdfConverter 模块:', typeof pdfConverter.convertPdfToHtml === 'function' ? '正常' : '异常');
console.log('- aiProcessor 模块:', typeof aiProcessor === 'object' ? '正常' : '异常');
console.log('- exportUtils 模块:', typeof exportUtils === 'object' ? '正常' : '异常');
console.log('- aiOptimizer 模块:', typeof aiOptimizer === 'object' && typeof aiOptimizer.processAndSaveHtml === 'function' ? '正常' : '异常');

// 配置默认API配置对象
let globalApiConfig = {
  // 使用更新的API密钥 - 请替换为您的有效API密钥
  apiKey: 'sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', // 需要替换为有效的API密钥
  apiType: 'deepseek', // 当前使用的API类型
  apiModel: 'deepseek-chat', // 使用的模型名称
  apiParams: {
    openai: {
      temperature: 0.7,
      max_tokens: 16384
    },
    deepseek: {
      temperature: 0.5, // 降低温度以获得更一致的结果
      max_tokens: 4000  // 减少token以避免超出限制
    },
    qianwen: {
      temperature: 0.7,
      max_tokens: 128000
    },
    qwq: {
      temperature: 0.7,
      max_tokens: 8192
    }
  }
};

// 初始化应用
const app = express();
const port = 3000;

// 设置静态文件目录
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/temp', express.static(path.join(__dirname, 'temp')));
app.use('/downloads', express.static(path.join(__dirname, 'downloads')));
app.use('/images', express.static(path.join(__dirname, 'public', 'images')));

// 配置中间件
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 确保目录存在
['uploads', 'downloads', 'temp', 'public/images/temp', 'public/images/templates', 'data'].forEach(dir => {
  const dirPath = path.join(__dirname, dir);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
});

// 确保配置文件存在
const configPath = path.join(__dirname, 'data', 'config.json');
const templatesPath = path.join(__dirname, 'data', 'templates.json');

// 初始化配置文件
if (!fs.existsSync(configPath)) {
  fs.writeFileSync(configPath, JSON.stringify({
    apiConfig: globalApiConfig,
    apiKeys: {
      openai: '',
      deepseek: globalApiConfig.apiKey,
      qianwen: '',
      qwq: 'sk-W0rpStc95T7JVYVwDYc29IyirjtpPPby6SozFMQr17m8KWeo'
    },
    apiModels: {
      openai: 'gpt-4-turbo',
      deepseek: 'deepseek-chat',
      qianwen: 'qwen-turbo',
      qwq: 'free:QwQ-32B'
    },
    apiParams: {
      openai: {
        temperature: 0.7,
        max_tokens: 16384
      },
      deepseek: {
        temperature: 0.7,
        max_tokens: 8000
      },
      qianwen: {
        temperature: 0.7,
        max_tokens: 128000
      },
      qwq: {
        temperature: 0.7,
        max_tokens: 8192
      }
    }
  }, null, 2));
}

// 初始化模板文件
if (!fs.existsSync(templatesPath)) {
  fs.writeFileSync(templatesPath, JSON.stringify({
    templates: {
      'academic': {
        name: '学术论文',
        requirements: '请使用专业学术风格美化文档，包括：\n1. 标准的学术排版格式，清晰的标题层次\n2. 适合长时间阅读的字体，合理的行距和段距\n3. 图表规范布局，表格使用细线条边框\n4. 参考文献格式规范，引用清晰标注\n5. 适合打印和阅读的配色方案（以深蓝色为主）',
        image: '/images/templates/academic.jpg',
        format: 'all'
      },
      'business': {
        name: '商务报告',
        requirements: '请使用专业商务风格美化文档，包括：\n1. 简洁大方的商务排版，重点突出\n2. 商务图表美化，数据可视化优化\n3. 适合商业演示的字体和配色（蓝色和灰色为主）\n4. 要点和总结使用醒目的颜色框\n5. 清晰的信息层次，便于快速浏览',
        image: '/images/templates/business.jpg',
        format: 'all'
      },
      'education': {
        name: '教育教材',
        requirements: '请使用教育风格美化文档，包括：\n1. 教材风格排版，章节层次清晰\n2. 使用活泼但不过分鲜艳的颜色（适合长时间学习）\n3. 知识点突出，概念解释醒目\n4. 示例和练习区域明确区分\n5. 增加图示和提示框，便于学习和记忆',
        image: '/images/templates/education.jpg',
        format: 'pdf'
      },
      'creative': {
        name: '创意设计',
        requirements: '请使用创意设计风格美化文档，包括：\n1. 富有创意的排版布局，非传统结构\n2. 大胆的配色方案和视觉元素\n3. 醒目的标题设计，使用创意字体\n4. 添加装饰性元素，增强视觉吸引力\n5. 整体风格活泼有趣，适合创意内容展示',
        image: '/images/templates/creative.jpg',
        format: 'pdf'
      },
      'simple': {
        name: '简约清晰',
        requirements: '请使用简约风格美化文档，包括：\n1. 极简主义设计，减少不必要的装饰\n2. 大量留白，提高可读性\n3. 单色或双色配色方案（黑白为主，辅以一种强调色）\n4. 简洁明了的标题和分隔符\n5. 整体风格统一，追求简单与实用的平衡',
        image: '/images/templates/simple.jpg',
        format: 'word'
      },
      'word-basic': {
        name: 'Word基础美化',
        requirements: '请对Word文档进行适度美化，保持原始格式和结构：\n1. 仅改变文字颜色和强调重点，不改变排版\n2. 使用Word兼容的简单样式\n3. 保持原有段落和标题结构\n4. 适当调整字体大小和行距以提高可读性\n5. 不添加过多装饰元素',
        image: '/images/templates/word-basic.jpg',
        format: 'word'
      },
      'pdf-enhanced': {
        name: 'PDF增强版',
        requirements: '请充分利用PDF格式的优势进行全面美化：\n1. 大胆使用色彩背景和装饰元素\n2. 优化页面布局，改进视觉流程\n3. 添加适当的页眉页脚\n4. 使用图形元素和图标增强主题\n5. 利用色块、边框等元素突出重点内容',
        image: '/images/templates/pdf-enhanced.jpg',
        format: 'pdf'
      }
    }
  }, null, 2));
}

// 载入配置
try {
  const configData = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  globalApiConfig = configData.apiConfig;
} catch (err) {
  console.error('读取配置文件失败:', err);
}

// 配置文件上传存储
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  fileFilter: function (req, file, cb) {
    // 接受docx、pdf和图片文件
    if (file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || 
        file.mimetype === 'application/pdf' ||
        file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('只支持Word文档(.docx)、PDF文件和图片!'), false);
    }
  }
});

// 主页路由
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'index.html'));
});

// 管理后台路由
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'admin.html'));
});

// 上传文件处理路由
app.post('/upload', upload.single('document'), async (req, res) => {
  console.log('==== 开始处理文件上传请求 ====');
  
  try {
    // 检查文件是否存在
    if (!req.file) {
      console.log('错误: 未接收到文件');
      return res.status(400).json({
        success: false,
        message: '未接收到文件'
      });
    }
    
    console.log('处理上传文件:', req.file.originalname, '大小:', req.file.size, '字节');
    console.log('上传文件路径:', req.file.path);
    console.log('MIME类型:', req.file.mimetype);

    // 获取目标格式
    const targetFormat = req.body.targetFormat || 'word';
    console.log('目标格式:', targetFormat);
    
    // 获取上传的文件信息
    const originalname = req.file.originalname;
    const filename = req.file.filename;
    const filepath = req.file.path;
    const mimetype = req.file.mimetype;

    // 处理上传的文件
    let fileType = '';
    let htmlContent = '';
    let htmlPath = '';
    let errorMessage = '';

    try {
    // 判断文件类型并处理
    if (mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || 
        originalname.endsWith('.docx')) {
      // 处理DOCX文件
      fileType = 'docx';
        console.log('检测到Word文档，开始处理...');
        
        // 检查转换函数是否存在
        if (typeof docxConverter.convertDocxToHtml !== 'function') {
          throw new Error('docxConverter.convertDocxToHtml 不是有效函数，模块加载失败');
        }
        
        try {
          console.log('调用 docxConverter.convertDocxToHtml...');
      const result = await docxConverter.convertDocxToHtml(filepath);
          console.log('Word转换结果:', Object.keys(result).join(', '));
          
      htmlContent = result.html;
      htmlPath = result.htmlPath;
          
          if (!htmlContent) {
            console.warn('警告: HTML内容为空');
          }
          
          if (!htmlPath) {
            console.warn('警告: HTML路径为空');
          } else {
            console.log('生成的HTML路径:', htmlPath);
          }
          
          if (result.error) {
            errorMessage = result.error;
            console.warn('Word转换警告:', result.error);
          }
        } catch (docxError) {
          console.error('Word转换错误:', docxError);
          console.error('错误堆栈:', docxError.stack);
          // 不抛出错误，而是继续处理
          errorMessage = docxError.message;
          
          // 创建一个备用的HTML路径和内容
          const outputDir = path.join(__dirname, 'temp');
          const tempHtmlPath = path.join(outputDir, `error-${Date.now()}.html`);
          if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
          }
          
          // 简单的错误HTML
          htmlContent = `
            <!DOCTYPE html>
            <html>
            <head><title>转换错误</title></head>
            <body><p>转换文档时出错: ${docxError.message}</p></body>
            </html>
          `;
          
          fs.writeFileSync(tempHtmlPath, htmlContent);
          htmlPath = tempHtmlPath;
          console.log('创建了Word错误备用页面:', tempHtmlPath);
        }
    } else if (mimetype === 'application/pdf' || originalname.endsWith('.pdf')) {
      // 处理PDF文件
      fileType = 'pdf';
        console.log('检测到PDF文档，开始处理...');
        
        // 检查转换函数是否存在
        if (typeof pdfConverter.convertPdfToHtml !== 'function') {
          throw new Error('pdfConverter.convertPdfToHtml 不是有效函数，模块加载失败');
        }
        
        try {
          console.log('调用 pdfConverter.convertPdfToHtml...');
      const result = await pdfConverter.convertPdfToHtml(filepath);
          console.log('PDF转换结果:', Object.keys(result).join(', '));
          
      htmlContent = result.html;
      htmlPath = result.htmlPath;
          
          if (!htmlContent) {
            console.warn('警告: HTML内容为空');
          }
          
          if (!htmlPath) {
            console.warn('警告: HTML路径为空');
          } else {
            console.log('生成的HTML路径:', htmlPath);
          }
          
          if (result.error) {
            errorMessage = result.error;
            console.warn('PDF转换警告:', result.error);
          }
        } catch (pdfError) {
          console.error('PDF转换错误:', pdfError);
          console.error('错误堆栈:', pdfError.stack);
          // 不抛出错误，而是继续处理
          errorMessage = pdfError.message;
          
          // 创建一个备用的HTML路径和内容
          const outputDir = path.join(__dirname, 'temp');
          const tempHtmlPath = path.join(outputDir, `error-${Date.now()}.html`);
          if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
          }
          
          // 简单的错误HTML
          htmlContent = `
            <!DOCTYPE html>
            <html>
            <head><title>转换错误</title></head>
            <body><p>转换文档时出错: ${pdfError.message}</p></body>
            </html>
          `;
          
          fs.writeFileSync(tempHtmlPath, htmlContent);
          htmlPath = tempHtmlPath;
          console.log('创建了PDF错误备用页面:', tempHtmlPath);
        }
    } else {
      // 不支持的文件类型
        console.log('错误: 不支持的文件类型:', mimetype);
      return res.status(400).json({
        success: false,
        message: '不支持的文件类型，请上传DOCX或PDF文件'
      });
    }
    } catch (conversionError) {
      // 处理转换过程中的任何错误
      console.error('文件转换失败:', conversionError);
      console.error('错误堆栈:', conversionError.stack);
      errorMessage = conversionError.message;
      
      // 创建一个备用的HTML文件
      try {
        const outputDir = path.join(__dirname, 'temp');
        if (!fs.existsSync(outputDir)) {
          fs.mkdirSync(outputDir, { recursive: true });
        }
        
        const tempHtmlPath = path.join(outputDir, `error-${Date.now()}.html`);
        htmlContent = `
          <!DOCTYPE html>
          <html>
          <head><title>处理错误</title></head>
          <body><p>处理文档时出错: ${conversionError.message}</p></body>
          </html>
        `;
        
        fs.writeFileSync(tempHtmlPath, htmlContent);
        htmlPath = tempHtmlPath;
        console.log('创建了通用错误备用页面:', tempHtmlPath);
      } catch (fallbackError) {
        console.error('创建备用HTML失败:', fallbackError);
      }
    }

    // 安全检查：确保htmlPath不为undefined
    if (!htmlPath) {
      console.error('警告: htmlPath为undefined, 创建默认路径');
      // 创建一个备用的HTML路径
      const tempDir = path.join(__dirname, 'temp');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      
      htmlPath = path.join(tempDir, `processed-${Date.now()}.html`);
      // 保存HTML内容到文件
      try {
        fs.writeFileSync(htmlPath, htmlContent || '<!DOCTYPE html><html><body>无法处理文档内容</body></html>');
        console.log('已创建备用HTML文件:', htmlPath);
      } catch (writeError) {
        console.error('写入备用HTML失败:', writeError);
      }
    }

    // 安全获取文件名
    let safeBasename = '';
    try {
      if (typeof htmlPath === 'string') {
        safeBasename = path.basename(htmlPath);
        console.log('安全的basename:', safeBasename);
      } else {
        console.error('htmlPath不是字符串:', htmlPath);
        safeBasename = `file-${Date.now()}.html`;
        console.log('使用生成的文件名:', safeBasename);
      }
    } catch (basenameError) {
      console.error('获取文件名失败:', basenameError);
      safeBasename = `file-${Date.now()}.html`;
      console.log('使用备用文件名:', safeBasename);
    }

    // 确保下载目录存在并复制HTML文件
    try {
      const downloadsDir = path.join(__dirname, 'downloads');
      if (!fs.existsSync(downloadsDir)) {
        fs.mkdirSync(downloadsDir, { recursive: true });
      }
      
      // 将HTML复制到downloads目录
      const downloadPath = path.join(downloadsDir, safeBasename);
      fs.copyFileSync(htmlPath, downloadPath);
      console.log('HTML文件已复制到downloads目录:', downloadPath);
      
      // 使用downloads目录中的文件路径
      safeBasename = path.basename(downloadPath);
    } catch (copyError) {
      console.error('复制HTML到downloads目录失败:', copyError);
    }

    console.log('文件处理完成，准备返回结果');
    // 返回成功响应
    return res.json({
      success: true,
      uploadedFile: {
        originalname,
        filename,
        path: htmlPath,
        type: fileType,
        html: htmlContent,
        // 确保添加一个明确的下载文件路由，并确保路径存在
        downloadUrl: `/view-document/${safeBasename}`,
        message: errorMessage ? `警告：${errorMessage}` : undefined
      }
    });
  } catch (error) {
    console.error('文件上传处理错误:', error);
    console.error('错误堆栈:', error.stack);
    return res.status(500).json({
      success: false,
      message: '服务器处理文件时出错: ' + error.message
    });
  }
});

// 美化文档处理路由
app.post('/beautify', async (req, res) => {
  try {
    const { filename, targetFormat = 'word', htmlContent, customRequirements } = req.body;

    console.log('收到美化请求:', { 
      filename, 
          targetFormat,
      customRequirements: customRequirements?.length || 0,
      hasHtmlContent: !!htmlContent
    });
    
    // API配置状态日志
    console.log('当前使用的API配置:', {
      apiType: globalApiConfig.apiType,
      apiModel: globalApiConfig.apiModel,
      apiKeyLength: globalApiConfig.apiKey ? globalApiConfig.apiKey.length : 0
    });
    
    // 检查aiOptimizer模块是否可用
    if (!aiOptimizer || typeof aiOptimizer.processAndSaveHtml !== 'function') {
      console.error('aiOptimizer模块不可用或不完整', typeof aiOptimizer);
        return res.status(500).json({
          success: false,
        message: 'AI优化模块不可用，请联系管理员'
      });
    }
    
    let processedContent;
    let htmlToProcess = '';
    let htmlFilePath = '';

    // 如果直接提供了HTML内容，则使用它
    if (htmlContent) {
      console.log('使用提供的HTML内容进行美化，内容长度:', htmlContent.length);
      htmlToProcess = htmlContent;
    } else {
      // 传统方式：通过文件名查找HTML文件
      // 检查文件名是否存在
      if (!filename) {
        return res.status(400).json({
          success: false, 
          message: '缺少文件名参数'
        });
      }

      // 增强的文件查找逻辑
      let htmlFilePath = null;
      
      // 创建可能的文件路径列表
      const possiblePaths = [];
      
      // 1. 首先检查完整路径（如果传入的是完整路径）
      if (filename.includes('/') || filename.includes('\\')) {
        possiblePaths.push(filename);
        
        // 如果是绝对路径，也尝试从中提取文件名
        const extractedName = path.basename(filename);
        possiblePaths.push(path.join(__dirname, 'temp', extractedName));
        possiblePaths.push(path.join(__dirname, 'downloads', extractedName));
      }
      
      // 2. 检查给定的文件名
      possiblePaths.push(path.join(__dirname, 'temp', filename));
      possiblePaths.push(path.join(__dirname, 'downloads', filename));
      
      // 3. 如果文件名有扩展名，也尝试基础名加.html
      if (filename.includes('.') && !filename.endsWith('.html')) {
        const nameWithoutExt = filename.substring(0, filename.lastIndexOf('.'));
        possiblePaths.push(path.join(__dirname, 'temp', nameWithoutExt + '.html'));
        possiblePaths.push(path.join(__dirname, 'downloads', nameWithoutExt + '.html'));
      }
      
      // 4. 尝试添加.html扩展名
      if (!filename.endsWith('.html')) {
        possiblePaths.push(path.join(__dirname, 'temp', filename + '.html'));
        possiblePaths.push(path.join(__dirname, 'downloads', filename + '.html'));
      }
      
      console.log('尝试查找文件的可能路径:', possiblePaths);
      
      // 遍历所有可能的路径，找到第一个存在的文件
      for (const filepath of possiblePaths) {
        if (fs.existsSync(filepath)) {
          htmlFilePath = filepath;
            console.log('找到HTML文件:', htmlFilePath);
            break;
          }
        }
        
      // 如果仍然找不到文件，尝试列出temp目录中的所有文件
        if (!htmlFilePath) {
          try {
          console.log('未找到指定的HTML文件，尝试查找最近的文件...');
            const tempFiles = fs.readdirSync(path.join(__dirname, 'temp'));
            console.log('temp目录文件列表:', tempFiles);
            
          // 按修改时间排序，获取最新文件
          const tempDir = path.join(__dirname, 'temp');
          const filesWithStats = tempFiles
            .filter(file => file.endsWith('.html'))
            .map(file => {
              const filePath = path.join(tempDir, file);
              return {
                name: file,
                path: filePath,
                mtime: fs.statSync(filePath).mtime
              };
            })
            .sort((a, b) => b.mtime - a.mtime); // 最新的在前
            
          if (filesWithStats.length > 0) {
            htmlFilePath = filesWithStats[0].path;
            console.log('找到最新的HTML文件:', htmlFilePath);
          }
        } catch (listError) {
          console.error('尝试列出temp目录失败:', listError);
        }
      }

      // 检查文件是否存在
      if (!htmlFilePath || !fs.existsSync(htmlFilePath)) {
        console.error('找不到指定的HTML文件:', filename);
        return res.status(404).json({
          success: false,
          message: '找不到指定的HTML文件，请确保文件已上传并转换成功'
        });
      }

      // 读取HTML内容
      try {
        htmlToProcess = fs.readFileSync(htmlFilePath, 'utf8');
        console.log('读取到HTML内容，长度:', htmlToProcess.length);
      } catch (readError) {
        console.error('读取HTML文件失败:', readError);
        return res.status(500).json({
          success: false,
          message: '读取HTML文件时出错: ' + readError.message
        });
      }
    }

    // 检查是否处于调试模式或API密钥无效
    const debugMode = process.env.DEBUG_MODE === 'true';
    const isApiKeyInvalid = !globalApiConfig.apiKey || globalApiConfig.apiKey.length < 10;
    
    // 使用AI优化器处理内容或使用本地备用处理
    if (debugMode || isApiKeyInvalid) {
      console.log('使用本地备用模式处理HTML (调试模式或API密钥无效)');
      
      // 简单本地美化作为备用
      processedContent = {
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="UTF-8">
            <style>
              body { font-family: Arial, sans-serif; margin: 20px; color: #333; line-height: 1.6; }
              h1, h2, h3 { color: #2c3e50; }
              p { margin-bottom: 15px; }
              .highlight { background-color: #fffacd; padding: 2px; }
              img { max-width: 100%; height: auto; }
              table { border-collapse: collapse; width: 100%; margin: 15px 0; }
              table, th, td { border: 1px solid #ddd; }
              th, td { padding: 8px; text-align: left; }
              th { background-color: #f2f2f2; }
            </style>
          </head>
          <body>
            ${htmlToProcess}
          </body>
          </html>
        `,
        success: true
      };
    } else {
      try {
        // 使用全局API配置
        console.log(`使用系统配置的API：类型=${globalApiConfig.apiType}，模型=${globalApiConfig.apiModel}`);
        
        // 传递目标格式和自定义要求给AI优化器
        processedContent = await aiOptimizer.processAndSaveHtml(
          htmlToProcess, 
          'downloads',
          globalApiConfig,
          targetFormat,
          customRequirements // 添加自定义美化要求
        );
        
        console.log('AI处理完成，结果长度:', processedContent.html.length);
      } catch (aiError) {
        console.error('AI处理错误详情:', aiError);
        if (aiError.response) {
          console.error('API响应:', aiError.response.data);
        }
        console.error('错误堆栈:', aiError.stack);
        
        console.log('AI处理失败，切换到本地备用模式');
        
        // 本地备用处理
        processedContent = {
          html: `
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="UTF-8">
              <style>
                body { font-family: Arial, sans-serif; margin: 20px; color: #333; line-height: 1.6; }
                h1, h2, h3 { color: #2c3e50; }
                p { margin-bottom: 15px; }
                .error-note { color: #e74c3c; font-weight: bold; }
              </style>
            </head>
            <body>
              <div class="error-note">
                注意：AI处理失败，使用备用模式展示内容。错误信息: ${aiError.message}
              </div>
              ${htmlToProcess}
            </body>
            </html>
          `,
          success: true,
          wasBackupMode: true
        };
      }
    }

    // 保存处理后的内容
    const timestamp = Date.now();
    const processedFilename = `processed-${timestamp}.html`;
    const processedFilePath = path.join(__dirname, 'downloads', processedFilename);

    try {
      fs.writeFileSync(processedFilePath, processedContent.html);
      console.log('处理后的内容已保存到:', processedFilePath);
    } catch (writeError) {
      console.error('保存处理后的内容时出错:', writeError);
      return res.status(500).json({
        success: false,
        message: '保存处理后的内容时出错: ' + writeError.message
      });
    }

    // 返回成功响应
    return res.json({
      success: true,
      processedFile: {
        originalFilename: filename,
        path: processedFilePath,
        html: processedContent.html,
        targetFormat, // 在响应中包含目标格式
        wasBackupMode: processedContent.wasBackupMode // 标记是否使用了备用模式
      }
    });
  } catch (error) {
    console.error('文档美化处理错误:', error);
    console.error('完整错误堆栈:', error.stack);
    return res.status(500).json({
      success: false,
      message: '服务器处理文档时出错: ' + error.message
    });
  }
});

// 预览处理后的HTML
app.get('/preview/:fileName', (req, res) => {
  const fileName = req.params.fileName;
  // 确保文件名不包含路径分隔符，防止路径遍历
  const sanitizedFilename = path.basename(fileName);
  
  // 尝试在temp目录和downloads目录中查找文件
  let filePath = path.join(__dirname, 'temp', sanitizedFilename);
  
  if (!fs.existsSync(filePath)) {
    filePath = path.join(__dirname, 'downloads', sanitizedFilename);
  }
  
  if (!fs.existsSync(filePath)) {
    console.error('预览文件不存在:', filePath);
    return res.status(404).send('文件不存在或已被删除');
  }
  
  try {
    const htmlContent = fs.readFileSync(filePath, 'utf8');
    res.send(htmlContent);
  } catch (err) {
    console.error('读取预览文件出错:', err);
    res.status(500).send('加载预览失败: ' + err.message);
  }
});

// 导出文件处理路由
app.get('/export', async (req, res) => {
  try {
    const { htmlFile, format } = req.query;
    console.log('收到导出请求:', { htmlFile, format });

    // 检查参数是否存在
    if (!htmlFile || !format) {
      return res.status(400).json({
        success: false,
        message: '缺少必要的参数'
      });
    }

    // 规范化格式参数 - 将'word'转换为'docx'
    let normalizedFormat = format.toString().trim().toLowerCase();
    if (normalizedFormat === 'word') {
      normalizedFormat = 'docx';
      console.log('格式规范化: word -> docx');
    }
    
    // 验证格式是否支持
    if (normalizedFormat !== 'docx' && normalizedFormat !== 'pdf') {
      console.error('不支持的导出格式:', normalizedFormat);
      return res.status(400).json({
        success: false,
        message: '不支持的导出格式，请使用docx或pdf'
      });
    }

    // 构建HTML文件路径
    const htmlFilePath = path.join(__dirname, 'downloads', htmlFile);

    // 检查文件是否存在
    if (!fs.existsSync(htmlFilePath)) {
      return res.status(404).json({
        success: false,
        message: '找不到指定的HTML文件'
      });
    }

    // 处理文件名 - 去除时间戳和扩展名
    let outputFilename = htmlFile.replace(/processed-\d+\.html$/, '');
    // 如果文件名为空，使用默认文件名
    if (!outputFilename || outputFilename === '') {
      outputFilename = 'document';
    }
    // 添加时间戳和格式扩展名
    outputFilename = `${outputFilename}-${Date.now()}.${normalizedFormat}`;

    // 创建输出目录（如果不存在）
    if (!fs.existsSync(path.join(__dirname, 'downloads'))) {
      fs.mkdirSync(path.join(__dirname, 'downloads'), { recursive: true });
    }

    // 输出文件路径
    const outputPath = path.join(__dirname, 'downloads', outputFilename);

    // 读取HTML内容
    const htmlContent = fs.readFileSync(htmlFilePath, 'utf8');

    // 根据格式导出文件
    let exportResult;
    if (normalizedFormat === 'docx') {
      console.log('导出为Word文档...');
      exportResult = await exportUtils.exportToDocx(htmlContent, outputPath);
    } else if (normalizedFormat === 'pdf') {
      console.log('导出为PDF文档...');
      exportResult = await exportUtils.exportToPdf(htmlContent, outputPath);
    } else {
      return res.status(400).json({
        success: false,
        message: '不支持的导出格式，请使用docx或pdf'
      });
    }

    // 检查导出结果
    if (!exportResult.success) {
      return res.status(500).json({
        success: false,
        message: exportResult.message || '导出失败'
      });
    }

    // 提供下载链接
    const downloadUrl = `/downloads/${outputFilename}`;
    
    return res.json({
      success: true,
      filename: outputFilename,
      downloadUrl: downloadUrl
    });
  } catch (error) {
    console.error('导出文件处理错误:', error);
    return res.status(500).json({
      success: false,
      message: '服务器导出文件时出错: ' + error.message
    });
  }
});

// 添加处理带查询参数的下载路由
app.get('/download', (req, res) => {
  const filePath = req.query.path;
  
  if (!filePath) {
    return res.status(400).send('缺少文件路径参数');
  }
  
  console.log('使用查询参数下载文件:', filePath);
  
  // 确定文件是否存在，并尝试多种可能的路径
  let resolvedPath = '';
  
  // 判断是否为绝对路径
  if (path.isAbsolute(filePath) && fs.existsSync(filePath)) {
    resolvedPath = filePath;
  } else {
    // 如果是相对路径，尝试多种组合
    const possiblePaths = [
      filePath, // 原始路径
      path.join(__dirname, filePath), // 相对于应用根目录
      path.join(__dirname, 'downloads', path.basename(filePath)), // 在downloads目录中查找文件名
      path.join(__dirname, 'temp', path.basename(filePath)), // 在temp目录中查找文件名
    ];
    
    // 找到第一个存在的路径
    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        resolvedPath = p;
        break;
      }
    }
  }
  
  // 如果仍未找到文件，返回404
  if (!resolvedPath || !fs.existsSync(resolvedPath)) {
    console.error('下载文件不存在，尝试的路径:', filePath);
    return res.status(404).send('文件不存在或已被删除');
  }
  
  // 提取文件名，确保安全
  const fileName = path.basename(resolvedPath);
  
  // 获取文件扩展名，以设置正确的Content-Type
  const ext = path.extname(resolvedPath).toLowerCase();
  console.log('下载文件:', resolvedPath, '扩展名:', ext);
  
  try {
    // 读取文件内容
    const fileContent = fs.readFileSync(resolvedPath);
    console.log('文件大小:', fileContent.length, '字节');
    
    let contentType;
    // 根据扩展名设置Content-Type
    switch (ext) {
      case '.docx':
        contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
        break;
      case '.pdf':
        contentType = 'application/pdf';
        break;
      case '.html':
        contentType = 'text/html';
        break;
      default:
        contentType = 'application/octet-stream';
    }
    
    console.log('设置Content-Type:', contentType);
    
    // 设置响应头
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Content-Length', fileContent.length);
    
    // 发送文件内容
    res.send(fileContent);
    console.log('文件下载成功:', fileName);
  } catch (err) {
    console.error('读取或发送文件时出错:', err);
    res.status(500).send('下载失败: ' + err.message);
  }
});

// 添加favicon路由
app.get('/favicon.ico', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'images', 'favicon.svg'));
});

// 获取API配置
app.get('/api/config', (req, res) => {
  try {
    const configData = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    // 不返回实际的API密钥，只返回是否已配置
    const sanitizedConfig = {
      apiType: configData.apiConfig.apiType,
      apiModel: configData.apiConfig.apiModel,
      hasKeys: {
        openai: !!configData.apiKeys.openai,
        deepseek: !!configData.apiKeys.deepseek,
        qianwen: !!configData.apiKeys.qianwen,
        qwq: !!configData.apiKeys.qwq
      },
      apiModels: configData.apiModels,
      apiParams: configData.apiParams || {
        openai: { temperature: 0.7, max_tokens: 16384 },
        deepseek: { temperature: 0.7, max_tokens: 8000 },
        qianwen: { temperature: 0.7, max_tokens: 128000 },
        qwq: { temperature: 0.7, max_tokens: 8192 }
      }
    };
    res.json({
      success: true,
      config: sanitizedConfig
    });
  } catch (err) {
    console.error('读取API配置失败:', err);
    res.status(500).json({
      success: false,
      message: '读取API配置失败'
    });
  }
});

// 更新API配置
app.post('/api/config', (req, res) => {
  try {
    const { apiType, apiModel, apiKey, apiParams } = req.body;
    
    if (!apiType || !apiModel) {
      return res.status(400).json({
        success: false,
        message: '缺少必要参数'
      });
    }
    
    // 读取当前配置
    const configData = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    
    // 确保apiParams对象存在
    if (!configData.apiParams) {
      configData.apiParams = {
        openai: { temperature: 0.7, max_tokens: 16384 },
        deepseek: { temperature: 0.7, max_tokens: 8000 },
        qianwen: { temperature: 0.7, max_tokens: 128000 },
        qwq: { temperature: 0.7, max_tokens: 8192 }
      };
    }
    
    // 更新高级参数配置
    if (apiParams) {
      // 更新各API类型的参数
      ['openai', 'deepseek', 'qianwen', 'qwq'].forEach(type => {
        if (apiParams[type]) {
          configData.apiParams[type] = {
            temperature: apiParams[type].temperature || 0.7,
            max_tokens: apiParams[type].max_tokens || (
              type === 'openai' ? 16384 : 
              type === 'deepseek' ? 8000 : 
              type === 'qianwen' ? 128000 : 
              type === 'qwq' ? 8192 : 4000
            )
          };
        }
      });
    }
    
    // 更新配置
    configData.apiConfig = {
      apiType: apiType,
      apiModel: apiModel,
      apiKey: apiKey || configData.apiKeys[apiType] || '',
      apiParams: configData.apiParams
    };
    
    // 如果提供了API密钥，更新它
    if (apiKey) {
      configData.apiKeys[apiType] = apiKey;
    }
    
    // 更新模型
    configData.apiModels[apiType] = apiModel;
    
    // 保存配置
    fs.writeFileSync(configPath, JSON.stringify(configData, null, 2));
    
    // 更新全局配置
    globalApiConfig = configData.apiConfig;
    
    res.json({
      success: true,
      message: 'API配置已更新'
    });
  } catch (err) {
    console.error('更新API配置失败:', err);
    res.status(500).json({
      success: false,
      message: '更新API配置失败: ' + err.message
    });
  }
});

// 获取模板列表
app.get('/api/templates', (req, res) => {
  try {
    const templatesData = JSON.parse(fs.readFileSync(templatesPath, 'utf8'));
    res.json({
      success: true,
      templates: templatesData.templates
    });
  } catch (err) {
    console.error('读取模板数据失败:', err);
    res.status(500).json({
      success: false,
      message: '读取模板数据失败'
    });
  }
});

// 添加/更新模板
app.post('/api/templates', upload.single('image'), (req, res) => {
  try {
    const { id, name, requirements, format = 'all' } = req.body;
    
    if (!id || !name || !requirements) {
      return res.status(400).json({
        success: false,
        message: '缺少必要参数'
      });
    }
    
    // 读取当前模板数据
    const templatesData = JSON.parse(fs.readFileSync(templatesPath, 'utf8'));
    
    // 确定图片路径
    let imagePath = templatesData.templates[id]?.image || '';
    
    // 如果上传了新图片，处理图片
    if (req.file) {
      const imageExtension = path.extname(req.file.originalname);
      const imageFilename = `template-${id}${imageExtension}`;
      const imageDestination = path.join(__dirname, 'public', 'images', 'templates', imageFilename);
      
      // 复制上传的图片到templates目录
      fs.copyFileSync(req.file.path, imageDestination);
      
      // 更新图片路径
      imagePath = `/images/templates/${imageFilename}`;
      
      // 删除临时上传的图片
      fs.unlinkSync(req.file.path);
    }
    
    // 更新模板数据
    templatesData.templates[id] = {
      name,
      requirements,
      image: imagePath,
      format: format
    };
    
    // 保存模板数据
    fs.writeFileSync(templatesPath, JSON.stringify(templatesData, null, 2));
    
    res.json({
      success: true,
      message: '模板已保存',
      template: templatesData.templates[id]
    });
  } catch (err) {
    console.error('保存模板失败:', err);
    res.status(500).json({
      success: false,
      message: '保存模板失败: ' + err.message
    });
  }
});

// 删除模板
app.delete('/api/templates/:id', (req, res) => {
  try {
    const { id } = req.params;
    
    // 读取当前模板数据
    const templatesData = JSON.parse(fs.readFileSync(templatesPath, 'utf8'));
    
    // 检查模板是否存在
    if (!templatesData.templates[id]) {
      return res.status(404).json({
        success: false,
        message: '模板不存在'
      });
    }
    
    // 获取图片路径
    const imagePath = templatesData.templates[id].image;
    
    // 如果图片存在且是自定义图片（不是默认图片），删除它
    if (imagePath && !imagePath.includes('default') && fs.existsSync(path.join(__dirname, 'public', imagePath))) {
      fs.unlinkSync(path.join(__dirname, 'public', imagePath));
    }
    
    // 删除模板
    delete templatesData.templates[id];
    
    // 保存模板数据
    fs.writeFileSync(templatesPath, JSON.stringify(templatesData, null, 2));
    
    res.json({
      success: true,
      message: '模板已删除'
    });
  } catch (err) {
    console.error('删除模板失败:', err);
    res.status(500).json({
      success: false,
      message: '删除模板失败: ' + err.message
    });
  }
});

// 添加查看处理后文档的路由
app.get('/view-document/:filename', (req, res) => {
  try {
    const filename = req.params.filename;
    
    // 安全检查：确保文件名不为空
    if (!filename) {
      return res.status(400).send('无效的文件名');
    }
    
    // 尝试多个可能的路径
    const possiblePaths = [
      path.join(__dirname, 'downloads', filename),
      path.join(__dirname, 'temp', filename),
      path.join(__dirname, 'uploads', filename)
    ];
    
    // 找到第一个存在的文件路径
    let filePath = null;
    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        filePath = p;
        break;
      }
    }
    
    // 如果没有找到文件
    if (!filePath) {
      console.error('找不到文件:', filename, '尝试的路径:', possiblePaths);
      return res.status(404).send('文件不存在或已被删除');
    }
    
    // 读取HTML内容
    const htmlContent = fs.readFileSync(filePath, 'utf8');
    
    // 修改HTML确保图片正确加载
    const modifiedHtml = htmlContent.replace(/<img\s+src="([^"]+)"/gi, (match, src) => {
      // 如果已经是完整的URL或数据URL，保持不变
      if (src.startsWith('http') || src.startsWith('data:') || src.startsWith('/')) {
        return match;
      }
      // 否则添加相对路径前缀
      return `<img src="/uploads/${src}"`;
    });
    
    // 在HTML底部添加下载按钮
    const htmlWithDownloadButton = modifiedHtml.replace('</body>', `
      <div style="position: fixed; bottom: 20px; right: 20px; z-index: 1000;">
        <a href="/download?path=${filename}" class="btn btn-primary" style="background-color: #4CAF50; color: white; padding: 10px 15px; text-decoration: none; border-radius: 4px; font-weight: bold;">
          <i class="fas fa-download" style="margin-right: 8px;"></i>下载文档
        </a>
      </div>
    </body>`);
    
    // 发送修改后的HTML
    res.send(htmlWithDownloadButton);
  } catch (error) {
    console.error('查看文档时出错:', error);
    res.status(500).send('服务器处理文档时出错: ' + error.message);
  }
});

// 启动服务器
app.listen(port, () => {
  // 打印所有已注册的路由
  console.log('\n已注册的路由:');
  app._router.stack.forEach(function(r) {
    if (r.route && r.route.path) {
      console.log(`${Object.keys(r.route.methods).join(',')} ${r.route.path}`);
    }
  });
  
  console.log(`服务器运行在 http://localhost:${port}`);
  
  // 验证API密钥
  validateApiKey().catch(err => {
    console.warn('API密钥验证警告:', err.message);
  });
});

/**
 * 验证API密钥是否有效
 * @returns {Promise<void>}
 */
async function validateApiKey() {
  try {
    // 检查API密钥是否为默认值或明显无效值
    if (globalApiConfig.apiKey === 'sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx' || 
        globalApiConfig.apiKey.length < 20) {
      console.warn('警告: API密钥未设置或使用了默认值。美化功能将使用本地备用模式。');
      console.warn('请在app.js文件中更新globalApiConfig.apiKey为有效的API密钥。');
      return;
    }
    
    // 根据API类型进行验证
    if (globalApiConfig.apiType === 'deepseek') {
      console.log('正在验证DeepSeek API密钥...');
      try {
        const axios = require('axios');
        const response = await axios.post(
          'https://api.deepseek.com/v1/chat/completions',
          {
            model: 'deepseek-chat',
            messages: [
              { role: 'system', content: '你好' },
              { role: 'user', content: '测试API密钥是否有效' }
            ],
            max_tokens: 5
          },
          {
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${globalApiConfig.apiKey}`
            },
            timeout: 10000 // 10秒超时
          }
        );
        
        if (response.status === 200) {
          console.log('DeepSeek API密钥验证成功！美化功能可以正常使用。');
        }
      } catch (error) {
        if (error.response && error.response.status === 401) {
          throw new Error('DeepSeek API密钥无效。美化功能将使用本地备用模式。');
        } else if (error.response && error.response.status === 400) {
          throw new Error('DeepSeek API请求格式有误，请检查API版本是否更新。错误详情: ' + 
                         (error.response.data.error?.message || JSON.stringify(error.response.data)));
        } else {
          throw new Error(`DeepSeek API验证失败: ${error.message}。美化功能将使用本地备用模式。`);
        }
      }
    }
    
    // 其他API类型的验证可以类似实现
    
  } catch (error) {
    console.error('API密钥验证错误:', error);
    throw error;
  }
}