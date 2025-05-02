// 资源访问API - 处理下载、导出、预览等资源访问
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const exportUtils = require('../utils/exportUtils');
const supabaseClient = require('../utils/supabaseClient');

// 下载文件
async function handleDownload(req, res) {
  try {
    const filePath = req.query.path;
    
    if (!filePath) {
      return res.status(400).send('缺少文件路径参数');
    }
    
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
        path.join(process.cwd(), filePath), // 相对于应用根目录
        path.join(process.cwd(), 'downloads', filePath), // 在downloads目录中查找文件名
        path.join(process.cwd(), 'temp', filePath), // 在temp目录中查找文件名
        path.join(process.cwd(), 'downloads', path.basename(filePath)), // 在downloads目录中查找文件名
        path.join(process.cwd(), 'temp', path.basename(filePath)), // 在temp目录中查找文件名
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
        return fs.createReadStream(wordPath).pipe(res);
      } else if (fs.existsSync(pdfPath)) {
        res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(path.basename(pdfPath))}"`);
        return fs.createReadStream(pdfPath).pipe(res);
      }
    }
    
    // 发送文件
    fs.createReadStream(resolvedPath).pipe(res);
  } catch (err) {
    console.error('处理下载请求时出错:', err);
    res.status(500).send('下载失败: ' + err.message);
  }
}

// 导出文件
async function handleExport(req, res) {
  try {
    const { htmlFile, format } = req.query;
    
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
    }
    
    // 验证格式是否支持
    if (normalizedFormat !== 'docx' && normalizedFormat !== 'pdf') {
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
        htmlFilePath = path.join(process.cwd(), 'downloads', htmlFile);
        
        if (!fs.existsSync(htmlFilePath)) {
          htmlFilePath = path.join(process.cwd(), 'temp', htmlFile);
          
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
      exportResult = await exportUtils.exportToDocx(htmlContent, outputPath);
    } else if (normalizedFormat === 'pdf') {
      exportResult = await exportUtils.exportToPdf(htmlContent, outputPath);
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
}

// 预览文件
async function handlePreview(req, res, fileName) {
  try {
    // 安全检查：确保文件名不包含路径分隔符，防止路径遍历
    const sanitizedFilename = path.basename(fileName);
    
    console.log('尝试预览文件:', sanitizedFilename);
    
    // 检查是否是Supabase URL
    if (fileName.includes('supabase.co/storage') || fileName.startsWith('https://')) {
      console.log('检测到Supabase URL，尝试下载文件预览');
      try {
        // 从URL下载文件
        const response = await axios.get(fileName, {
          responseType: 'arraybuffer',
          timeout: 15000
        });
        
        // 获取文件扩展名并检查是否是支持的文档类型
        const fileExt = path.extname(sanitizedFilename).toLowerCase();
        const isDocument = ['.doc', '.docx', '.pdf'].includes(fileExt);
        
        if (isDocument) {
          // 创建下载目录
          const downloadDir = path.join('/tmp', 'downloads');
          if (!fs.existsSync(downloadDir)) {
            fs.mkdirSync(downloadDir, { recursive: true });
          }
          
          // 保存文件到本地
          const localFilePath = path.join(downloadDir, sanitizedFilename);
          fs.writeFileSync(localFilePath, Buffer.from(response.data));
          console.log('已将Supabase文件保存到本地:', localFilePath);
          
          // 返回文档预览HTML
          const fileSize = fs.statSync(localFilePath).size;
          const fileSizeKB = Math.round(fileSize / 1024);
          
          const previewHtml = `
          <!DOCTYPE html>
          <html>
          <head>
            <title>文档预览</title>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 800px; margin: 0 auto; padding: 20px; }
              .document-preview { border: 1px solid #ddd; border-radius: 8px; padding: 20px; background-color: #f9f9f9; }
              .icon { font-size: 48px; text-align: center; margin-bottom: 15px; color: #0066cc; }
              h2 { margin-top: 0; color: #444; }
              .meta { color: #666; margin-bottom: 15px; }
              .note { background-color: #fff8e1; border-left: 4px solid #ffc107; padding: 10px; margin-top: 20px; }
              .success { color: #4CAF50; font-weight: bold; }
            </style>
          </head>
          <body>
            <div class="document-preview">
              <div class="icon">${fileExt === '.pdf' ? '📄' : '📝'}</div>
              <h2>${sanitizedFilename}</h2>
              <div class="meta">
                <strong>文件类型:</strong> ${fileExt.replace('.', '').toUpperCase()} 文档<br>
                <strong>文件大小:</strong> ${fileSizeKB} KB
              </div>
              <p class="success">✓ 文件已成功上传并准备好处理</p>
              <div class="note">
                <p>点击美化按钮开始处理此文档。系统会自动应用您选择的样式。</p>
              </div>
            </div>
          </body>
          </html>
          `;
          
          return res.send(previewHtml);
        } else {
          return res.status(400).send('不支持的文件类型');
        }
      } catch (error) {
        console.error('从Supabase URL下载文件失败:', error);
        return res.status(500).send('无法从存储服务获取文件: ' + error.message);
      }
    }
    
    // 先检查文件类型
    const fileExt = path.extname(sanitizedFilename).toLowerCase();
    const isDocument = ['.doc', '.docx', '.pdf'].includes(fileExt);
    
    // 如果是文档文件，尝试直接在uploads目录中查找
    let filePath;
    
    if (isDocument) {
      // 尝试所有可能的位置，但主要优先检查uploads目录
      const possiblePaths = [
        path.join('/tmp', 'uploads', sanitizedFilename),
        path.join('/tmp', 'temp', sanitizedFilename),
        path.join('/tmp', 'downloads', sanitizedFilename),
        // 向后兼容
        path.join(process.cwd(), 'uploads', sanitizedFilename),
        path.join(process.cwd(), 'temp', sanitizedFilename),
        path.join(process.cwd(), 'downloads', sanitizedFilename)
      ];
      
      // 检查文件是否存在于以上路径
      for (const p of possiblePaths) {
        console.log('检查文件路径:', p);
        if (fs.existsSync(p)) {
          filePath = p;
          console.log('找到文件:', p);
          break;
        }
      }
      
      // 如果本地没有找到文件，尝试从Supabase获取
      if (!filePath) {
        console.log('本地未找到文件，尝试从Supabase获取:', sanitizedFilename);
        
        try {
          // 尝试从多个可能的路径获取文件
          const possibleStoragePaths = [
            // 新的路径格式（不包含uploads/前缀）
            `${sanitizedFilename}`,
            // 向后兼容的路径格式
            `uploads/${sanitizedFilename}`,
            `uploads/processed/${sanitizedFilename}`
          ];
          
          let fileData = null;
          let downloadSuccess = false;
          
          // 尝试每个可能的路径
          for (const storagePath of possibleStoragePaths) {
            try {
              console.log(`尝试从Supabase下载: ${storagePath}`);
              const { data, error } = await supabaseClient.supabase.storage
                .from('uploads')
                .download(storagePath);
                
              if (error) {
                console.log(`从路径 ${storagePath} 下载失败:`, error);
                continue;
              }
              
              fileData = data;
              downloadSuccess = true;
              console.log(`从Supabase成功下载文件: ${storagePath}`);
              break;
            } catch (err) {
              console.error(`尝试从 ${storagePath} 下载时出错:`, err);
            }
          }
          
          if (downloadSuccess && fileData) {
            // 确保下载目录存在
            const downloadDir = path.join('/tmp', 'downloads');
            if (!fs.existsSync(downloadDir)) {
              fs.mkdirSync(downloadDir, { recursive: true });
            }
            
            // 保存文件到本地临时目录
            filePath = path.join(downloadDir, sanitizedFilename);
            fs.writeFileSync(filePath, Buffer.from(await fileData.arrayBuffer()));
            console.log(`已将文件从Supabase保存到本地: ${filePath}`);
          }
        } catch (supabaseErr) {
          console.error('从Supabase获取文件失败:', supabaseErr);
        }
      }
    } else {
      // 如果不是文档文件，按原来的逻辑查找
      filePath = path.join('/tmp', 'temp', sanitizedFilename);
    
      if (!fs.existsSync(filePath)) {
        filePath = path.join('/tmp', 'downloads', sanitizedFilename);
      }
      
      // 如果仍找不到，尝试在原始项目目录中查找（向后兼容）
      if (!fs.existsSync(filePath)) {
        filePath = path.join(process.cwd(), 'temp', sanitizedFilename);
      }
      
      if (!fs.existsSync(filePath)) {
        filePath = path.join(process.cwd(), 'downloads', sanitizedFilename);
      }
    }
    
    if (!fs.existsSync(filePath)) {
      console.error('预览文件不存在:', filePath);
      
      // 对于Word和PDF文件，提供友好的错误HTML而不是404
      if (isDocument) {
        const errorHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>文档预览</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 800px; margin: 0 auto; padding: 20px; }
            .document-preview { border: 1px solid #ddd; border-radius: 8px; padding: 20px; background-color: #f9f9f9; }
            .icon { font-size: 48px; text-align: center; margin-bottom: 15px; color: #cc0000; }
            h2 { margin-top: 0; color: #444; }
            .meta { color: #666; margin-bottom: 15px; }
            .note { background-color: #fff8e1; border-left: 4px solid #ffc107; padding: 10px; margin-top: 20px; }
            .error { background-color: #ffebee; border-left: 4px solid #f44336; padding: 10px; margin-top: 20px; }
          </style>
        </head>
        <body>
          <div class="document-preview">
            <div class="icon">⚠️</div>
            <h2>无法预览文件</h2>
            <div class="meta">
              <strong>文件名:</strong> ${sanitizedFilename}<br>
              <strong>文件类型:</strong> ${fileExt.replace('.', '').toUpperCase()} 文档
            </div>
            <div class="error">
              <p>无法找到此文件进行预览。这可能是因为:</p>
              <ul>
                <li>文件尚未完全上传或上传过程中断</li>
                <li>文件已被系统自动清理</li>
                <li>存储服务暂时不可用</li>
              </ul>
            </div>
            <div class="note">
              <p>您可以尝试重新上传文件，或联系系统管理员寻求帮助。</p>
              <p>如果您确实需要处理此文档，可以尝试继续点击美化按钮，系统将尝试从备份存储中恢复。</p>
            </div>
          </div>
        </body>
        </html>
        `;
        
        return res.send(errorHtml);
      }
      
      // 对于其他文件类型，返回404错误
      return res.status(404).send('文件不存在或已被删除');
    }
    
    try {
      // 如果是Word或PDF文件，则返回简单的HTML预览信息
      if (isDocument) {
        const fileSize = fs.statSync(filePath).size;
        const fileSizeKB = Math.round(fileSize / 1024);
        
        // 创建简单的HTML预览
        const previewHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>文档预览</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 800px; margin: 0 auto; padding: 20px; }
            .document-preview { border: 1px solid #ddd; border-radius: 8px; padding: 20px; background-color: #f9f9f9; }
            .icon { font-size: 48px; text-align: center; margin-bottom: 15px; color: #0066cc; }
            h2 { margin-top: 0; color: #444; }
            .meta { color: #666; margin-bottom: 15px; }
            .note { background-color: #fff8e1; border-left: 4px solid #ffc107; padding: 10px; margin-top: 20px; }
          </style>
        </head>
        <body>
          <div class="document-preview">
            <div class="icon">${fileExt === '.pdf' ? '📄' : '📝'}</div>
            <h2>${sanitizedFilename}</h2>
            <div class="meta">
              <strong>文件类型:</strong> ${fileExt.replace('.', '').toUpperCase()} 文档<br>
              <strong>文件大小:</strong> ${fileSizeKB} KB
            </div>
            <p>该文件是 ${fileExt === '.pdf' ? 'PDF' : 'Word'} 文档，无法直接在浏览器中显示内容预览。</p>
            <div class="note">
              <p>文件已成功上传并保存。您可以点击美化按钮处理此文档。</p>
            </div>
          </div>
        </body>
        </html>
        `;
        
        return res.send(previewHtml);
      }
      
      // 对于HTML等其他可预览文件，读取内容
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
}

// 查看文档
async function handleViewDocument(req, res, filename) {
  try {
    // 安全检查：确保文件名不为空
    if (!filename) {
      return res.status(400).send('无效的文件名');
    }
    
    // 尝试多个可能的路径，优先使用/tmp目录
    const possiblePaths = [
      path.join('/tmp', 'downloads', filename),
      path.join('/tmp', 'temp', filename),
      path.join('/tmp', 'uploads', filename),
      // 向后兼容，旧的路径
      path.join(process.cwd(), 'downloads', filename),
      path.join(process.cwd(), 'temp', filename),
      path.join(process.cwd(), 'uploads', filename)
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
      console.error('找不到文件:', filename);
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
  } catch (error) {
    console.error('查看文档时出错:', error);
    res.status(500).send('服务器处理文档时出错: ' + error.message);
  }
}

// 图片代理
async function handleProxyImage(req, res) {
  try {
    const imageUrl = req.query.url;
    
    if (!imageUrl) {
      return res.status(400).send('缺少图片URL参数');
    }
    
    // 判断是否为Supabase URL
    if (imageUrl.includes('supabase.co/storage')) {
      // 提取存储路径和文件名
      const pathMatch = imageUrl.match(/\/public\/([^?]+)/);
      
      if (pathMatch && pathMatch[1]) {
        const storagePath = pathMatch[1];
        
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
}

// 主处理函数
module.exports = async (req, res) => {
  // 获取操作类型
  const action = req.query.action || '';
  const file = req.query.file || '';
  
  console.log(`处理资源API请求: action=${action}, file=${file}`);
  
  try {
    // 下载文件
    if (action === 'download') {
      return await handleDownload(req, res);
    }
    
    // 导出文件
    else if (action === 'export') {
      return await handleExport(req, res);
    }
    
    // 预览文件
    else if (action === 'preview' && file) {
      return await handlePreview(req, res, file);
    }
    
    // 查看文档
    else if (action === 'view' && file) {
      return await handleViewDocument(req, res, file);
    }
    
    // 图片代理
    else if (action === 'proxy-image') {
      return await handleProxyImage(req, res);
    }
    
    // 未知操作
    else {
      return res.status(400).json({
        success: false,
        error: '未知的操作类型或缺少必要参数'
      });
    }
  } catch (error) {
    console.error('资源API处理错误:', error);
    return res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
}; 