const express = require('express');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const os = require('os');
const cors = require('cors');
const crypto = require('crypto');

// 支持 .env 环境变量
require('dotenv').config();

// 导入 Supabase 客户端
const supabaseClient = require('./utils/supabaseClient');

// 简单的日志记录器对象
const logger = {
  info: (message, ...args) => console.log(`[INFO] ${message}`, ...args),
  warn: (message, ...args) => console.warn(`[WARN] ${message}`, ...args),
  error: (message, ...args) => console.error(`[ERROR] ${message}`, ...args),
  debug: (message, ...args) => console.debug(`[DEBUG] ${message}`, ...args)
};

// 导入自定义工具
const docxConverter = require('./utils/docxConverter');
const pdfConverter = require('./utils/pdfConverter');
const aiProcessor = require('./utils/aiProcessor');
const exportUtils = require('./utils/exportUtils');
const aiOptimizer = require('./utils/aiOptimizer');
const imageColorizer = require('./utils/imageColorizer');

// 导入任务处理器
const taskProcessor = require('./utils/taskProcessor');

// 输出导入的模块信息，检查是否正确
console.log('工具模块加载状态:');
console.log('- docxConverter 模块:', typeof docxConverter.convertDocxToHtml === 'function' ? '正常' : '异常');
console.log('- pdfConverter 模块:', typeof pdfConverter.convertPdfToHtml === 'function' ? '正常' : '异常');
console.log('- aiProcessor 模块:', typeof aiProcessor === 'object' ? '正常' : '异常');
console.log('- exportUtils 模块:', typeof exportUtils === 'object' ? '正常' : '异常');
console.log('- aiOptimizer 模块:', typeof aiOptimizer === 'object' && typeof aiOptimizer.processAndSaveHtml === 'function' ? '正常' : '异常');
console.log('- imageColorizer 模块:', typeof imageColorizer === 'object' && typeof imageColorizer.colorizeImages === 'function' ? '正常' : '异常');
console.log('- supabaseClient 模块:', typeof supabaseClient === 'object' ? '正常' : '异常');

// 配置默认API配置对象
let globalApiConfig = {
  // 使用环境变量中的API密钥
  apiKey: process.env.DEEPSEEK_API_KEY || '', 
  apiType: 'deepseek', // 当前使用的API类型
  apiModel: 'deepseek-chat', // 使用的模型名称
  apiParams: {
    openai: {
      temperature: 0.7,
      max_tokens: 16384
    },
    deepseek: {
      temperature: 1.0, // 用户设置的温度值
      max_tokens: 8000  // 用户设置的最大token值
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
const port = process.env.PORT || 3000;

// 设置静态文件目录
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join('/tmp', 'uploads')));
app.use('/temp', express.static(path.join('/tmp', 'temp')));
app.use('/downloads', express.static(path.join('/tmp', 'downloads')));
app.use('/images', express.static(path.join(__dirname, 'public', 'images')));

// 配置中间件
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// 确保目录存在
['uploads', 'downloads', 'temp', 'temp/images', 'public/images/templates', 'data'].forEach(dir => {
  // 修改为使用/tmp目录
  const dirPath = dir === 'data' || dir === 'public/images/templates' 
    ? path.join(__dirname, dir)  // 保留数据目录和模板目录在项目中
    : path.join('/tmp', dir);    // 其他所有目录都移到/tmp下
  
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
      qwq: ''  // 清空默认值，避免冲突
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
        temperature: 1.0,
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

// 修改 multer 配置，使用内存存储
const storage = multer.memoryStorage();

const upload = multer({ 
  storage: storage,
  limits: {
    // 修改文件大小限制，提高到50MB
    fileSize: 50 * 1024 * 1024,
  }
});

// 设置CORS - 配置允许访问该API的来源
app.use(cors());

// 首页路由
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'landing.html'));
});

// API测试页面路由
app.get('/test-deepseek', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'test-deepseek.html'));
});

// 应用页面路由
app.get('/app', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'index.html'));
});

// 上传文件处理路由
app.post('/upload', upload.single('document'), async (req, res) => {
    try {
        // 收到的请求含有编码后的文件名
        const encodedFileName = req.body.encodedFileName;
        const originalFileName = req.body.originalFileName || req.body.filename || (req.file ? req.file.originalname : 'unknown.file');
        
        console.log('收到上传文件:', {
            originalFileName: originalFileName,
            encodedFileName: encodedFileName,
            filename: req.body.filename,
            fileNameInfo: req.body.fileNameInfo ? JSON.parse(req.body.fileNameInfo) : null,
            file: req.file ? {
                originalname: req.file.originalname,
                filename: req.file.filename,
                path: req.file.path,
                size: req.file.size
            } : 'no file'
        });
        
        // 解码文件名，用于显示
        let decodedFileName;
        try {
            // 优先使用encodedFileName参数进行解码
            if (encodedFileName) {
                decodedFileName = decodeURIComponent(encodedFileName);
            } else if (req.body.filename) {
                // 尝试解码filename字段
                try {
                    decodedFileName = decodeURIComponent(req.body.filename);
                } catch (decodeErr) {
                    // 如果解码失败，可能filename已经是解码后的状态
                    decodedFileName = req.body.filename;
                }
            } else {
                // 最后使用原始文件名
                decodedFileName = originalFileName;
            }
            
            console.log('解码后的文件名:', decodedFileName);
        } catch (e) {
            console.error('解码文件名失败:', e);
            decodedFileName = originalFileName;
        }
        
        // 确保所有后续处理使用的是安全编码过的文件名
        const safeFileName = encodedFileName || encodeURIComponent(originalFileName);
        
        // 检查文件是否存在
        if (!req.file) {
            console.log('错误: 未接收到文件');
            return res.status(400).json({
                success: false,
                message: '未接收到文件'
            });
        }
        
        console.log('处理上传文件:', decodedFileName, '大小:', req.file.size, '字节');
        console.log('MIME类型:', req.file.mimetype);

        // 获取目标格式
        const targetFormat = req.body.targetFormat || 'word';
        console.log('目标格式:', targetFormat);
        
        // 获取上传的文件信息
        const buffer = req.file.buffer;
        const mimetype = req.file.mimetype;
        
        // 上传到 Supabase Storage
        const timestamp = Date.now();
        const filename = `document-${timestamp}-${safeFileName}`;
        const filePath = `uploads/${filename}`;
        
        // 上传原始文件到 Supabase
        const uploadResult = await supabaseClient.uploadFile(buffer, filePath);
        
        if (!uploadResult.success) {
            throw new Error(`上传文件到Supabase失败: ${uploadResult.error}`);
        }
        
        console.log('文件已上传到Supabase:', uploadResult.url);
        
        // 清理文件名以避免本地文件系统长度限制问题
        function sanitizeFileName(fileName, ts) {
            // 获取文件扩展名
            const extname = path.extname(fileName) || '.tmp';
            
            // 生成短文件名 - 使用时间戳和哈希
            return `doc-${ts}-${crypto.createHash('md5').update(fileName).digest('hex').substring(0, 10)}${extname}`;
        }
        
        // 生成短文件名
        const shortFilename = sanitizeFileName(safeFileName, timestamp);
        
        // 保存到本地临时文件用于处理 - 在AWS Lambda环境中，只有/tmp目录可写
        const tempDir = path.join(os.tmpdir(), 'uploads');
        console.log(`使用系统临时目录: ${tempDir}`);
        
        try {
            fs.mkdirSync(tempDir, { recursive: true });
            console.log(`临时目录创建/验证成功: ${tempDir}`);
        } catch (mkdirError) {
            console.error(`创建临时目录失败: ${mkdirError}`);
            // 如果创建特定子目录失败，尝试使用系统临时根目录
            console.log(`退回使用系统根临时目录: ${os.tmpdir()}`);
        }
        
        // 确保使用可用的目录
        const finalTempDir = fs.existsSync(tempDir) ? tempDir : os.tmpdir();
        const tempFilePath = path.join(finalTempDir, shortFilename); // 使用短文件名而不是原始长文件名
        
        try {
            fs.writeFileSync(tempFilePath, buffer);
            console.log(`文件已保存到临时路径: ${tempFilePath}`);
            
            // 验证文件写入成功
            if (fs.existsSync(tempFilePath)) {
                const stats = fs.statSync(tempFilePath);
                console.log(`临时文件大小: ${stats.size} 字节`);
            } else {
                console.error(`临时文件写入失败，文件不存在: ${tempFilePath}`);
            }
        } catch (writeError) {
            console.error(`写入临时文件失败: ${writeError}`);
            throw new Error(`无法写入临时文件: ${writeError.message}`);
        }
        
        // 处理上传的文件
        let fileType = '';
        let htmlContent = '';
        let htmlPath = '';
        let errorMessage = '';

        try {
            // 判断文件类型并处理
            if (mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || 
                mimetype === 'application/msword' ||
                safeFileName.endsWith('.docx') ||
                safeFileName.endsWith('.doc')) {
                // 处理DOCX/DOC文件
                fileType = safeFileName.endsWith('.doc') ? 'doc' : 'docx';
                console.log('检测到Word文档，开始处理...');
                
                // 检查转换函数是否存在
                if (typeof docxConverter.convertDocxToHtml !== 'function') {
                    throw new Error('docxConverter.convertDocxToHtml 不是有效函数，模块加载失败');
                }
                
                // 使用临时文件路径处理
                const result = await docxConverter.convertDocxToHtml(tempFilePath);
                htmlContent = result.html;
                htmlPath = result.htmlPath;
                
                // 将HTML上传到Supabase
                if (htmlContent) {
                    const htmlFilename = `html-${timestamp}.html`;
                    const htmlFilePath = `temp/${htmlFilename}`;
                    
                    const htmlUploadResult = await supabaseClient.uploadFile(
                        Buffer.from(htmlContent), 
                        htmlFilePath
                    );
                    
                    if (htmlUploadResult.success) {
                        htmlPath = htmlUploadResult.url;
                    } else {
                        console.warn('HTML上传到Supabase警告:', htmlUploadResult.error);
                    }
                }
                
            } else if (mimetype === 'application/pdf' || safeFileName.endsWith('.pdf')) {
                // 处理PDF文件
                fileType = 'pdf';
                console.log('检测到PDF文档，开始处理...');
                
                if (typeof pdfConverter.convertPdfToHtml !== 'function') {
                    throw new Error('pdfConverter.convertPdfToHtml 不是有效函数，模块加载失败');
                }
                
                // 使用临时文件路径处理
                const result = await pdfConverter.convertPdfToHtml(tempFilePath);
                htmlContent = result.html;
                htmlPath = result.htmlPath;
                
                // 将HTML上传到Supabase
                if (htmlContent) {
                    const htmlFilename = `html-${timestamp}.html`;
                    const htmlFilePath = `temp/${htmlFilename}`;
                    
                    const htmlUploadResult = await supabaseClient.uploadFile(
                        Buffer.from(htmlContent), 
                        htmlFilePath
                    );
                    
                    if (htmlUploadResult.success) {
                        htmlPath = htmlUploadResult.url;
                    } else {
                        console.warn('HTML上传到Supabase警告:', htmlUploadResult.error);
                    }
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
            
            // 创建一个备用的HTML内容
            htmlContent = `
                <!DOCTYPE html>
                <html>
                <head><title>处理错误</title></head>
                <body><p>处理文档时出错: ${conversionError.message}</p></body>
                </html>
            `;
            
            // 上传错误HTML到Supabase
            const htmlFilename = `error-${timestamp}.html`;
            const htmlFilePath = `temp/${htmlFilename}`;
            
            const htmlUploadResult = await supabaseClient.uploadFile(
                Buffer.from(htmlContent), 
                htmlFilePath
            );
            
            if (htmlUploadResult.success) {
                htmlPath = htmlUploadResult.url;
            }
        }

        // 确保临时文件被删除
        try {
            fs.unlinkSync(tempFilePath);
        } catch (err) {
            console.warn('删除临时文件失败:', err);
        }

        console.log('文件处理完成，准备返回结果');
        
        // 返回成功响应
        return res.json({
            success: true,
            uploadedFile: {
                originalname: decodedFileName,
                filename,
                path: htmlPath,
                url: htmlPath, // 使用Supabase URL
                type: fileType,
                html: htmlContent,
                downloadUrl: htmlPath,
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

// 创建美化任务
app.post('/beautify-task', async (req, res) => {
    try {
        console.log('收到美化任务请求:', req.body);
        
        // 获取参数
        const { filePath, filename, targetFormat = 'word', apiType = 'deepseek', templateId = '', customRequirements = '' } = req.body;
        
        // 验证文件路径和文件名
        if (!filePath || !filename) {
            return res.status(400).json({
                success: false,
                message: '缺少文件路径或文件名'
            });
        }
        
        console.log('处理文件:', filename, '路径:', filePath);
        
        // 获取文件HTML内容
        let htmlContent = '';
        
        // 尝试从多个可能的位置加载原始HTML文件
        const possiblePaths = [
            filePath, // 原始路径
            path.join('/tmp', 'temp', path.basename(filePath)), // 在temp目录中查找文件名
            path.join('/tmp', 'uploads', path.basename(filePath)), // 在uploads目录中查找文件名
            // 向后兼容旧路径
            path.join(__dirname, 'temp', path.basename(filePath)),
            path.join(__dirname, 'uploads', path.basename(filePath))
        ];
        
        let foundHtmlPath = '';
        for (const p of possiblePaths) {
            if (fs.existsSync(p)) {
                console.log('找到文件:', p);
                try {
                    htmlContent = fs.readFileSync(p, 'utf8');
                    foundHtmlPath = p;
                    break;
                } catch (err) {
                    console.error('读取文件失败:', p, err);
                }
            }
        }
        
        // 如果没有找到HTML内容但文件确实存在 - 可能是二进制文件，需要转换
        if (!htmlContent && foundHtmlPath) {
            console.log('找到文件但无法直接读取为HTML，尝试转换:', foundHtmlPath);
            
            // 根据扩展名转换
            const ext = path.extname(foundHtmlPath).toLowerCase();
            if (ext === '.docx' || ext === '.doc') {
                try {
                    const conversionResult = await docxConverter.convertDocxToHtml(foundHtmlPath);
                    if (conversionResult.success) {
                        htmlContent = conversionResult.html;
                        console.log('成功将Word文档转换为HTML');
                    } else {
                        throw new Error('Word转HTML失败: ' + conversionResult.error);
                    }
                } catch (err) {
                    console.error('转换Word文档失败:', err);
                    return res.status(500).json({
                        success: false,
                        message: '转换Word文档失败: ' + err.message
                    });
                }
            } else if (ext === '.pdf') {
                try {
                    const conversionResult = await pdfConverter.convertPdfToHtml(foundHtmlPath);
                    if (conversionResult.success) {
                        htmlContent = conversionResult.html;
                        console.log('成功将PDF转换为HTML');
                    } else {
                        throw new Error('PDF转HTML失败: ' + conversionResult.error);
                    }
                } catch (err) {
                    console.error('转换PDF文档失败:', err);
                    return res.status(500).json({
                        success: false,
                        message: '转换PDF文档失败: ' + err.message
                    });
                }
            } else {
                return res.status(400).json({
                    success: false,
                    message: '不支持的文件类型: ' + ext
                });
            }
        }
        
        // 如果仍然没有HTML内容
        if (!htmlContent) {
            console.error('无法获取HTML内容');
            return res.status(404).json({
                success: false,
                message: '无法获取文件内容，文件可能不存在或格式不支持'
            });
        }
        
        // 获取API密钥 - 根据选择的API类型
        const configData = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        const apiKey = configData.apiKeys[apiType] || '';
        
        // 获取模板信息
        let templateRequirements = '';
        if (templateId) {
            try {
                const templatesData = JSON.parse(fs.readFileSync(templatesPath, 'utf8'));
                if (templatesData.templates[templateId]) {
                    templateRequirements = templatesData.templates[templateId].requirements || '';
                }
            } catch (err) {
                console.error('读取模板信息失败:', err);
            }
        }
        
        // 合并模板要求和自定义要求
        let finalRequirements = '';
        if (templateRequirements && customRequirements) {
            finalRequirements = templateRequirements + '\n\n' + customRequirements;
        } else {
            finalRequirements = templateRequirements || customRequirements;
        }
        
        // 准备任务数据
        const taskData = {
            filename: filename,
            filePath: filePath,
            htmlContent: htmlContent,
            targetFormat: targetFormat,
            apiType: apiType,
            apiKey: apiKey,
            customRequirements: finalRequirements,
            taskType: 'beautify',
            createdAt: new Date().toISOString()
        };
        
        // 创建任务
        const taskResult = await supabaseClient.createTask(taskData);
        
        if (!taskResult.success) {
            throw new Error(`创建任务失败: ${taskResult.error}`);
        }
        
        // 返回任务ID
        res.json({
            success: true,
            taskId: taskResult.taskId,
            status: 'pending',
            message: '美化任务已提交，请稍后检查结果'
        });
        
    } catch (error) {
        console.error('创建美化任务出错:', error);
        res.status(500).json({ 
            success: false,
            error: error.message 
        });
    }
});

// 查询任务状态
app.get('/check-task/:taskId', async (req, res) => {
    try {
        const taskId = req.params.taskId;
        
        // 获取任务信息
        const taskResult = await supabaseClient.getTask(taskId);
        
        if (!taskResult.success) {
            return res.status(404).json({ 
                success: false, 
                error: `任务不存在或已过期: ${taskResult.error}` 
            });
        }
        
        const task = taskResult.task;
        
        // 返回任务状态和结果
        res.json({
            success: true,
            taskId: task.id,
            status: task.status,
            result: task.result,
            error: task.error,
            progress: getTaskProgress(task),
            createdAt: task.created_at,
            updatedAt: task.updated_at
        });
        
    } catch (error) {
        console.error('获取任务状态出错:', error);
        res.status(500).json({ error: error.message });
    }
});

// 添加API格式的任务状态查询路由 - 与前端代码匹配
app.get('/api/task-status', async (req, res) => {
    try {
        const taskId = req.query.taskId;
        
        if (!taskId) {
            return res.status(400).json({
                success: false,
                error: '缺少必要的taskId参数'
            });
        }
        
        // 获取任务信息
        const taskResult = await supabaseClient.getTask(taskId);
        
        if (!taskResult.success) {
            return res.status(404).json({ 
                success: false, 
                error: `任务不存在或已过期: ${taskResult.error}` 
            });
        }
        
        const task = taskResult.task;
        
        // 返回任务状态和结果
        res.json({
            success: true,
            taskId: task.id,
            status: task.status,
            result: task.result,
            error: task.error,
            progress: getTaskProgress(task),
            createdAt: task.created_at,
            updatedAt: task.updated_at
        });
        
    } catch (error) {
        console.error('API获取任务状态出错:', error);
        res.status(500).json({ error: error.message });
    }
});

// 计算任务进度
function getTaskProgress(task) {
    switch (task.status) {
        case 'pending':
            return 0;
        case 'processing':
            // 计算处理时间占比
            const processingStartTime = new Date(task.updated_at).getTime();
            const now = Date.now();
            const elapsed = now - processingStartTime;
            // 假设平均处理时间为60秒
            const progress = Math.min(Math.floor((elapsed / 60000) * 100), 95);
            return progress;
        case 'completed':
            return 100;
        case 'failed':
            return 0;
        default:
            return 0;
    }
}

// 预览处理后的HTML
app.get('/preview/:fileName', (req, res) => {
  try {
    const fileName = req.params.fileName;
    // 安全检查：确保文件名不包含路径分隔符，防止路径遍历
    const sanitizedFilename = path.basename(fileName);
    
    // 尝试在temp目录和downloads目录中查找文件 - 使用/tmp路径
    let filePath = path.join('/tmp', 'temp', sanitizedFilename);
    
    if (!fs.existsSync(filePath)) {
      filePath = path.join('/tmp', 'downloads', sanitizedFilename);
    }
    
    // 如果仍找不到，尝试在原始项目目录中查找（向后兼容）
    if (!fs.existsSync(filePath)) {
      filePath = path.join(__dirname, 'temp', sanitizedFilename);
    }
    
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
  } catch (error) {
    console.error('预览处理出错:', error);
    res.status(500).send('加载预览失败: ' + error.message);
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

    // 构建HTML文件路径 - 优先使用/tmp目录
    let htmlFilePath = path.join('/tmp', 'downloads', htmlFile);

    // 检查文件是否存在
    if (!fs.existsSync(htmlFilePath)) {
      // 尝试在temp目录查找
      htmlFilePath = path.join('/tmp', 'temp', htmlFile);
      
      // 向后兼容 - 检查原始路径
      if (!fs.existsSync(htmlFilePath)) {
        htmlFilePath = path.join(__dirname, 'downloads', htmlFile);
        
        if (!fs.existsSync(htmlFilePath)) {
          htmlFilePath = path.join(__dirname, 'temp', htmlFile);
          
          if (!fs.existsSync(htmlFilePath)) {
            return res.status(404).json({
              success: false,
              message: '找不到指定的HTML文件'
            });
          }
        }
      }
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
    const outputDir = path.join('/tmp', 'downloads');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // 输出文件路径
    const outputPath = path.join(outputDir, outputFilename);

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
  try {
    const filePath = req.query.path;
    
    if (!filePath) {
      return res.status(400).send('缺少文件路径参数');
    }
    
    console.log('收到下载请求，文件路径:', filePath);
    
    // 确定文件是否存在，并尝试多种可能的路径
    let resolvedPath = '';
    
    // 判断是否为绝对路径
    if (path.isAbsolute(filePath) && fs.existsSync(filePath)) {
      resolvedPath = filePath;
    } else {
      // 如果是相对路径，尝试多种组合
      const possiblePaths = [
        filePath, // 原始路径
        path.join('/tmp', filePath), // 相对于/tmp目录
        path.join('/tmp', 'downloads', filePath), // 在/tmp/downloads目录中查找文件名
        path.join('/tmp', 'temp', filePath), // 在/tmp/temp目录中查找文件名
        path.join('/tmp', 'downloads', path.basename(filePath)), // 在/tmp/downloads目录中查找文件名
        path.join('/tmp', 'temp', path.basename(filePath)), // 在/tmp/temp目录中查找文件名
        // 向后兼容原始路径
        path.join(__dirname, filePath), // 相对于应用根目录
        path.join(__dirname, 'downloads', filePath), // 在downloads目录中查找文件名
        path.join(__dirname, 'temp', filePath), // 在temp目录中查找文件名
        path.join(__dirname, 'downloads', path.basename(filePath)), // 在downloads目录中查找文件名
        path.join(__dirname, 'temp', path.basename(filePath)), // 在temp目录中查找文件名
      ];
      
      console.log('尝试以下路径:', possiblePaths);
      
      // 找到第一个存在的路径
      for (const p of possiblePaths) {
        if (fs.existsSync(p)) {
          resolvedPath = p;
          console.log('找到匹配的文件路径:', p);
          break;
        }
      }
    }
    
    // 如果仍未找到文件，返回404
    if (!resolvedPath || !fs.existsSync(resolvedPath)) {
      console.error('下载文件不存在，请求的路径:', filePath);
      return res.status(404).send('文件不存在或已被删除');
    }
    
    // 获取文件名和扩展名
    const fileName = path.basename(resolvedPath);
    
    // 设置响应头，指示浏览器下载文件
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);
    res.setHeader('Content-Type', 'application/octet-stream');
    
    // 如果是HTML文件，检查是否有对应的Word或PDF版本
    if (fileName.endsWith('.html')) {
      const baseFileName = fileName.replace('.html', '');
      const wordPath = path.join(path.dirname(resolvedPath), `${baseFileName}.docx`);
      const pdfPath = path.join(path.dirname(resolvedPath), `${baseFileName}.pdf`);
      
      // 优先使用Word或PDF版本（如果存在）
      if (fs.existsSync(wordPath)) {
        res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(path.basename(wordPath))}"`);
        console.log('找到Word文档版本，将下载它:', wordPath);
        return fs.createReadStream(wordPath).pipe(res);
      } else if (fs.existsSync(pdfPath)) {
        res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(path.basename(pdfPath))}"`);
        console.log('找到PDF文档版本，将下载它:', pdfPath);
        return fs.createReadStream(pdfPath).pipe(res);
      }
    }
    
    // 发送文件
    fs.createReadStream(resolvedPath).pipe(res);
    console.log('文件下载已启动:', fileName);
  } catch (err) {
    console.error('处理下载请求时出错:', err);
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
    console.log('收到模板列表请求');
    const templatesData = JSON.parse(fs.readFileSync(templatesPath, 'utf8'));
    
    console.log('读取模板成功，模板数量:', Object.keys(templatesData.templates).length);
    console.log('模板ID列表:', Object.keys(templatesData.templates).join(', '));
    
    res.json({
      success: true,
      templates: templatesData.templates
    });
    console.log('已发送模板数据响应');
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
    
    console.log('请求查看文档:', filename);
    
    // 尝试多个可能的路径，优先使用/tmp目录
    const possiblePaths = [
      path.join('/tmp', 'downloads', filename),
      path.join('/tmp', 'temp', filename),
      path.join('/tmp', 'uploads', filename),
      // 向后兼容，旧的路径
      path.join(__dirname, 'downloads', filename),
      path.join(__dirname, 'temp', filename),
      path.join(__dirname, 'uploads', filename)
    ];
    
    // 找到第一个存在的文件路径
    let filePath = null;
    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        filePath = p;
        console.log('找到文件:', p);
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
    
    // 添加头部样式以支持图片放大和提示文字
    const htmlWithStyles = modifiedHtml.replace('</head>', `
    <style>
      /* 图片部分显示和放大效果 */
      img {
        max-width: 100% !important;
        height: auto !important;
        max-height: 150px !important; /* 限制默认状态下的图片高度 */
        display: block;
        margin: 10px auto;
        border-radius: 4px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        cursor: zoom-in;
        transition: max-height 0.3s ease, transform 0.3s ease;
        position: relative;
      }
      
      img:hover {
        max-height: none !important; /* 鼠标悬停时取消高度限制 */
        transform: scale(1.05); /* 轻微缩放效果 */
        z-index: 100; /* 确保放大后的图片显示在其他内容之上 */
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
      }
      
      /* 图片下方的提示文字 */
      .image-caption {
        text-align: center;
        color: #666;
        font-size: 12px;
        margin-top: 5px;
        cursor: zoom-in;
      }
    </style>
    </head>`);
    
    // 添加图片处理和下载按钮的脚本
    const htmlWithScripts = htmlWithStyles.replace('</body>', `
    <script>
      // 为所有图片添加"点我放大查看"的文字提示
      document.addEventListener('DOMContentLoaded', function() {
        // 处理所有图片
        const allImages = document.querySelectorAll('img');
        allImages.forEach(img => {
          // 为每个图片创建一个包装容器
          const imageWrapper = document.createElement('div');
          imageWrapper.style.position = 'relative';
          imageWrapper.style.marginBottom = '20px';
          
          // 创建说明文字
          const caption = document.createElement('div');
          caption.className = 'image-caption';
          caption.textContent = '点我放大查看';
          
          // 将原始图片替换为带有说明的包装
          img.parentNode.insertBefore(imageWrapper, img);
          imageWrapper.appendChild(img);
          imageWrapper.appendChild(caption);
        });
      });
    </script>
    
    <div style="position: fixed; bottom: 20px; right: 20px; z-index: 1000;">
      <a href="/download?path=${encodeURIComponent(filename)}" class="btn btn-primary" style="background-color: #4CAF50; color: white; padding: 10px 15px; text-decoration: none; border-radius: 4px; font-weight: bold; display: inline-flex; align-items: center; box-shadow: 0 2px 5px rgba(0,0,0,0.2);">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-download" viewBox="0 0 16 16" style="margin-right: 8px;">
          <path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5z"/>
          <path d="M7.646 11.854a.5.5 0 0 0 .708 0l3-3a.5.5 0 0 0-.708-.708L8.5 10.293V1.5a.5.5 0 0 0-1 0v8.793L5.354 8.146a.5.5 0 1 0-.708.708l3 3z"/>
        </svg>
        下载文档
      </a>
    </div>
    </body>`);
    
    // 发送修改后的HTML
    res.send(htmlWithScripts);
    console.log('成功发送文档视图，包含下载按钮');
  } catch (error) {
    console.error('查看文档时出错:', error);
    res.status(500).send('服务器处理文档时出错: ' + error.message);
  }
});

// 获取文档中的所有图片
app.get('/api/document/images', (req, res) => {
    try {
        const { filePath } = req.query;
        
        if (!filePath) {
            return res.status(400).json({
                success: false,
                message: '缺少文件路径参数'
            });
        }
        
        console.log('请求图片，原始路径:', filePath);
        
        // 尝试多种可能的文件路径组合
        const possiblePaths = [
            // 首先尝试/tmp目录
            path.join('/tmp', filePath),
            path.join('/tmp', 'temp', filePath),
            path.join('/tmp', 'temp', path.basename(filePath)),
            path.join('/tmp', 'uploads', filePath),
            path.join('/tmp', 'uploads', path.basename(filePath)),
            path.join('/tmp', 'downloads', filePath),
            path.join('/tmp', 'downloads', path.basename(filePath)),
            // 然后尝试原始路径（向后兼容）
            filePath,
            path.join(__dirname, filePath),
            path.join(__dirname, 'temp', filePath),
            path.join(__dirname, 'temp', path.basename(filePath)),
            path.join(__dirname, 'uploads', filePath),
            path.join(__dirname, 'uploads', path.basename(filePath)),
            path.join(__dirname, 'downloads', filePath),
            path.join(__dirname, 'downloads', path.basename(filePath))
        ];
        
        console.log('尝试以下路径:', possiblePaths);
        
        // 找到第一个存在的文件
        let foundPath = null;
        for (const p of possiblePaths) {
            if (fs.existsSync(p)) {
                foundPath = p;
                console.log('找到匹配文件:', p);
                break;
            }
        }
        
        if (!foundPath) {
            console.log('未找到匹配的文件路径');
            return res.status(404).json({
                success: false,
                message: '文件不存在: 已尝试以下路径: ' + possiblePaths.join(', ')
            });
        }
        
        // 检查是否为HTML文件
        const fileExt = path.extname(foundPath).toLowerCase();
        if (fileExt !== '.html') {
            console.log('非HTML文件:', foundPath);
            return res.status(400).json({
                success: false,
                message: '仅支持HTML文档，当前文件类型: ' + fileExt
            });
        }
        
        // 读取HTML文件
        const htmlContent = fs.readFileSync(foundPath, 'utf8');
        console.log('读取HTML成功，内容长度:', htmlContent.length);
        
        // 匹配文档中的图片
        console.log(`分析文档中的图片: ${foundPath}`);
        const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
        const images = [];
        let match;
        
        let matchCount = 0;
        console.log('开始解析图片标签...');
        
        // 先收集所有图片标签和源属性
        const imgTags = [];
        while ((match = imgRegex.exec(htmlContent)) !== null) {
            matchCount++;
            const src = match[1];
            console.log(`找到第 ${matchCount} 个图片标签，src=${src}`);
            
            // 跳过数据URL
            if (src.startsWith('data:')) {
                console.log('跳过数据URL图片');
                continue;
            }
            
            // 跳过外部链接
            if (src.startsWith('http://') || src.startsWith('https://')) {
                console.log('跳过外部链接图片');
                continue;
            }
            
            imgTags.push(src);
        }
        
        console.log(`共找到 ${matchCount} 个图片标签，有效的本地图片源 ${imgTags.length} 个`);
        
        // 对每个图片标签尝试解析路径
        for (const src of imgTags) {
            // 尝试多种可能的图片路径
            const imgPossiblePaths = [
                // 相对于HTML文件的路径
                path.join(path.dirname(foundPath), src),
                // 相对于服务器根目录的路径
                path.join(__dirname, src.replace(/^\//, '')),
                // 相对于uploads目录的路径
                path.join(__dirname, 'uploads', src),
                // 相对于public目录的路径 
                path.join(__dirname, 'public', src.replace(/^\//, '')),
                // 路径本身（如果是绝对路径）
                src
            ];
            
            console.log(`尝试解析图片 ${src} 的路径:`, imgPossiblePaths.map(p => path.basename(p)));
            
            // 查找第一个存在的图片文件
            let imgPath = null;
            for (const p of imgPossiblePaths) {
                if (fs.existsSync(p)) {
                    imgPath = p;
                    console.log('找到图片文件:', p);
                    break;
                }
            }
            
            // 如果找到图片文件，添加到结果中
            if (imgPath) {
                const stats = fs.statSync(imgPath);
                const imgExt = path.extname(imgPath).toLowerCase();
                
                // 检查是否为支持的图片格式
                if (['.jpg', '.jpeg', '.png', '.gif', '.bmp'].includes(imgExt)) {
                    images.push({
                        src,
                        path: imgPath,
                        name: path.basename(imgPath),
                        type: imgExt.replace('.', ''),
                        size: stats.size,
                        isBlackAndWhite: true // 默认假设所有图片都是黑白的
                    });
                    console.log('添加图片到结果列表:', path.basename(imgPath));
                } else {
                    console.log('不支持的图片格式:', imgExt);
                }
            } else {
                console.log('未找到图片文件:', src);
            }
        }
        
        console.log(`分析完成，共有 ${images.length} 张有效图片`);
        
        // 返回结果
        res.json({
            success: true,
            images,
            message: images.length > 0 ? `找到 ${images.length} 张图片` : '文档中没有找到可上色的图片',
            stats: {
                totalImgTags: matchCount,
                validSources: imgTags.length,
                foundImages: images.length
            }
        });
        
    } catch (error) {
        console.error('获取文档图片错误:', error);
        res.status(500).json({ 
            success: false, 
            message: '获取图片失败: ' + error.message,
            stack: error.stack
        });
    }
});

// 上色指定的图片
app.post('/api/image/colorize', async (req, res) => {
    const { imagePaths } = req.body;
    
    if (!imagePaths || !Array.isArray(imagePaths) || imagePaths.length === 0) {
        return res.status(400).json({ 
            success: false, 
            message: '缺少有效的图片路径，请确保选择了至少一张图片' 
        });
    }
    
    if (imagePaths.length > 20) {
        return res.status(400).json({ 
            success: false, 
            message: '一次最多处理20张图片，请减少选择的图片数量' 
        });
    }
    
    logger.info(`收到上色请求，共 ${imagePaths.length} 张图片`);
    
    // 检查图片是否存在
    const nonExistentImages = imagePaths.filter(imgPath => !fs.existsSync(imgPath));
    if (nonExistentImages.length > 0) {
        return res.status(400).json({
            success: false,
            message: `有 ${nonExistentImages.length} 张图片不存在`,
            nonExistentImages
        });
    }
    
    try {
        // 处理图片上色
        logger.info('开始批量图片上色处理...');
        const colorizeResult = await imageColorizer.colorizeImages(imagePaths);
        
        logger.info(`图片上色处理完成: ${colorizeResult.successCount} 成功, ${colorizeResult.failCount} 失败`);
        
        if (colorizeResult.success) {
            res.json({ 
                success: true, 
                message: colorizeResult.message,
                results: colorizeResult.results
            });
        } else {
            res.status(500).json({
                success: false,
                message: colorizeResult.message,
                results: colorizeResult.results
            });
        }
    } catch (error) {
        logger.error('图片上色处理异常:', error);
        res.status(500).json({ 
            success: false, 
            message: '图片上色过程出错: ' + error.message 
        });
    }
});

// 重新上色指定的图片
app.post('/api/image/recolorize', async (req, res) => {
    const { imagePath, originalPath } = req.body;
    
    if (!imagePath) {
        return res.status(400).json({ 
            success: false, 
            message: '缺少有效的图片路径' 
        });
    }
    
    logger.info(`收到重新上色请求: ${imagePath}`);
    
    // 检查图片是否存在
    if (!fs.existsSync(imagePath)) {
        return res.status(400).json({
            success: false,
            message: `图片文件不存在: ${imagePath}`
        });
    }
    
    try {
        // 处理图片重新上色
        logger.info('开始图片重新上色处理...');
        
        // 生成新的路径，添加时间戳避免覆盖原文件
        const timestamp = Date.now();
        const extname = path.extname(imagePath);
        const basename = path.basename(imagePath, extname);
        let newPath = '';
        
        // 如果是已经上色过的图片，使用原始路径生成新文件名
        if (originalPath && fs.existsSync(originalPath)) {
            // 使用原始图片再次上色
            const result = await imageColorizer.processImage(originalPath, true, timestamp);
            
            if (result.success) {
                res.json({ 
                    success: true, 
                    message: '重新上色成功',
                    result: result
                });
            } else {
                res.status(500).json({
                    success: false,
                    message: '重新上色失败: ' + result.error,
                    result: result
                });
            }
        } else {
            // 找不到原始图片，尝试从当前上色图片路径推断原始图片路径
            let inferredOriginalPath = '';
            if (imagePath.includes('_colorized')) {
                inferredOriginalPath = imagePath.replace('_colorized', '');
                if (fs.existsSync(inferredOriginalPath)) {
                    logger.info(`找到推断的原始图片: ${inferredOriginalPath}`);
                    
                    const result = await imageColorizer.processImage(inferredOriginalPath, true, timestamp);
                    
                    if (result.success) {
                        res.json({ 
                            success: true, 
                            message: '根据推断原图重新上色成功',
                            result: result
                        });
                    } else {
                        res.status(500).json({
                            success: false,
                            message: '重新上色失败: ' + result.error,
                            result: result
                        });
                    }
                } else {
                    res.status(400).json({
                        success: false,
                        message: '无法找到原始图片，重新上色失败'
                    });
                }
            } else {
                // 如果不是上色过的图片格式，直接尝试上色
                const result = await imageColorizer.processImage(imagePath, true, timestamp);
                
                if (result.success) {
                    res.json({ 
                        success: true, 
                        message: '直接上色成功',
                        result: result
                    });
                } else {
                    res.status(500).json({
                        success: false,
                        message: '上色失败: ' + result.error,
                        result: result
                    });
                }
            }
        }
    } catch (error) {
        logger.error('图片重新上色处理异常:', error);
        res.status(500).json({ 
            success: false, 
            message: '图片重新上色过程出错: ' + error.message 
        });
    }
});

// 将上色后的图片应用到文档
app.post('/api/document/apply-colorized-images', (req, res) => {
    try {
        const { filePath, imageResults } = req.body;
        
        if (!filePath) {
            return res.status(400).json({ success: false, message: '缺少文件路径参数' });
        }
        
        if (!imageResults || !Array.isArray(imageResults)) {
            return res.status(400).json({ success: false, message: '缺少有效的图片结果数据' });
        }
        
        // 修改路径处理方式，正确处理绝对路径和相对路径
        let fullPath = filePath;
        
        // 检查是否为绝对路径
        if (!path.isAbsolute(filePath)) {
            // 如果是相对路径，转换为绝对路径
            fullPath = path.join(__dirname, filePath.replace(/^\//, ''));
        }
        
        console.log('处理文件路径:', fullPath);
        
        if (!fs.existsSync(fullPath)) {
            return res.status(404).json({ success: false, message: '文件不存在: ' + fullPath });
        }
        
        logger.info(`准备将上色图片应用到文档: ${path.basename(fullPath)}`);
        
        // 只处理成功的结果
        const successfulResults = imageResults.filter(result => result.success);
        logger.info(`共有 ${successfulResults.length} 张图片上色成功，将应用到文档`);
        
        if (successfulResults.length === 0) {
            return res.json({ 
                success: true, 
                message: '没有成功上色的图片可应用',
                replacedCount: 0
            });
        }
        
        // 读取HTML文件内容
        const htmlContent = fs.readFileSync(fullPath, 'utf8');
        
        // 替换HTML中的图片路径
        const { content, replacedCount } = imageColorizer.replaceImagesInHtml(htmlContent, successfulResults);
        
        // 保存更新后的HTML
        fs.writeFileSync(fullPath, content, 'utf8');
        
        logger.info(`成功替换了 ${replacedCount} 张图片`);
        
        res.json({ 
            success: true, 
            message: `已成功应用 ${replacedCount} 张上色后的图片到文档`,
            replacedCount
        });
    } catch (error) {
        logger.error('应用上色图片错误:', error);
        res.status(500).json({ success: false, message: '应用上色图片失败: ' + error.message });
    }
});

// 图片代理API路由 - 用于绕过CORS限制
app.get('/api/proxy-image', async (req, res) => {
  try {
    const imageUrl = req.query.url;
    
    if (!imageUrl) {
      return res.status(400).send('缺少图片URL参数');
    }
    
    console.log(`代理图片请求: ${imageUrl}`);
    
    // 判断是否为Supabase URL
    if (imageUrl.includes('supabase.co/storage')) {
      // 提取存储路径和文件名
      const pathMatch = imageUrl.match(/\/public\/([^?]+)/);
      
      if (pathMatch && pathMatch[1]) {
        const storagePath = pathMatch[1];
        console.log(`从Supabase下载图片: ${storagePath}`);
        
        // 从存储中获取图片
        const { data, error } = await supabaseClient.supabase.storage
          .from('uploads')
          .download(storagePath);
          
        if (error) {
          console.error('从Supabase获取图片失败:', error);
          return res.status(404).send('图片不存在或无法访问');
        }
        
        // 获取Content-Type
        const contentType = data.type || 'image/png';
        
        // 返回图片数据
        res.setHeader('Content-Type', contentType);
        res.setHeader('Cache-Control', 'public, max-age=86400'); // 24小时缓存
        res.setHeader('Access-Control-Allow-Origin', '*');
        
        const buffer = Buffer.from(await data.arrayBuffer());
        return res.send(buffer);
      }
    }
    
    // 如果不是Supabase URL，使用axios代理请求
    const axios = require('axios');
    const response = await axios.get(imageUrl, {
      responseType: 'arraybuffer',
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    
    // 设置响应头
    res.setHeader('Content-Type', response.headers['content-type'] || 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=86400'); // 24小时缓存
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    return res.send(Buffer.from(response.data));
    
  } catch (error) {
    console.error('代理图片请求失败:', error);
    return res.status(500).send('代理图片请求失败');
  }
});

/**
 * 确保必要的目录存在
 */
function ensureDirectories() {
    // 使用os.tmpdir()获取系统临时目录
    const tmpDir = os.tmpdir();
    console.log(`系统临时目录: ${tmpDir}`);
    
    const directories = [
        path.join(tmpDir, 'public', 'images', 'temp'),
        path.join(tmpDir, 'temp'),
        path.join(tmpDir, 'temp', 'images'),
        path.join(tmpDir, 'uploads'),
        path.join(tmpDir, 'downloads'),
        path.join(__dirname, 'data'),  // 保留在项目目录中
        path.join(__dirname, 'public', 'images', 'templates')  // 保留在项目目录中
    ];

    directories.forEach(dir => {
        try {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
                console.log(`创建目录: ${dir}`);
            } else {
                console.log(`目录已存在: ${dir}`);
            }
        } catch (error) {
            console.error(`创建目录失败: ${dir}`, error);
            // 对于临时目录创建失败，不要中断程序，只记录错误
        }
    });
}

// 应用启动时初始化任务处理器
function initializeTaskProcessor() {
    taskProcessor.setApiConfig(globalApiConfig);
    // 启动任务处理器
    taskProcessor.startTaskProcessor();
    console.log('任务处理器已初始化');
}

// 服务器启动后调用初始化
app.listen(port, () => {
    console.log(`服务器已启动，端口: ${port}`);
    console.log(`环境: ${process.env.NODE_ENV}`);
    
    // 验证API密钥
    validateApiKey();
    
    // 确保目录存在
    ensureDirectories();
    
    // 初始化任务处理器
    initializeTaskProcessor();
});

/**
 * 验证API密钥是否有效
 * @returns {Promise<void>}
 */
async function validateApiKey() {
  try {
    console.log('开始验证API配置...');
    console.log(`当前API类型: ${globalApiConfig.apiType}`);
    
    // 检查API密钥是否为默认值或明显无效值
    if (globalApiConfig.apiKey === 'sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx' || 
        globalApiConfig.apiKey.length < 20) {
      console.warn('警告: API密钥未设置或使用了默认值。美化功能将使用本地备用模式。');
      console.warn('请在app.js文件中更新globalApiConfig.apiKey为有效的API密钥。');
      return;
    }
    
    console.log(`API密钥长度: ${globalApiConfig.apiKey.length}`);
    console.log(`API密钥前5位和后5位: ${globalApiConfig.apiKey.substring(0, 5)}...${globalApiConfig.apiKey.substring(globalApiConfig.apiKey.length-5)}`);
    
    // 根据API类型进行验证
    if (globalApiConfig.apiType === 'deepseek') {
      console.log('正在验证DeepSeek API密钥...');
      try {
        const axios = require('axios');
        console.log('发送DeepSeek API测试请求...');
        
        // 构建简单的测试请求
        const testRequestBody = {
          model: 'deepseek-chat',
          messages: [
            { role: 'system', content: 'You are a helpful assistant.' },
            { role: 'user', content: 'Hello, please respond with just the word "Verified" to validate API connection.' }
          ],
          temperature: 0.1,
          max_tokens: 10
        };
        
        console.log('测试请求体:', JSON.stringify(testRequestBody));
        
        // 设置请求选项
        const requestOptions = {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${globalApiConfig.apiKey}`
          },
          timeout: 10000 // 10秒超时
        };
        
        console.log('请求选项:', JSON.stringify({
          url: 'https://api.deepseek.com/v1/chat/completions',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer sk-*****'
          },
          timeout: 10000
        }));
        
        const response = await axios.post(
          'https://api.deepseek.com/v1/chat/completions',
          testRequestBody,
          requestOptions
        );
        
        console.log('DeepSeek API测试响应状态码:', response.status);
        
        if (response.data && response.data.choices && response.data.choices[0]) {
          console.log('DeepSeek API测试响应内容:', JSON.stringify(response.data));
          console.log('DeepSeek API密钥验证成功');
          return true;
        } else {
          console.warn('DeepSeek API返回了意外的响应格式:', JSON.stringify(response.data));
          return false;
        }
      } catch (err) {
        console.warn('DeepSeek API密钥验证失败:', err.message);
        
        if (err.response) {
          console.error('DeepSeek API错误响应:', JSON.stringify({
            status: err.response.status,
            statusText: err.response.statusText,
            data: err.response.data
          }));
          
          if (err.response.status === 401) {
            console.error('DeepSeek API密钥无效，请检查apiKey设置');
          } else if (err.response.status === 403) {
            console.error('DeepSeek API密钥没有权限，请检查账户权限');
          } else if (err.response.status === 429) {
            console.error('DeepSeek API请求频率过高，请降低请求频率或升级账户');
          } else {
            console.error(`DeepSeek API服务器错误: ${err.response.status}`);
          }
        } else if (err.request) {
          console.error('DeepSeek API没有响应:', err.message);
        } else {
          console.error('DeepSeek API请求配置错误:', err.message);
        }
        
        return false;
      }
    }
    
    return true;
  } catch (err) {
    console.warn('API密钥验证过程出错:', err.message);
    return false;
  }
}

// 创建美化任务（新版本）
app.post('/beautify-task', async (req, res) => {
    try {
        console.log('收到美化任务请求:', req.body);
        
        // 获取参数
        const { filePath, filename, targetFormat = 'word', apiType = 'deepseek', templateId = '', customRequirements = '' } = req.body;
        
        // 验证文件路径和文件名
        if (!filePath || !filename) {
            return res.status(400).json({
                success: false,
                message: '缺少文件路径或文件名'
            });
        }
        
        console.log('处理文件:', filename, '路径:', filePath);
        
        // 获取文件HTML内容
        let htmlContent = '';
        
        // 尝试从多个可能的位置加载原始HTML文件
        const possiblePaths = [
            filePath, // 原始路径
            path.join('/tmp', 'temp', path.basename(filePath)), // 在temp目录中查找文件名
            path.join('/tmp', 'uploads', path.basename(filePath)), // 在uploads目录中查找文件名
            // 向后兼容旧路径
            path.join(__dirname, 'temp', path.basename(filePath)),
            path.join(__dirname, 'uploads', path.basename(filePath))
        ];
        
        let foundHtmlPath = '';
        for (const p of possiblePaths) {
            if (fs.existsSync(p)) {
                console.log('找到文件:', p);
                try {
                    htmlContent = fs.readFileSync(p, 'utf8');
                    foundHtmlPath = p;
                    break;
                } catch (err) {
                    console.error('读取文件失败:', p, err);
                }
            }
        }
        
        // 如果没有找到HTML内容但文件确实存在 - 可能是二进制文件，需要转换
        if (!htmlContent && foundHtmlPath) {
            console.log('找到文件但无法直接读取为HTML，尝试转换:', foundHtmlPath);
            
            // 根据扩展名转换
            const ext = path.extname(foundHtmlPath).toLowerCase();
            if (ext === '.docx' || ext === '.doc') {
                try {
                    const conversionResult = await docxConverter.convertDocxToHtml(foundHtmlPath);
                    if (conversionResult.success) {
                        htmlContent = conversionResult.html;
                        console.log('成功将Word文档转换为HTML');
                    } else {
                        throw new Error('Word转HTML失败: ' + conversionResult.error);
                    }
                } catch (err) {
                    console.error('转换Word文档失败:', err);
                    return res.status(500).json({
                        success: false,
                        message: '转换Word文档失败: ' + err.message
                    });
                }
            } else if (ext === '.pdf') {
                try {
                    const conversionResult = await pdfConverter.convertPdfToHtml(foundHtmlPath);
                    if (conversionResult.success) {
                        htmlContent = conversionResult.html;
                        console.log('成功将PDF转换为HTML');
                    } else {
                        throw new Error('PDF转HTML失败: ' + conversionResult.error);
                    }
                } catch (err) {
                    console.error('转换PDF文档失败:', err);
                    return res.status(500).json({
                        success: false,
                        message: '转换PDF文档失败: ' + err.message
                    });
                }
            } else {
                return res.status(400).json({
                    success: false,
                    message: '不支持的文件类型: ' + ext
                });
            }
        }
        
        // 如果仍然没有HTML内容
        if (!htmlContent) {
            console.error('无法获取HTML内容');
            return res.status(404).json({
                success: false,
                message: '无法获取文件内容，文件可能不存在或格式不支持'
            });
        }
        
        // 获取API密钥 - 根据选择的API类型
        const configData = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        const apiKey = configData.apiKeys[apiType] || '';
        
        // 获取模板信息
        let templateRequirements = '';
        if (templateId) {
            try {
                const templatesData = JSON.parse(fs.readFileSync(templatesPath, 'utf8'));
                if (templatesData.templates[templateId]) {
                    templateRequirements = templatesData.templates[templateId].requirements || '';
                }
            } catch (err) {
                console.error('读取模板信息失败:', err);
            }
        }
        
        // 合并模板要求和自定义要求
        let finalRequirements = '';
        if (templateRequirements && customRequirements) {
            finalRequirements = templateRequirements + '\n\n' + customRequirements;
        } else {
            finalRequirements = templateRequirements || customRequirements;
        }
        
        // 准备任务数据
        const taskData = {
            filename: filename,
            filePath: filePath,
            htmlContent: htmlContent,
            targetFormat: targetFormat,
            apiType: apiType,
            apiKey: apiKey,
            customRequirements: finalRequirements,
            taskType: 'beautify',
            createdAt: new Date().toISOString()
        };
        
        // 创建任务
        const taskResult = await supabaseClient.createTask(taskData);
        
        if (!taskResult.success) {
            throw new Error(`创建任务失败: ${taskResult.error}`);
        }
        
        // 返回任务ID
        res.json({
            success: true,
            taskId: taskResult.taskId,
            status: 'pending',
            message: '美化任务已提交，请稍后检查结果'
        });
        
    } catch (error) {
        console.error('创建美化任务出错:', error);
        res.status(500).json({ 
            success: false,
            error: error.message 
        });
    }
});

// 添加兼容的/beautify路由
app.post('/beautify', async (req, res) => {
  console.log('收到旧版本/beautify请求，转发到/beautify-task:', req.body);
  
  try {
    const { filePath, template, targetFormat, customRequirements, htmlContent, filename } = req.body;
    
    // 检查必要参数 - 允许使用filePath或htmlContent
    if (!filePath && !htmlContent) {
      return res.status(400).json({ 
        success: false, 
        message: '缺少文件路径或HTML内容参数' 
      });
    }
    
    // 从文件路径中提取文件名或使用提供的文件名
    const finalFilename = filename || (filePath ? path.basename(filePath) : 'document-' + Date.now() + '.html');
    
    // 如果提供了HTML内容但没有文件路径，创建临时文件
    let finalFilePath = filePath;
    if (htmlContent && !filePath) {
      // 在临时目录中创建HTML文件
      const tempDir = path.join('/tmp', 'temp');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      finalFilePath = path.join(tempDir, finalFilename);
      fs.writeFileSync(finalFilePath, htmlContent, 'utf8');
      console.log(`已将HTML内容保存到临时文件: ${finalFilePath}`);
    }
    
    // 转发请求到beautify-task处理程序
    req.body = {
      filePath: finalFilePath,
      filename: finalFilename,
      templateId: template || '',
      targetFormat: targetFormat || 'auto',
      customRequirements: customRequirements || '',
      apiType: 'deepseek'
    };
    
    // 内部调用beautify-task的处理逻辑
    const taskResult = await supabaseClient.createTask({
      filename: finalFilename,
      filePath: finalFilePath,
      htmlContent: htmlContent, // 添加HTML内容
      targetFormat: targetFormat || 'auto',
      customRequirements: customRequirements || '',
      templateId: template || '',
      apiType: 'deepseek',
      taskType: 'beautify',
      createdAt: new Date().toISOString()
    });
    
    if (!taskResult.success) {
      console.error('创建任务失败:', taskResult.error);
      return res.status(500).json({ 
        success: false, 
        message: '创建任务失败' + (taskResult.error ? ': ' + taskResult.error : '')
      });
    }
    
    // 启动任务处理器进行后台处理
    taskProcessor.processBeautifyTask(taskResult.taskId);
    
    // 返回任务ID供前端查询状态
    return res.json({
      success: true,
      taskId: taskResult.taskId,
      status: 'pending',
      message: '美化任务已提交，请稍后检查结果'
    });
    
  } catch (error) {
    console.error('处理美化请求出错:', error);
    return res.status(500).json({
      success: false,
      message: '处理请求出错: ' + error.message
    });
  }
});

// 测试DeepSeek API路由
app.get('/test-deepseek', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'test-deepseek.html'));
});

// DeepSeek API测试接口
app.post('/api/test-deepseek', async (req, res) => {
  const prompt = req.body.prompt || "请将以下文字转换为HTML格式：这是一个测试段落，请美化它。";
  
  console.log("[DeepSeek API测试] 接收到测试请求:", { prompt });
  
  try {
    const startTime = Date.now();
    
    // 获取API配置
    const apiType = config.apiConfig.type || 'deepseek';
    const apiKey = process.env[`${apiType.toUpperCase()}_API_KEY`] || config.apiKeys[apiType];
    const apiModel = config.apiConfig.model || 'deepseek-chat';
    
    console.log(`[DeepSeek API测试] 使用API类型: ${apiType}, 模型: ${apiModel}`);
    console.log(`[DeepSeek API测试] API密钥长度: ${apiKey ? apiKey.length : 0}, 前5位: ${apiKey ? apiKey.substring(0, 5) : 'N/A'}`);
    
    // 准备请求参数
    const apiUrl = 'https://api.deepseek.com/v1/chat/completions';
    const temperature = config.parameters.deepseek.temperature || 0.7;
    const maxTokens = config.parameters.deepseek.max_tokens || 4000;
    
    // 设置请求头
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    };
    
    // 设置请求体
    const requestBody = {
      model: apiModel,
      messages: [
        { role: "system", content: "你是一个专业的网页开发和设计助手，擅长将文本转换为美观的HTML。" },
        { role: "user", content: prompt }
      ],
      temperature: temperature,
      max_tokens: maxTokens
    };
    
    console.log(`[DeepSeek API测试] 发送请求到: ${apiUrl}`);
    
    // 发送请求
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(requestBody),
      timeout: 30000
    });
    
    const responseTime = Date.now() - startTime;
    
    // 解析响应
    const responseData = await response.json();
    
    console.log(`[DeepSeek API测试] 响应状态码: ${response.status}, 耗时: ${responseTime}ms`);
    
    if (!response.ok) {
      throw new Error(`API返回错误: ${response.status} - ${responseData.error?.message || JSON.stringify(responseData)}`);
    }
    
    // 提取AI的回复内容
    const aiReply = responseData.choices && responseData.choices[0] && responseData.choices[0].message
      ? responseData.choices[0].message.content
      : '无法获取AI回复';
    
    // 返回测试结果，包含用户问题和AI回复
    return res.json({
      success: true,
      status: response.status,
      responseTime: responseTime,
      userQuestion: prompt,
      aiReply: aiReply,
      data: responseData
    });
    
  } catch (error) {
    console.error("[DeepSeek API测试] 错误:", error.message);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});