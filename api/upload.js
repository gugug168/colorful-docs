const { createClient } = require('@supabase/supabase-js');
const formidable = require('formidable');
const fs = require('fs');
const path = require('path');
const { nanoid } = require('nanoid');
const sanitize = require('sanitize-filename');

// 创建Supabase客户端
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// 上传文件到Supabase存储
async function uploadToSupabase(filePath, fileName, userId) {
  try {
    const fileBuffer = fs.readFileSync(filePath);
    const sanitizedFileName = sanitize(fileName);
    const fileKey = `uploads/${userId ? userId + '/' : ''}${Date.now()}-${sanitizedFileName}`;

    const { data, error } = await supabase.storage
      .from('files')
      .upload(fileKey, fileBuffer, {
        contentType: getContentType(fileName),
        upsert: false,
      });

    if (error) {
      console.error('Supabase上传错误:', error);
      return { success: false, error: error.message };
    }

    // 创建可公开访问的URL
    const { data: publicUrlData } = supabase.storage
      .from('files')
      .getPublicUrl(fileKey);

    return {
      success: true,
      url: publicUrlData.publicUrl,
      key: fileKey,
      filename: sanitizedFileName,
      size: fs.statSync(filePath).size
    };
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
    // 确保上传目录存在
    const uploadDir = path.join(process.cwd(), 'tmp', 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    // 使用formidable解析表单
    const form = new formidable.IncomingForm({
      uploadDir,
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
    
    // 验证文件类型
    if (!validateFileType(originalFilename)) {
      // 删除临时文件
      fs.unlinkSync(uploadedFile.filepath);
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
    fs.unlinkSync(uploadedFile.filepath);

    if (!uploadResult.success) {
      return res.status(500).json({
        success: false,
        error: uploadResult.error || '文件上传失败'
      });
    }

    // 记录上传到数据库(可选，视业务需求而定)
    // const { data: fileRecord, error: dbError } = await supabase
    //   .from('documents')
    //   .insert([{
    //     filename: uploadResult.filename,
    //     file_path: uploadResult.key,
    //     file_url: uploadResult.url,
    //     user_id: userId,
    //     file_size: uploadResult.size,
    //     status: 'uploaded'
    //   }]);

    // 返回成功响应
    return res.status(200).json({
      success: true,
      file: {
        url: uploadResult.url,
        key: uploadResult.key,
        filename: uploadResult.filename,
        size: uploadResult.size
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