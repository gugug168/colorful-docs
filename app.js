const express = require('express');
const path = require('path');
const multer = require('multer');
const fs = require('fs');

// 导入自定义工具
const docxConverter = require('./utils/docxConverter');
const pdfConverter = require('./utils/pdfConverter');
const aiProcessor = require('./utils/aiProcessor');
const exportUtils = require('./utils/exportUtils');

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
['uploads', 'downloads', 'temp', 'public/images/temp'].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

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
    // 只接受 docx 和 pdf 文件
    if (file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || 
        file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('只支持Word文档(.docx)和PDF文件!'), false);
    }
  }
});

// 主页路由
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'index.html'));
});

// 文件上传处理 - 仅负责上传和转换为HTML
app.post('/upload', upload.single('document'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: '请上传文件'
    });
  }
  
  try {
    const filePath = req.file.path;
    const fileType = path.extname(req.file.originalname).toLowerCase();
    let conversionResult;
    
    // 根据文件类型选择适当的转换器
    if (fileType === '.docx') {
      // 转换Word文档
      conversionResult = await docxConverter.convertDocxToHtml(filePath);
    } else if (fileType === '.pdf') {
      // 转换PDF文档
      conversionResult = await pdfConverter.convertPdfToHtml(filePath);
    } else {
      return res.status(400).json({
        success: false,
        message: '不支持的文件类型'
      });
    }
    
    if (!conversionResult.success) {
      return res.status(500).json({
        success: false,
        message: '文件转换失败: ' + conversionResult.error
      });
    }

    // 打印实际输出路径，用于调试
    console.log('转换后的HTML文件保存在:', conversionResult.outputPath);
    
    // 返回上传和转换结果
    return res.json({
      success: true,
      message: '文件上传成功',
      uploadedFile: {
        path: conversionResult.outputPath,
        type: fileType,
        html: conversionResult.html
      }
    });
    
  } catch (error) {
    console.error('文件上传处理出错:', error);
    return res.status(500).json({
      success: false,
      message: '服务器处理错误: ' + error.message
    });
  }
});

// 文档美化处理
app.post('/beautify', async (req, res) => {
  try {
    const { filename } = req.body;
    
    if (!filename) {
      return res.status(400).json({
        success: false,
        message: '文件名不能为空'
      });
    }
    
    // 检查文件是否存在
    const filePath = path.join(__dirname, 'temp', filename);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: '找不到指定的文件'
      });
    }
    
    // 读取HTML内容
    const htmlContent = fs.readFileSync(filePath, 'utf8');
    
    // 使用AI或规则处理器美化文档
    // 使用DEEPSEEK API进行文档美化
    const deepseekApiKey = 'sk-8540a084e1774f9980019e37a9086781';
    const processResult = await aiProcessor.processAndSaveHtml(
      htmlContent, 
      'downloads',
      deepseekApiKey,
      'deepseek'
    );
    
    if (!processResult.success) {
      return res.status(500).json({
        success: false,
        message: '文档美化失败: ' + processResult.error
      });
    }

    // 打印实际输出路径，用于调试
    console.log('美化后的文件保存在:', processResult.outputPath);
    
    // 返回处理结果
    return res.json({
      success: true,
      message: '文件美化成功',
      processedFile: {
        path: processResult.outputPath,
        html: processResult.html
      }
    });
    
  } catch (error) {
    console.error('文档美化处理出错:', error);
    return res.status(500).json({
      success: false,
      message: '服务器处理错误: ' + error.message
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

// 导出文件
app.get('/export', async (req, res) => {
  const { htmlFile, format } = req.query;
  
  if (!htmlFile || !format) {
    return res.status(400).json({
      success: false,
      message: '缺少必要参数'
    });
  }
  
  // 确保文件名不包含路径分隔符，防止路径遍历
  const sanitizedFilename = path.basename(htmlFile);
  const inputPath = path.join(__dirname, 'downloads', sanitizedFilename);
  
  if (!fs.existsSync(inputPath)) {
    console.error('要导出的文件不存在:', inputPath);
    return res.status(404).json({
      success: false,
      message: '文件不存在或已被删除'
    });
  }
  
  try {
    // 生成输出文件名
    const outputFileName = `${path.basename(sanitizedFilename, '.html')}.${format}`;
    const outputPath = path.join(__dirname, 'downloads', outputFileName);
    
    // 读取HTML内容
    const htmlContent = fs.readFileSync(inputPath, 'utf8');
    
    // 根据格式导出
    let exportResult;
    if (format === 'docx') {
      exportResult = await exportUtils.exportToDocx(htmlContent, outputPath);
    } else if (format === 'pdf') {
      exportResult = await exportUtils.exportToPdf(htmlContent, outputPath);
    } else {
      return res.status(400).json({
        success: false,
        message: '不支持的导出格式'
      });
    }
    
    if (!exportResult.success) {
      return res.status(500).json({
        success: false,
        message: '导出失败: ' + exportResult.error
      });
    }
    
    // 返回下载链接
    return res.json({
      success: true,
      message: '导出成功',
      downloadUrl: `/download/${outputFileName}`
    });
    
  } catch (error) {
    console.error('导出处理出错:', error);
    return res.status(500).json({
      success: false,
      message: '服务器处理错误: ' + error.message
    });
  }
});

// 下载处理后的文件
app.get('/download/:fileName', (req, res) => {
  const fileName = req.params.fileName;
  // 确保文件名不包含路径分隔符，防止路径遍历
  const sanitizedFilename = path.basename(fileName);
  const filePath = path.join(__dirname, 'downloads', sanitizedFilename);
  
  console.log('尝试下载文件:', filePath);
  
  if (!fs.existsSync(filePath)) {
    console.error('下载文件不存在:', filePath);
    return res.status(404).send('文件不存在或已被删除');
  }
  
  // 获取文件扩展名，以设置正确的Content-Type
  const ext = path.extname(filePath).toLowerCase();
  console.log('文件扩展名:', ext);
  
  try {
    // 读取文件内容以验证
    const fileContent = fs.readFileSync(filePath);
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
    res.setHeader('Content-Disposition', `attachment; filename="${sanitizedFilename}"`);
    res.setHeader('Content-Length', fileContent.length);
    
    // 发送文件内容
    res.send(fileContent);
  } catch (err) {
    console.error('读取或发送文件时出错:', err);
    res.status(500).send('下载失败: ' + err.message);
  }
});

// 添加favicon路由
app.get('/favicon.ico', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'images', 'favicon.svg'));
});

// 启动服务器
app.listen(port, () => {
  console.log(`服务器运行在 http://localhost:${port}`);
});