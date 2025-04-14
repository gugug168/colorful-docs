const { createClient } = require('@supabase/supabase-js');
const formidable = require('formidable');
const fs = require('fs');
const path = require('path');
const { nanoid } = require('nanoid');
const sanitize = require('sanitize-filename');

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
    }
  };
}

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

    // 检查Supabase存储桶是否可用
    try {
      const bucket = 'files';
      debug(`上传到桶: ${bucket}, 路径: ${fileKey}`);
      
      const { data, error } = await supabase.storage
        .from(bucket)
        .upload(fileKey, fileBuffer, {
          contentType: getContentType(fileName),
          upsert: false,
        });

      if (error) {
        console.error('Supabase上传错误:', error);
        // 如果上传失败，尝试返回本地文件路径
        return { 
          success: true, // 继续流程
          url: `/uploads/${path.basename(filePath)}`,
          key: fileKey,
          filename: sanitizedFileName,
          size: fs.statSync(filePath).size,
          warning: error.message
        };
      }

      // 创建可公开访问的URL
      const { data: publicUrlData } = supabase.storage
        .from(bucket)
        .getPublicUrl(fileKey);
        
      debug(`文件上传成功，URL: ${publicUrlData.publicUrl}`);

      return {
        success: true,
        url: publicUrlData.publicUrl,
        key: fileKey,
        filename: sanitizedFileName,
        size: fs.statSync(filePath).size
      };
    } catch (storageErr) {
      console.error('Supabase存储访问错误:', storageErr);
      // 如果Supabase存储不可用，尝试返回本地文件路径
      return { 
        success: true, // 继续流程
        url: `/uploads/${path.basename(filePath)}`,
        key: path.basename(filePath),
        filename: sanitizedFileName,
        size: fs.statSync(filePath).size,
        warning: storageErr.message
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

// API处理函数
module.exports = async (req, res) => {
  // 只允许POST请求
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: '方法不允许' });
  }

  try {
    debug('收到文件上传请求');
    
    // 确保上传目录存在
    const uploadDir = path.join(process.cwd(), 'tmp', 'uploads');
    debug(`使用上传目录: ${uploadDir}`);
    
    try {
      // 尝试创建目录
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
        debug(`创建上传目录成功: ${uploadDir}`);
      }
    } catch (mkdirErr) {
      console.error('创建上传目录失败:', mkdirErr);
      // 尝试使用备用目录
      const tmpDir = path.join('/tmp', 'uploads');
      try {
        if (!fs.existsSync(tmpDir)) {
          fs.mkdirSync(tmpDir, { recursive: true });
        }
        debug(`使用备用上传目录: ${tmpDir}`);
      } catch (tmpDirErr) {
        console.error('创建备用上传目录失败:', tmpDirErr);
      }
    }

    // 使用formidable解析表单
    const form = new formidable.IncomingForm({
      uploadDir: fs.existsSync(uploadDir) ? uploadDir : '/tmp',
      keepExtensions: true,
      maxFileSize: 50 * 1024 * 1024, // 50MB限制
    });

    // 解析表单数据
    const [fields, files] = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) reject(err);
        resolve([fields, files]);
      });
    });

    const uploadedFile = files.file;
    if (!uploadedFile) {
      return res.status(400).json({ success: false, error: '未提供文件' });
    }

    const originalFilename = uploadedFile.originalFilename || uploadedFile.name || 'unnamed_file';
    debug(`接收到文件: ${originalFilename}`);
    
    // 验证文件类型
    if (!validateFileType(originalFilename)) {
      // 删除临时文件
      try {
        fs.unlinkSync(uploadedFile.filepath);
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

    // 上传到Supabase
    const uploadResult = await uploadToSupabase(
      uploadedFile.filepath, 
      originalFilename,
      userId
    );

    // 删除临时文件
    try {
      fs.unlinkSync(uploadedFile.filepath);
      debug('临时文件已删除');
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
      file: {
        url: uploadResult.url,
        key: uploadResult.key,
        filename: uploadResult.filename,
        size: uploadResult.size,
        warning: uploadResult.warning
      }
    });

  } catch (err) {
    console.error('上传处理错误:', err);
    return res.status(500).json({
      success: false,
      error: '文件上传处理失败: ' + err.message
    });
  }
}; 