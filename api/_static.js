// 处理静态资源访问
const fs = require('fs');
const path = require('path');
const mime = require('mime-types');

// 支持的静态资源目录映射
const staticDirs = {
  '/images/': path.join(process.cwd(), 'public', 'images'),
  '/css/': path.join(process.cwd(), 'public', 'css'),
  '/js/': path.join(process.cwd(), 'public', 'js'),
  '/downloads/': path.join(process.cwd(), 'public', 'downloads'),
  '/temp/': path.join(process.cwd(), 'public', 'temp'),
  '/favicon.ico': path.join(process.cwd(), 'public', 'favicon.ico')
};

// 静态文件MIME类型映射
const mimeTypes = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.pdf': 'application/pdf',
  '.txt': 'text/plain'
};

/**
 * 检查URL是否为静态资源路径
 * @param {string} url - 请求URL
 * @returns {boolean} - 是否为静态路径
 */
function isStaticPath(url) {
  // 检查是否以定义的静态目录前缀开头
  for (const staticPath in staticDirs) {
    if (url === staticPath || (staticPath.endsWith('/') && url.startsWith(staticPath))) {
      return true;
    }
  }
  return false;
}

/**
 * 获取静态资源的文件系统路径
 * @param {string} url - 请求URL
 * @returns {string|null} - 文件系统路径，如果不是静态资源则返回null
 */
function getFilePath(url) {
  for (const staticPath in staticDirs) {
    if (url === staticPath) {
      return staticDirs[staticPath];
    }
    if (staticPath.endsWith('/') && url.startsWith(staticPath)) {
      const relativePath = url.slice(staticPath.length);
      return path.join(staticDirs[staticPath], relativePath);
    }
  }
  return null;
}

/**
 * 处理静态资源请求
 * @param {Object} req - 请求对象
 * @param {Object} res - 响应对象
 * @returns {Boolean} - 是否处理了请求
 */
module.exports = async (req, res) => {
  // 提取请求路径
  const url = new URL(req.url, `http://${req.headers.host}`);
  let filePath = url.pathname;

  // 仅处理静态资源请求
  if (!filePath.match(/\.(html|css|js|json|png|jpg|jpeg|gif|svg|ico|webp|pdf|txt)$/i)) {
    return false;
  }

  // 规范化文件路径
  if (filePath.startsWith('/public/')) {
    filePath = filePath.substring(7); // 移除'/public/'前缀
  }

  // 构建完整的文件路径
  const resolvedPath = path.join(process.cwd(), 'public', filePath);

  try {
    // 检查文件是否存在
    if (!fs.existsSync(resolvedPath)) {
      console.log(`文件不存在: ${resolvedPath}`);
      return false;
    }

    // 获取文件扩展名和MIME类型
    const ext = path.extname(resolvedPath).toLowerCase();
    const contentType = mimeTypes[ext] || 'application/octet-stream';

    // 设置响应头
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=3600'); // 1小时缓存
    
    // 图片可以缓存更久
    if (contentType.startsWith('image/')) {
      res.setHeader('Cache-Control', 'public, max-age=86400'); // 24小时缓存
    }

    // 读取并发送文件
    const fileContent = fs.readFileSync(resolvedPath);
    res.status(200).send(fileContent);
    return true;
  } catch (error) {
    console.error('静态文件处理错误:', error);
    return false;
  }
}; 