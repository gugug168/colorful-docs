// 主API文件 - 整合多个功能点的API处理
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const crypto = require('crypto');
const os = require('os');
const busboy = require('busboy');

// 导入必要的工具模块
const supabaseClient = require('../utils/supabaseClient');
const taskProcessor = require('../utils/taskProcessor');
const docxConverter = require('../utils/docxConverter');
const pdfConverter = require('../utils/pdfConverter');
const exportUtils = require('../utils/exportUtils');
const logger = require('../utils/logger');

// 计算任务进度
function getTaskProgress(task) {
  switch (task.status) {
    case 'pending': return 0;
    case 'processing':
      const processingStartTime = new Date(task.updated_at).getTime();
      const now = Date.now();
      const elapsed = now - processingStartTime;
      const progress = Math.min(Math.floor((elapsed / 60000) * 100), 95);
      return progress;
    case 'completed': return 100;
    case 'failed': return 0;
    default: return 0;
  }
}

// 生成安全的文件名
function sanitizeFileName(fileName, ts) {
  const timestamp = ts || Date.now();
  const extname = path.extname(fileName) || '.tmp';
  return `doc-${timestamp}-${crypto.createHash('md5').update(fileName).digest('hex').substring(0, 10)}${extname}`;
}

// 处理文件上传
async function handleUpload(req, res) {
  return new Promise((resolve, reject) => {
    try {
      const bb = busboy({ headers: req.headers });
      let fileBuffer = null;
      let mimetype = '';
      let originalFileName = '';
      let encodedFileName = '';
      const fields = {};

      // 处理上传的文件
      bb.on('file', (name, file, info) => {
        console.log(`处理上传的文件: ${info.filename}, mimetype: ${info.mimeType}`);
        const chunks = [];
        mimetype = info.mimeType;
        originalFileName = info.filename;

        file.on('data', (data) => {
          chunks.push(data);
        });

        file.on('end', () => {
          fileBuffer = Buffer.concat(chunks);
          console.log(`文件接收完毕，大小: ${fileBuffer.length} 字节`);
        });
      });

      // 处理上传表单字段
      bb.on('field', (name, val) => {
        console.log(`接收到表单字段: ${name}=${val}`);
        fields[name] = val;
        if (name === 'encodedFileName') {
          encodedFileName = val;
        }
        if (name === 'originalFileName') {
          originalFileName = val;
        }
      });

      // 处理上传完成事件
      bb.on('finish', async () => {
        try {
          // 解码文件名用于显示
          let decodedFileName;
          try {
            if (encodedFileName) {
              decodedFileName = decodeURIComponent(encodedFileName);
            } else if (fields.filename) {
              try {
                decodedFileName = decodeURIComponent(fields.filename);
              } catch (decodeErr) {
                decodedFileName = fields.filename;
              }
            } else {
              decodedFileName = originalFileName;
            }
          } catch (e) {
            console.error('解码文件名失败:', e);
            decodedFileName = originalFileName;
          }

          // 确保所有后续处理使用的是安全编码过的文件名
          const safeFileName = encodedFileName || encodeURIComponent(originalFileName);

          // 检查文件是否存在
          if (!fileBuffer) {
            return reject({
              status: 400,
              message: '未接收到文件'
            });
          }

          console.log('处理上传文件:', decodedFileName, '大小:', fileBuffer.length, '字节');
          console.log('MIME类型:', mimetype);

          // 获取目标格式
          const targetFormat = fields.targetFormat || 'word';
          console.log('目标格式:', targetFormat);

          // 上传到 Supabase Storage
          const timestamp = Date.now();
          const filename = `document-${timestamp}-${safeFileName}`;
          const filePath = `uploads/${filename}`;

          // 上传原始文件到 Supabase
          const uploadResult = await supabaseClient.uploadFile(fileBuffer, filePath);

          if (!uploadResult.success) {
            throw new Error(`上传文件到Supabase失败: ${uploadResult.error}`);
          }

          console.log('文件已上传到Supabase:', uploadResult.url);

          // 生成短文件名
          const shortFilename = sanitizeFileName(safeFileName, timestamp);

          // 保存到本地临时文件用于处理
          const tempDir = path.join(os.tmpdir(), 'uploads');
          console.log(`使用系统临时目录: ${tempDir}`);

          try {
            fs.mkdirSync(tempDir, { recursive: true });
            console.log(`临时目录创建/验证成功: ${tempDir}`);
          } catch (mkdirError) {
            console.error(`创建临时目录失败: ${mkdirError}`);
          }

          // 确保使用可用的目录
          const finalTempDir = fs.existsSync(tempDir) ? tempDir : os.tmpdir();
          const tempFilePath = path.join(finalTempDir, shortFilename);

          try {
            fs.writeFileSync(tempFilePath, fileBuffer);
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
              return reject({
                status: 400,
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
          resolve({
            success: true,
            uploadedFile: {
              originalname: decodedFileName,
              filename,
              path: htmlPath,
              url: htmlPath,
              type: fileType,
              html: htmlContent,
              downloadUrl: htmlPath,
              message: errorMessage ? `警告：${errorMessage}` : undefined
            }
          });
        } catch (error) {
          console.error('处理上传文件时出错:', error);
          reject({
            status: 500,
            message: '处理上传文件时出错: ' + error.message
          });
        }
      });

      // 处理错误
      bb.on('error', (err) => {
        console.error('Busboy错误:', err);
        reject({
          status: 500,
          message: '文件上传错误: ' + err.message
        });
      });

      // 传入请求
      req.pipe(bb);
    } catch (error) {
      console.error('上传处理错误:', error);
      reject({
        status: 500,
        message: '上传处理错误: ' + error.message
      });
    }
  });
}

// 主处理函数
module.exports = async (req, res) => {
  // 获取路由类型和操作类型
  const routeType = req.query.route || '';
  const action = req.query.action || '';
  const taskId = req.query.taskId || '';
  
  console.log(`处理API请求: route=${routeType}, action=${action}, taskId=${taskId}`);
  
  try {
    // 处理上传文件请求
    if (routeType === 'upload') {
      try {
        const result = await handleUpload(req, res);
        return res.json(result);
      } catch (error) {
        return res.status(error.status || 500).json({
          success: false,
          message: error.message
        });
      }
    }
    
    // 处理任务相关API
    if (routeType === 'task') {
      // 检查任务状态
      if (action === 'check' && taskId) {
        const taskResult = await supabaseClient.getTask(taskId);
        
        if (!taskResult.success) {
          return res.status(404).json({ 
            success: false, 
            error: `任务不存在或已过期: ${taskResult.error}` 
          });
        }
        
        const task = taskResult.task;
        
        return res.json({
          success: true,
          taskId: task.id,
          status: task.status,
          result: task.result,
          error: task.error,
          progress: getTaskProgress(task),
          createdAt: task.created_at,
          updatedAt: task.updated_at
        });
      }
      
      // 更新任务
      else if (action === 'update' && taskId) {
        const { status, result, error } = req.body;
        
        if (!status) {
          return res.status(400).json({
            success: false,
            error: '缺少状态参数'
          });
        }
        
        const updateResult = await supabaseClient.updateTask(taskId, {
          status,
          result,
          error
        });
        
        if (!updateResult.success) {
          return res.status(500).json({
            success: false,
            error: updateResult.error
          });
        }
        
        return res.json({
          success: true,
          taskId,
          status
        });
      }
      
      // 处理任务队列
      else if (action === 'process') {
        const tasksResult = await supabaseClient.getPendingTasks();
        
        if (!tasksResult.success) {
          return res.status(500).json({
            success: false,
            error: tasksResult.error
          });
        }
        
        const tasks = tasksResult.tasks;
        
        if (tasks.length === 0) {
          return res.json({
            success: true,
            message: '没有待处理的任务'
          });
        }
        
        const task = tasks[0];
        
        await supabaseClient.updateTask(task.id, {
          status: 'processing',
          updated_at: new Date().toISOString()
        });
        
        if (task.taskType === 'beautify') {
          taskProcessor.processBeautifyTask(task.id);
        }
        
        return res.json({
          success: true,
          message: `正在处理任务 ${task.id}`,
          taskId: task.id,
          taskType: task.taskType
        });
      }
      
      // 创建美化任务
      else if (action === 'beautify') {
        const { filePath, filename, targetFormat = 'word', apiType = 'deepseek', templateId = '', customRequirements = '', htmlContent } = req.body;
        
        if ((!filePath && !htmlContent) || !filename) {
          return res.status(400).json({
            success: false,
            message: '缺少必要参数'
          });
        }
        
        const taskData = {
          filename: filename,
          filePath: filePath,
          htmlContent: htmlContent,
          targetFormat: targetFormat,
          apiType: apiType,
          templateId: templateId,
          customRequirements: customRequirements,
          taskType: 'beautify',
          createdAt: new Date().toISOString()
        };
        
        const taskResult = await supabaseClient.createTask(taskData);
        
        if (!taskResult.success) {
          throw new Error(`创建任务失败: ${taskResult.error}`);
        }
        
        return res.json({
          success: true,
          taskId: taskResult.taskId,
          status: 'pending',
          message: '美化任务已提交，请稍后检查结果'
        });
      }
      
      // 取消任务
      else if (action === 'cancel' && taskId) {
        const cancelResult = await supabaseClient.updateTask(taskId, {
          status: 'cancelled',
          error: '用户取消了任务',
          updated_at: new Date().toISOString()
        });
        
        if (!cancelResult.success) {
          return res.status(500).json({
            success: false,
            error: cancelResult.error
          });
        }
        
        return res.json({
          success: true,
          taskId,
          message: '任务已取消'
        });
      }
    }
    
    // 模板相关API
    else if (routeType === 'templates') {
      // 获取模板列表
      if (action === 'list') {
        try {
          const templatesData = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data', 'templates.json'), 'utf8'));
          
          return res.json({
            success: true,
            templates: templatesData.templates
          });
        } catch (err) {
          console.error('读取模板数据失败:', err);
          return res.status(500).json({
            success: false,
            message: '读取模板数据失败'
          });
        }
      }
    }
    
    // 导出相关API
    else if (routeType === 'export') {
      if (action === 'download') {
        const { htmlFile, format } = req.query;
        
        if (!htmlFile || !format) {
          return res.status(400).json({
            success: false,
            message: '缺少必要的参数'
          });
        }
        
        let normalizedFormat = format.toString().trim().toLowerCase();
        if (normalizedFormat === 'word') {
          normalizedFormat = 'docx';
        }
        
        if (normalizedFormat !== 'docx' && normalizedFormat !== 'pdf') {
          return res.status(400).json({
            success: false,
            message: '不支持的导出格式，请使用docx或pdf'
          });
        }
        
        // 尝试多种可能的路径
        const possiblePaths = [
          path.join('/tmp', 'downloads', htmlFile),
          path.join('/tmp', 'temp', htmlFile),
          path.join(process.cwd(), 'downloads', htmlFile),
          path.join(process.cwd(), 'temp', htmlFile)
        ];
        
        let htmlFilePath = null;
        for (const p of possiblePaths) {
          if (fs.existsSync(p)) {
            htmlFilePath = p;
            break;
          }
        }
        
        if (!htmlFilePath) {
          return res.status(404).json({
            success: false,
            message: '找不到指定的HTML文件'
          });
        }
        
        let outputFilename = htmlFile.replace(/processed-\d+\.html$/, '');
        if (!outputFilename || outputFilename === '') {
          outputFilename = 'document';
        }
        outputFilename = `${outputFilename}-${Date.now()}.${normalizedFormat}`;
        
        const outputDir = path.join('/tmp', 'downloads');
        if (!fs.existsSync(outputDir)) {
          fs.mkdirSync(outputDir, { recursive: true });
        }
        
        const outputPath = path.join(outputDir, outputFilename);
        const htmlContent = fs.readFileSync(htmlFilePath, 'utf8');
        
        let exportResult;
        if (normalizedFormat === 'docx') {
          exportResult = await exportUtils.exportToDocx(htmlContent, outputPath);
        } else if (normalizedFormat === 'pdf') {
          exportResult = await exportUtils.exportToPdf(htmlContent, outputPath);
        }
        
        if (!exportResult.success) {
          return res.status(500).json({
            success: false,
            message: exportResult.message || '导出失败'
          });
        }
        
        const downloadUrl = `/downloads/${outputFilename}`;
        
        return res.json({
          success: true,
          filename: outputFilename,
          downloadUrl: downloadUrl
        });
      }
    }
    
    // 下载文件
    else if (routeType === 'download') {
      if (action === 'file') {
        const filePath = req.query.path;
        
        if (!filePath) {
          return res.status(400).send('缺少文件路径参数');
        }
        
        // 确定文件是否存在，尝试多种可能的路径
        let resolvedPath = '';
        
        if (path.isAbsolute(filePath) && fs.existsSync(filePath)) {
          resolvedPath = filePath;
        } else {
          const possiblePaths = [
            filePath,
            path.join('/tmp', filePath),
            path.join('/tmp', 'downloads', filePath),
            path.join('/tmp', 'temp', filePath),
            path.join('/tmp', 'downloads', path.basename(filePath)),
            path.join('/tmp', 'temp', path.basename(filePath)),
            path.join(process.cwd(), filePath),
            path.join(process.cwd(), 'downloads', filePath),
            path.join(process.cwd(), 'temp', filePath),
            path.join(process.cwd(), 'downloads', path.basename(filePath)),
            path.join(process.cwd(), 'temp', path.basename(filePath))
          ];
          
          for (const p of possiblePaths) {
            if (fs.existsSync(p)) {
              resolvedPath = p;
              break;
            }
          }
        }
        
        if (!resolvedPath || !fs.existsSync(resolvedPath)) {
          return res.status(404).send('文件不存在或已被删除');
        }
        
        const fileName = path.basename(resolvedPath);
        
        res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);
        res.setHeader('Content-Type', 'application/octet-stream');
        
        if (fileName.endsWith('.html')) {
          const baseFileName = fileName.replace('.html', '');
          const wordPath = path.join(path.dirname(resolvedPath), `${baseFileName}.docx`);
          const pdfPath = path.join(path.dirname(resolvedPath), `${baseFileName}.pdf`);
          
          if (fs.existsSync(wordPath)) {
            res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(path.basename(wordPath))}"`);
            return fs.createReadStream(wordPath).pipe(res);
          } else if (fs.existsSync(pdfPath)) {
            res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(path.basename(pdfPath))}"`);
            return fs.createReadStream(pdfPath).pipe(res);
          }
        }
        
        fs.createReadStream(resolvedPath).pipe(res);
      }
    }
    
    // API配置相关
    else if (routeType === 'config') {
      if (action === 'get') {
        try {
          const configPath = path.join(process.cwd(), 'data', 'config.json');
          const configData = JSON.parse(fs.readFileSync(configPath, 'utf8'));
          
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
          
          return res.json({
            success: true,
            config: sanitizedConfig
          });
        } catch (err) {
          return res.status(500).json({
            success: false,
            message: '读取API配置失败'
          });
        }
      }
      else if (action === 'update') {
        try {
          const { apiType, apiModel, apiKey, apiParams } = req.body;
          
          if (!apiType || !apiModel) {
            return res.status(400).json({
              success: false,
              message: '缺少必要参数'
            });
          }
          
          const configPath = path.join(process.cwd(), 'data', 'config.json');
          const configData = JSON.parse(fs.readFileSync(configPath, 'utf8'));
          
          if (!configData.apiParams) {
            configData.apiParams = {
              openai: { temperature: 0.7, max_tokens: 16384 },
              deepseek: { temperature: 0.7, max_tokens: 8000 },
              qianwen: { temperature: 0.7, max_tokens: 128000 },
              qwq: { temperature: 0.7, max_tokens: 8192 }
            };
          }
          
          if (apiParams) {
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
          
          configData.apiConfig = {
            apiType: apiType,
            apiModel: apiModel,
            apiKey: apiKey || configData.apiKeys[apiType] || '',
            apiParams: configData.apiParams
          };
          
          if (apiKey) {
            configData.apiKeys[apiType] = apiKey;
          }
          
          configData.apiModels[apiType] = apiModel;
          
          fs.writeFileSync(configPath, JSON.stringify(configData, null, 2));
          
          return res.json({
            success: true,
            message: 'API配置已更新'
          });
        } catch (err) {
          return res.status(500).json({
            success: false,
            message: '更新API配置失败: ' + err.message
          });
        }
      }
    }
    
    // 未知操作
    else {
      return res.status(400).json({
        success: false,
        error: '未知的操作类型或缺少必要参数'
      });
    }
    
  } catch (error) {
    console.error('API处理错误:', error);
    return res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
}; 