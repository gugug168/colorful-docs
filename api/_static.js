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
 * @returns {boolean} - 是否处理了请求
 */
async function handleStaticRequest(req, res) {
  const { url, method } = req;

  // 仅处理GET请求
  if (method !== 'GET') {
    return false;
  }
  
  // 检查URL是否为静态资源
  if (!isStaticPath(url)) {
    return false;
  }

  try {
    const filePath = getFilePath(url);
    
    // 检查文件是否存在
    if (!fs.existsSync(filePath)) {
      console.log(`Static file not found: ${filePath}`);
      res.statusCode = 404;
      res.end('Not Found');
      return true;
    }

    // 获取文件状态
    const stat = fs.statSync(filePath);
    
    // 如果是目录，则拒绝访问
    if (stat.isDirectory()) {
      res.statusCode = 403;
      res.end('Forbidden');
      return true;
    }

    // 设置内容类型和长度
    const contentType = mime.lookup(filePath) || 'application/octet-stream';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Length', stat.size);
    
    // 流式传输文件内容
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
    
    return true;
  } catch (err) {
    console.error(`Error serving static file: ${err.message}`);
    res.statusCode = 500;
    res.end('Internal Server Error');
    return true;
  }
}

module.exports = {
  isStaticPath,
  handleStaticRequest
}; 