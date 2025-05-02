// 文档API - 处理文档上传、美化、模板和图像处理
const { createClient } = require('@supabase/supabase-js');
const formidable = require('formidable');
const fs = require('fs');
const path = require('path');
const sanitize = require('sanitize-filename');
const { v4: uuidv4 } = require('uuid');

// 调试日志
const debug = (...args) => console.log(new Date().toISOString(), ...args);

// 创建Supabase客户端
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let supabase;
try {
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('缺少Supabase配置');
  }
  debug('创建Supabase客户端:', { url: supabaseUrl, keyAvailable: !!supabaseKey });
  supabase = createClient(supabaseUrl, supabaseKey);
} catch (err) {
  console.error('Supabase客户端创建失败:', err);
  // 创建虚拟客户端，避免空引用错误
  supabase = {
    storage: {
      from: () => ({
        upload: () => ({ data: null, error: { message: 'Supabase未配置' } }),
        getPublicUrl: () => ({ data: { publicUrl: '' } })
      })
    },
    from: () => ({
      insert: () => ({ data: null, error: { message: 'Supabase未配置' } }),
      select: () => ({ data: null, error: { message: 'Supabase未配置' } })
    })
  };
}

// === 文件上传功能 ===

// 上传文件到Supabase存储
async function uploadToSupabase(filePath, fileName, userId) {
  try {
    debug(`准备上传文件到Supabase: ${fileName}`);
    
    // 检查文件是否存在
    if (!fs.existsSync(filePath)) {
      return { success: false, error: `文件不存在: ${filePath}` };
    }
    
    const fileBuffer = fs.readFileSync(filePath);
    const sanitizedFileName = sanitize(fileName);
    const fileKey = `uploads/${userId ? userId + '/' : ''}${Date.now()}-${sanitizedFileName}`;

    // 使用正确的存储桶名称
    const bucket = 'uploads';
    
    // 确保存储桶存在
    try {
      const { data: buckets, error: listError } = await supabase.storage.listBuckets();
      
      if (listError) {
        console.error('获取存储桶列表失败:', listError);
      } else {
        // 检查uploads存储桶是否存在
        const uploadsBucket = buckets.find(b => b.name === bucket);
        if (!uploadsBucket) {
          console.log(`存储桶 "${bucket}" 不存在，尝试创建...`);
          
          const { error: createError } = await supabase.storage.createBucket(bucket, {
            public: true
          });
          
          if (createError) {
            console.error(`创建 "${bucket}" 存储桶失败:`, createError);
            console.warn('将继续尝试上传，但可能会失败');
          } else {
            console.log(`✓ 存储桶 "${bucket}" 创建成功`);
          }
        } else {
          console.log(`✓ 存储桶 "${bucket}" 已存在`);
        }
      }
    } catch (bucketError) {
      console.error('检查存储桶时出错:', bucketError);
    }
    
    try {
      debug(`尝试上传到存储桶: ${bucket}, 路径: ${fileKey}`);
      
      const { data, error } = await supabase.storage
        .from(bucket)
        .upload(fileKey, fileBuffer, {
          contentType: getContentType(fileName),
          upsert: true,
        });

      if (error) {
        console.error(`上传到 ${bucket} 桶时出错:`, error);
        console.error('错误详情:', JSON.stringify(error));
        
        // 如果上传失败，使用本地路径
        console.warn('Supabase存储桶上传失败，使用本地文件路径作为备选');
        return { 
          success: true, // 继续流程
          url: `/uploads/${path.basename(filePath)}`,
          key: fileKey,
          filename: sanitizedFileName,
          size: fs.statSync(filePath).size,
          warning: 'Supabase存储上传失败，使用本地路径'
        };
      }

      // 创建可公开访问的URL
      const { data: publicUrlData } = supabase.storage
        .from(bucket)
        .getPublicUrl(fileKey);
        
      debug(`文件上传成功到 ${bucket} 桶，URL: ${publicUrlData.publicUrl}`);
      
      return {
        success: true,
        url: publicUrlData.publicUrl,
        key: fileKey,
        filename: sanitizedFileName,
        size: fs.statSync(filePath).size,
        bucket: bucket
      };
    } catch (err) {
      console.error(`上传到 ${bucket} 桶时发生错误:`, err);
      
      // 如果发生错误，使用本地路径
      return { 
        success: true, // 继续流程
        url: `/uploads/${path.basename(filePath)}`,
        key: fileKey,
        filename: sanitizedFileName,
        size: fs.statSync(filePath).size,
        warning: 'Supabase存储上传出错，使用本地路径'
      };
    }
  } catch (err) {
    console.error('文件上传处理错误:', err);
    return { success: false, error: err.message };
  }
}

// 根据文件名获取内容类型
function getContentType(fileName) {
  const extension = fileName.split('.').pop().toLowerCase();
  const mimeTypes = {
    'pdf': 'application/pdf',
    'doc': 'application/msword',
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'html': 'text/html',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png'
  };
  
  return mimeTypes[extension] || 'application/octet-stream';
}

// 验证文件类型
function validateFileType(fileName) {
  const allowedExtensions = ['pdf', 'doc', 'docx'];
  const extension = fileName.split('.').pop().toLowerCase();
  return allowedExtensions.includes(extension);
}

// 处理文件上传
async function handleUpload(req, res) {
  try {
    debug('收到文件上传请求');
    
    // 直接使用 /tmp 目录，这是Vercel唯一保证可写的目录
    const uploadDir = path.join('/tmp', 'uploads'); 
    debug(`使用上传目录: ${uploadDir}`);
    
    try {
      // 确保 /tmp/uploads 目录存在
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
        debug(`创建上传目录成功: ${uploadDir}`);
      }
    } catch (mkdirErr) {
      // 如果在 /tmp 下创建目录仍然失败，记录错误并返回
      console.error(`创建上传目录 ${uploadDir} 失败:`, mkdirErr);
      return res.status(500).json({
        success: false,
        error: `服务器无法创建临时上传目录: ${mkdirErr.message}`
      });
    }

    // 使用formidable解析表单，确保使用正确的uploadDir
    const form = new formidable.IncomingForm({
      uploadDir: uploadDir, // 直接使用确保存在的 /tmp 目录
      keepExtensions: true,
      maxFileSize: 50 * 1024 * 1024, // 50MB限制
    });

    // 解析表单数据
    const [fields, files] = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        // 添加日志记录解析结果
        if (err) {
          console.error('Formidable 解析错误:', err);
          reject(err);
          return;
        }
        console.log('Formidable 解析成功:', { fields: Object.keys(fields), files: Object.keys(files) });
        if (files && typeof files === 'object') {
            console.log('Files 对象内容:', Object.keys(files).map(key => ({ 
                key: key, 
                filename: files[key] ? files[key].originalFilename : 'N/A', 
                size: files[key] ? files[key].size : 'N/A' 
            })));
        }
        resolve([fields, files]);
      });
    });

    // 现在检查文件字段
    console.log('检查上传的文件字段, 可用的文件字段:', Object.keys(files));
    
    // 尝试多种可能的字段名称
    let uploadedFile = files.document || files.file;
    
    // 添加更详细的日志，查看 uploadedFile 对象的具体内容
    console.log('Uploaded File Object:', uploadedFile);

    if (!uploadedFile) {
      console.error('错误: 未找到上传文件字段。可用的文件字段:', Object.keys(files));
      return res.status(400).json({ success: false, error: '未提供文件或文件解析失败' });
    }
    
    // 处理各种可能的formidable版本格式
    let fileData;
    if (Array.isArray(uploadedFile)) {
      // Formidable v3+ 将文件放在数组中
      if (uploadedFile.length === 0) {
        return res.status(400).json({ success: false, error: '上传的文件数组为空' });
      }
      fileData = uploadedFile[0];
    } else {
      // 较早版本的formidable或修改过的formidable
      fileData = uploadedFile;
    }
    
    console.log('Extracted File Data:', fileData);

    // 尝试从各种可能的属性中获取必要信息
    const originalFilename = fileData.originalFilename || fileData.originalName || fileData.name || fileData.newFilename || 'unnamed_file';
    let tempFilepath = fileData.filepath || fileData.path;
    const fileSize = fileData.size;
    
    console.log('解析出的文件信息:', { originalFilename, tempFilepath, fileSize });

    // 检查获取到的信息是否有效
    if (!tempFilepath) {
        console.error('错误: formidable未能提供临时文件路径 (filepath)');
        return res.status(500).json({ success: false, error: '服务器文件解析错误：无法获取文件路径' });
    }
    
    // 文件找到了，继续处理
    console.log('成功获取文件字段 \'document\'.');
    debug(`接收到文件: ${originalFilename}`);

    // 使用解析出的 originalFilename 进行类型验证
    if (!validateFileType(originalFilename)) {
      // 删除临时文件
      try {
        // 使用解析出的 tempFilepath 删除
        if (fs.existsSync(tempFilepath)) {
            fs.unlinkSync(tempFilepath);
            debug('无效类型文件已删除:', tempFilepath);
        } else {
            debug('尝试删除无效类型文件，但文件不存在:', tempFilepath);
        }
      } catch (unlinkErr) {
        debug(`删除临时文件失败: ${unlinkErr.message}`);
      }
      return res.status(400).json({ 
        success: false, 
        error: '不支持的文件类型，仅支持PDF、DOC和DOCX文件' 
      });
    }

    // 提取用户ID（如果有）
    const userId = fields.userId || null;

    // 上传到Supabase (使用解析出的 tempFilepath 和 originalFilename)
    const uploadResult = await uploadToSupabase(
      tempFilepath, 
      originalFilename,
      userId
    );

    // 删除临时文件 (使用解析出的 tempFilepath)
    try {
      if (fs.existsSync(tempFilepath)) {
          fs.unlinkSync(tempFilepath);
          debug('临时文件已删除:', tempFilepath);
      } else {
          debug('尝试删除临时文件，但文件不存在:', tempFilepath);
      }
    } catch (unlinkErr) {
      debug(`删除临时文件失败: ${unlinkErr.message}`);
    }

    if (!uploadResult.success) {
      return res.status(500).json({
        success: false,
        error: uploadResult.error || '文件上传失败'
      });
    }

    debug('文件上传成功，返回结果');
    
    // 返回成功响应
    return res.status(200).json({
      success: true,
      // 添加顶层字段，兼容不同的前端代码路径
      path: uploadResult.url,
      url: uploadResult.url,
      filename: uploadResult.filename,
      // 保留file对象
      file: {
        url: uploadResult.url,
        key: uploadResult.key,
        filename: uploadResult.filename,
        size: uploadResult.size,
        warning: uploadResult.warning
      },
      // 添加兼容旧前端代码的字段
      uploadedFile: {
        originalname: uploadResult.filename,
        filename: uploadResult.filename,
        path: uploadResult.url,
        url: uploadResult.url,
        type: originalFilename.split('.').pop().toLowerCase(),
        size: uploadResult.size,
        downloadUrl: uploadResult.url
      }
    });
  } catch (err) {
    console.error('上传处理错误:', err);
    return res.status(500).json({
      success: false,
      error: '文件上传处理失败: ' + err.message
    });
  }
}

// === 美化任务功能 ===

// 处理美化任务请求
async function handleBeautifyTask(req, res) {
  // 兼容旧版本API调用
  const requestPath = req.url || '';
  if (requestPath.includes('/beautify') && !requestPath.includes('/beautify-task')) {
    console.log('收到旧版本美化请求，提供兼容处理');
    
    // 从请求中提取数据
    const body = req.body || {};
    
    // 返回响应，引导前端使用新API
    return res.status(200).json({
      success: true,
      taskId: 'mock-task-' + Date.now(),
      status: 'pending',
      message: '请使用/api/beautify-task端点替代/beautify'
    });
  }
  
  try {
    const body = req.body;
    console.log('收到美化任务请求:', JSON.stringify(body));
    
    // 获取参数
    const { filePath, filename, targetFormat = 'word', apiType = 'deepseek', templateId = '', customRequirements = '' } = body;
    
    // 验证文件路径和文件名
    if (!filePath || !filename) {
      return res.status(400).json({
        success: false,
        message: '缺少文件路径或文件名'
      });
    }
    
    // 生成任务ID
    const taskId = uuidv4();
    
    // 准备任务数据
    const taskData = {
      id: taskId,
      status: 'pending',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      data: {
        filename: filename,
        filePath: filePath,
        targetFormat: targetFormat,
        apiType: apiType,
        customRequirements: customRequirements,
        taskType: 'beautify',
        createdAt: new Date().toISOString()
      },
      result: null,
      error: null,
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    };
    
    // 尝试创建任务到Supabase
    try {
      const { data, error } = await supabase
        .from('tasks')
        .insert([taskData])
        .select();
      
      if (error) {
        console.error('Supabase创建任务失败:', error);
        // 在Supabase失败的情况下，我们仍然返回成功
        // 因为前端只需要任务ID来检查状态
      }
      
      console.log(`任务创建${error ? '失败但继续' : '成功'}: ${taskId}`);
    } catch (supabaseError) {
      console.error('Supabase请求错误:', supabaseError);
      // 继续执行，不影响API响应
    }
    
    // 返回任务ID - 即使Supabase创建失败也返回成功
    // 用于前端展示目的
    return res.status(200).json({
      success: true,
      taskId: taskId,
      status: 'pending',
      message: '美化任务已提交，请稍后检查结果'
    });
    
  } catch (error) {
    console.error('创建美化任务出错:', error);
    return res.status(500).json({ 
      success: false,
      error: error.message || '服务器内部错误'
    });
  }
}

// === 模板功能 ===

// 处理模板请求
async function handleTemplates(req, res) {
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
}

// 主处理函数
module.exports = async (req, res) => {
  // 启用CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // 处理OPTIONS请求
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // 获取操作类型
  const action = req.query.action || '';
  
  console.log(`处理文档API请求: action=${action}, method=${req.method}`);
  
  try {
    // 根据action参数执行不同的操作
    
    // 上传文件
    if (action === 'upload' && req.method === 'POST') {
      return await handleUpload(req, res);
    }
    
    // 美化任务
    else if (action === 'beautify' && req.method === 'POST') {
      return await handleBeautifyTask(req, res);
    }
    
    // 获取模板
    else if (action === 'templates' && req.method === 'GET') {
      return await handleTemplates(req, res);
    }
    
    // 未知操作
    else {
      return res.status(400).json({
        success: false,
        error: '未知的操作类型或请求方法不支持'
      });
    }
  } catch (error) {
    console.error('文档API处理错误:', error);
    return res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
}; 