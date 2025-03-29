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

// 上传文件处理路由
app.post('/upload', upload.single('document'), async (req, res) => {
  try {
    // 检查文件是否存在
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: '未接收到文件'
      });
    }

    // 获取目标格式
    const targetFormat = req.body.targetFormat || 'word';
    
    // 获取上传的文件信息
    const originalname = req.file.originalname;
    const filename = req.file.filename;
    const filepath = req.file.path;
    const mimetype = req.file.mimetype;

    // 处理上传的文件
    let fileType = '';
    let htmlContent = '';
    let htmlPath = '';

    // 判断文件类型并处理
    if (mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || 
        originalname.endsWith('.docx')) {
      // 处理DOCX文件
      fileType = 'docx';
      const result = await docxConverter.convertDocxToHtml(filepath);
      htmlContent = result.html;
      htmlPath = result.htmlPath;
    } else if (mimetype === 'application/pdf' || originalname.endsWith('.pdf')) {
      // 处理PDF文件
      fileType = 'pdf';
      const result = await pdfConverter.convertPdfToHtml(filepath);
      htmlContent = result.html;
      htmlPath = result.htmlPath;
    } else {
      // 不支持的文件类型
      return res.status(400).json({
        success: false,
        message: '不支持的文件类型，请上传DOCX或PDF文件'
      });
    }

    // 返回成功响应
    return res.json({
      success: true,
      uploadedFile: {
        originalname,
        filename,
        path: htmlPath,
        type: fileType,
        html: htmlContent,
        targetFormat // 在响应中包含目标格式
      }
    });
  } catch (error) {
    console.error('文件上传处理错误:', error);
    return res.status(500).json({
      success: false,
      message: '服务器处理文件时出错: ' + error.message
    });
  }
});

// 美化文档处理路由
app.post('/beautify', async (req, res) => {
  try {
    const { filename, targetFormat = 'word', htmlContent } = req.body;

    let processedContent;

    // 如果直接提供了HTML内容，则使用它
    if (htmlContent) {
      console.log('使用提供的HTML内容进行美化');
      try {
        // 处理API密钥，确保格式正确
        let apiKey = req.body.apiKey;
        if (apiKey && !apiKey.startsWith('sk-')) {
          apiKey = `sk-${apiKey}`;
        }
        
        // 检查API密钥是否有效
        if (!apiKey || apiKey.length < 15) {
          console.log('未提供有效的API密钥，使用默认处理');
          apiKey = null;
        } else {
          console.log(`使用API密钥: ${apiKey.substring(0, 5)}...${apiKey.substring(apiKey.length-5)}`);
        }
        
        // 传递目标格式给AI优化器
        processedContent = await aiProcessor.processAndSaveHtml(
          htmlContent, 
          'downloads',
          apiKey,
          targetFormat
        );
      } catch (aiError) {
        console.error('AI处理HTML内容错误:', aiError);
        return res.status(500).json({
          success: false,
          message: 'AI处理HTML内容时出错: ' + aiError.message
        });
      }
    } else {
      // 传统方式：通过文件名查找HTML文件
      // 检查文件名是否存在
      if (!filename) {
        return res.status(400).json({
          success: false, 
          message: '缺少文件名参数'
        });
      }

      // 尝试处理不同格式的文件
      let htmlFilePath;
      
      // 先检查是否为HTML文件
      if (filename.endsWith('.html')) {
        htmlFilePath = path.join(__dirname, 'temp', filename);
      } 
      // 检查是否为DOCX或PDF文件，并尝试查找对应的HTML文件
      else if (filename.endsWith('.docx') || filename.endsWith('.pdf')) {
        // 移除扩展名并尝试查找可能的HTML文件
        const filenameWithoutExt = filename.substring(0, filename.lastIndexOf('.'));
        const possibleHtmlFiles = [
          path.join(__dirname, 'temp', filenameWithoutExt + '.html'),
          path.join(__dirname, 'temp', filename + '.html'),
          path.join(__dirname, 'temp', filename)
        ];
        
        // 尝试找到存在的HTML文件
        for (const file of possibleHtmlFiles) {
          if (fs.existsSync(file)) {
            htmlFilePath = file;
            break;
          }
        }
        
        // 如果未找到HTML文件，检查temp目录下的所有文件，查找类似名称的文件
        if (!htmlFilePath) {
          try {
            const tempFiles = fs.readdirSync(path.join(__dirname, 'temp'));
            const similarFile = tempFiles.find(file => 
              file.includes(filenameWithoutExt) || filenameWithoutExt.includes(file.replace('.html', ''))
            );
            
            if (similarFile) {
              htmlFilePath = path.join(__dirname, 'temp', similarFile);
            }
          } catch (readError) {
            console.error('读取temp目录失败:', readError);
          }
        }
      } else {
        // 尝试直接使用提供的文件名
        htmlFilePath = path.join(__dirname, 'temp', filename);
      }

      // 检查文件是否存在
      if (!htmlFilePath || !fs.existsSync(htmlFilePath)) {
        return res.status(404).json({
          success: false,
          message: '找不到指定的文件'
        });
      }

      // 读取HTML内容
      const htmlContent = fs.readFileSync(htmlFilePath, 'utf8');

      // 使用AI优化器处理内容
      try {
        // 处理API密钥，确保格式正确
        let apiKey = req.body.apiKey;
        if (apiKey && !apiKey.startsWith('sk-')) {
          apiKey = `sk-${apiKey}`;
        }
        
        // 检查API密钥是否有效
        if (!apiKey || apiKey.length < 15) {
          console.log('未提供有效的API密钥，使用默认处理');
          apiKey = null;
        } else {
          console.log(`使用API密钥: ${apiKey.substring(0, 5)}...${apiKey.substring(apiKey.length-5)}`);
        }
        
        // 传递目标格式给AI优化器
        processedContent = await aiProcessor.processAndSaveHtml(
          htmlContent, 
          'downloads',
          apiKey,
          targetFormat
        );
      } catch (aiError) {
        console.error('AI处理错误:', aiError);
        return res.status(500).json({
          success: false,
          message: 'AI处理时出错: ' + aiError.message
        });
      }
    }

    // 保存处理后的内容
    const timestamp = Date.now();
    const processedFilename = `processed-${timestamp}.html`;
    const processedFilePath = path.join(__dirname, 'downloads', processedFilename);

    fs.writeFileSync(processedFilePath, processedContent.html);

    // 返回成功响应
    return res.json({
      success: true,
      processedFile: {
        originalFilename: filename,
        path: processedFilePath,
        html: processedContent.html,
        targetFormat // 在响应中包含目标格式
      }
    });
  } catch (error) {
    console.error('文档美化处理错误:', error);
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

    // 检查参数是否存在
    if (!htmlFile || !format) {
      return res.status(400).json({
        success: false,
        message: '缺少必要的参数'
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
    outputFilename = `${outputFilename}-${Date.now()}.${format}`;

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
    if (format === 'docx') {
      exportResult = await exportUtils.exportToDocx(htmlContent, outputPath);
    } else if (format === 'pdf') {
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